import { Editor, EditorChange, EditorPosition } from "obsidian";

import type FootnotePlugin from "./main";
import { escapedAt } from "./footnote-grammar";
import { TrailingPunctuationChars } from "./markdown-scan";
import {
    EditorWithCm,
    VaultWithConfig,
    WindowWithVim,
} from "./obsidian-internals";
import { nestedSubEditorOwnsFocus } from "./table-cursor";

// Caret placement: the one cursor-moving primitive (vim-jumplist-aware,
// single-transaction with any text changes), and the end-of-word insertion
// point logic. Split out of the all-in-one commands file 2026-08-11.

export function moveCursorAndSetJumpPoint(
    doc: Editor,
    oldCursorPos: EditorPosition,
    newCursorPos: EditorPosition,
    plugin: FootnotePlugin,
    changes?: EditorChange[],
    center = false,
): void {
    // when focus sits in a sub-editor (a table cell being edited — its
    // contentDOM is nested inside the main editor's), return it to the main
    // editor BEFORE moving the cursor: a jump out of the table would
    // otherwise leave keystrokes going to the abandoned cell editor, while
    // a jump into a table re-activates cell editing on its own
    const cmView = (doc as EditorWithCm).cm;
    if (cmView && nestedSubEditorOwnsFocus(doc)) {
        cmView.focus();
    }

    if (changes && changes.length > 0) {
        // text edits and the cursor move must go out as ONE transaction:
        // while a table cell is being edited (Obsidian 1.5+ table editor),
        // separate dispatches in the same tick race the cell editor's
        // sync-back and corrupt the document (issue #28). `selection` here
        // is resolved against the post-change document.
        doc.transaction({ changes, selection: { from: newCursorPos } });
    } else {
        doc.setCursor(newCursorPos);
    }

    // jumps land CENTERED: Obsidian's minimal scrolling would park the
    // cursor at the viewport edge — on mobile, nearly off screen. Local
    // inserts pass center=false so the view doesn't shift underfoot.
    if (center) {
        doc.scrollIntoView({ from: newCursorPos, to: newCursorPos }, true);
    }

    // if user has vim mode enabled, set jump point
    // getConfig is private API, like the vim internals below
    if ((plugin.app.vault as VaultWithConfig).getConfig?.("vimMode")) {
        (activeWindow as WindowWithVim).CodeMirrorAdapter?.Vim.getVimGlobalState_().jumpList.add(
            (doc as EditorWithCm).cm?.cm, // SIC two levels deep
            oldCursorPos,
            newCursorPos,
        );
    }
}

/** Whether `c` is trailing punctuation (TrailingPunctuationChars in markdown-scan — ASCII + CJK, shared with the lint rule). Guards the empty string explicitly — `"…".includes("")` is true, and `text[i]` past EOL yields undefined at some call sites. */
function isTrailingPunctuation(c: string | undefined): boolean {
    return !!c && TrailingPunctuationChars.includes(c);
}

/**
 * The end-of-word insertion point within plain text: from `offset`, the end
 * of the word under (or just before) the cursor, plus one trailing
 * punctuation mark. Offsets with no word touching them are returned
 * unchanged. This is `adjustFootnotePosition` for table cells, where the
 * main editor's `wordAt` can't see the cell sub-editor's text. Word
 * characters are unicode letters/numbers/marks — combining accents belong
 * to the word they follow, matching the grapheme-aware `wordAt`.
 */
export function endOfWordOffset(text: string, offset: number): number {
    // walk by CODE POINTS: astral letters (Deseret, CJK Ext-B like 𠮷) are
    // two UTF-16 units, and testing lone surrogates against \p{L} split
    // words in table cells (bug-astral-word-walk)
    const isWordCp = (cp: number | undefined) =>
        cp !== undefined && /[\p{L}\p{N}\p{M}_]/u.test(String.fromCodePoint(cp));
    // the code point touching `i` from the left — stepping over a low
    // surrogate to the pair's start, and treating a mid-pair `i` as inside
    // its own pair — or undefined at the text's start
    const cpBefore = (i: number): number | undefined => {
        if (i <= 0) return undefined;
        const prev = text.charCodeAt(i - 1);
        if (prev >= 0xd800 && prev <= 0xdbff) {
            return text.codePointAt(i - 1); // `i` sits mid-pair
        }
        if (prev >= 0xdc00 && prev <= 0xdfff && i >= 2) {
            return text.codePointAt(i - 2);
        }
        return prev;
    };
    if (!isWordCp(text.codePointAt(offset)) && !isWordCp(cpBefore(offset))) {
        return offset;
    }
    let end = offset;
    // a mid-pair start (found by fast-check, 2026-08-10) snaps back to its
    // code point's boundary so the walk — and the returned caret — always
    // land between code points
    const unitAtEnd = text.charCodeAt(end);
    if (unitAtEnd >= 0xdc00 && unitAtEnd <= 0xdfff) end--;
    for (;;) {
        const cp = text.codePointAt(end);
        if (!isWordCp(cp)) break;
        end += (cp as number) > 0xffff ? 2 : 1;
    }
    if (isTrailingPunctuation(text[end])) end++;
    return end;
}

/**
 * The rightmost column at or left of `ch` where an insertion keeps its
 * meaning: text inserted directly after an ESCAPING backslash would itself
 * be escaped ("\" + "[^N]" is literal prose, its appended definition
 * instantly orphaned — while the character the backslash used to protect
 * goes LIVE), and a reference inserted directly after an unescaped "^"
 * would be swallowed as inline-footnote content ("^" + "[^N]" reads as
 * "^[^N]"). Both found by the command-press property suite (2026-08-12).
 * Each hazard steps one column left; runs of hazards walk left until the
 * insertion is safe.
 */
export function safeInsertionCh(lineText: string, ch: number): number {
    for (;;) {
        if (escapedAt(lineText, ch)) {
            ch--;
            continue;
        }
        if (
            ch > 0 &&
            lineText[ch - 1] === "^" &&
            !escapedAt(lineText, ch - 1)
        ) {
            ch--;
            continue;
        }
        return ch;
    }
}

/** adjust cursor position to insert a footnote only at the end of word, and never where an escape or inline-footnote opener would swallow the insertion */
export function adjustFootnotePosition(
    cursorPosition: EditorPosition,
    doc: Editor,
    lineText: string,
    plugin: FootnotePlugin,
) {
    if (plugin.settings.insertAtEndOfWord) {
        const endOfWordUnderCursor = doc.wordAt(cursorPosition)?.to;
        if (endOfWordUnderCursor) {
            // adjust cursor position to insert a footnote only at the end of word
            const nextChar = lineText.charAt(endOfWordUnderCursor.ch);
            if (isTrailingPunctuation(nextChar)) endOfWordUnderCursor.ch++;
            cursorPosition = endOfWordUnderCursor;
        }
    }
    const ch = safeInsertionCh(lineText, cursorPosition.ch);
    if (ch !== cursorPosition.ch) {
        cursorPosition = { line: cursorPosition.line, ch };
    }
    return cursorPosition;
}
