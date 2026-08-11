import {
	Editor,
	EditorChange,
	EditorPosition,
	MarkdownView,
	Notice
} from "obsidian";

import FootnotePlugin from "./main";
import {
    computeNextFootnoteNumber,
    emptyReferenceStart,
    footnoteReferenceMatches,
    idListIncludes,
    isValidFootnoteName,
    referenceAtCursor,
    referenceOccurrences,
} from "./footnote-grammar";
import { footnotePopupBusy, openFootnotePopup, popupEditingAvailable, runAfterNextPopupSettle, settleFootnotePopupWithFeedback, toggleCloseFootnotePopup } from "./footnote-popup";
import { activeFootnotePrefix, footnotePrefix, footnotePrefixFromEditor, footnotePrefixProblem } from "./footnote-prefix";
import { lintAfterFootnoteCreation } from "./linting/linter";
import { definitionLabelIn, DocumentScan, findDefinitionBlocks, maskInlineRegions, maskLineRegions, maskProtectedLines, maskedLineAt, scanDocument, TrailingPunctuationChars } from "./markdown-scan";
import { EditorWithCm, VaultWithConfig, viewEditor, WindowWithVim } from "./obsidian-internals";
import { activeTableCellEditor, nestedSubEditorOwnsFocus, resolveTableCellCursor, runOutsideTableCell, TableCellEditor } from "./table-cursor";

// Core logic for both hotkey commands. Each press walks the same decision
// cascade against the caret position:
//   1. on a definition line ("[^x]: …")      → jump back to the first reference
//   2. on a reference with an existing definition → jump to (or popup-edit) it
//   3. on a reference with NO definition → create the definition (every key: an
//      accidental press mid-naming must continue the footnote, never
//      nest a new reference into the brackets)
//   4. otherwise → insert a new reference ("[^N]" + definition, or empty "[^]")
// Table caveat (see table-cursor.ts): when the caret is in an actively
// edited table cell, reads use the position resolved from the cell's
// sub-editor and reference writes are dispatched INTO that sub-editor.

/** Whether `mdView` is in Reading view — where every text-editing command must be inert. The structural parameter type keeps getMode honestly optional: bare test fakes without it count as editable. */
export function readingViewActive(mdView: {
    getMode?: MarkdownView["getMode"];
}): boolean {
    return mdView.getMode?.() === "preview";
}

// Scans run against the document's masked twin (code and frontmatter
// blotted out, indices preserved): a "[^x]" inside a code sample is plain
// text, not a footnote (issue #41).
function docLines(doc: Editor): string[] {
    const lines: string[] = [];
    for (let i = 0; i < doc.lineCount(); i++) {
        lines.push(doc.getLine(i));
    }
    return lines;
}

/**
 * One press's shared read-only view of the document (perf F1): the cascade
 * steps used to each re-materialize the lines and re-walk the protection
 * scan — 3–5 full-document passes per press. Every step takes an optional
 * DocContext (defaulting to a fresh one, so direct/unit callers are
 * unchanged) and the command entry points build ONE per press. Masking is
 * lazy: per line on demand, whole-twin memoized on first full need. Built
 * strictly BEFORE any edit of the press — creation steps edit last, so the
 * context never goes stale within a press.
 */
export interface DocContext {
    lines: string[];
    scan: DocumentScan;
    /** Line `i` of the masked twin ("" when out of range), cached per line. */
    maskedLine(i: number): string;
    /** The whole masked twin, memoized. */
    maskedLines(): string[];
}

function docContext(doc: Editor): DocContext {
    const lines = docLines(doc);
    const scan = scanDocument(lines);
    const perLine: (string | undefined)[] = new Array<string | undefined>(
        lines.length,
    );
    let full: string[] | null = null;
    const maskedLine = (i: number): string => {
        if (i < 0 || i >= lines.length) return "";
        const line = lines[i];
        if (full) return full[i];
        let masked = perLine[i];
        if (masked === undefined) {
            masked = scan.isProtected[i]
                ? "\0".repeat(line.length)
                : maskLineRegions(line, {
                      comment: scan.startsInComment[i],
                      math: scan.startsInMath[i],
                  }).masked;
            perLine[i] = masked;
        }
        return masked;
    };
    const maskedLines = (): string[] =>
        full ?? (full = maskProtectedLines(lines, scan));
    return { lines, scan, maskedLine, maskedLines };
}

/** Names of all footnote definitions ("[^x]: …" lines) in document order, one per line at most. Code blocks don't count. */
export function listExistingFootnoteDefinitions(
    doc: Editor,
    ctx: DocContext = docContext(doc),
) {
    const definitionNames: string[] = [];

    //search each line for footnote definitions — column-0 labels and
    //blockquote/callout ones ("> [^x]: …", C22) — and list their names
    const lines = ctx.lines;
    const masked = ctx.maskedLines();
    for (let i = 0; i < lines.length; i++) {
        const label = definitionLabelIn(masked[i]);
        if (label) {
            // re-slice the ORIGINAL line: a code span inside the name masks
            // to NULs, and the masked name would otherwise leak them into
            // saved output (its reference sibling re-slices for the same reason)
            definitionNames.push(lines[i].slice(label.nameStart, label.nameEnd));
        }
    }
    return definitionNames;
}

/** Every reference occurrence with its position — repeated references appear once per use. Code blocks don't count. */
export function listExistingFootnoteReferencesAndLocations(
    doc: Editor
) {
    const references: { footnote: string; lineNum: number; startIndex: number }[] = [];

    //search each line for footnote references
    //for each, add their name, line number, and start index to the list
    const lines = docLines(doc);
    const masked = maskProtectedLines(lines);
    for (let i = 0; i < lines.length; i++) {
        for (const match of footnoteReferenceMatches(masked[i])) {
            const start = match.index ?? 0;
            references.push({
                // slice the original: the masked match text could carry
                // mask characters when code sits inside the brackets
                footnote: lines[i].slice(start, start + match[0].length),
                lineNum: i,
                startIndex: start,
            });
        }
    }
    return references;
}

function moveCursorAndSetJumpPoint(
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

/** Cascade step 1: caret on a definition line → jump to the first use of its reference. Returns whether it handled the press. */
export function shouldJumpFromDefinitionToReference(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx?: DocContext,
): boolean {
    // check if we're in a footnote definition line ("[^1]: footnote") or one of
    // its continuation lines; if so, jump back to the footnote in the text

    // cheap pre-check on the raw line; the whole-document scanning below
    // only runs when the caret sits on something definition-shaped — the
    // "[^x]:" line itself, or an indented line that MIGHT be a continuation
    // (jump-to-definition deliberately parks the caret on the LAST continuation
    // line, and the hotkey there used to insert a new footnote instead of
    // jumping back — bug reported 2026-07-17)
    if (definitionLabelIn(lineText) === null && !/^\s+\S/.test(lineText)) return false;

    // #41: a "[^x]:" inside a code block is not a definition, and a reference
    // inside code is not a jump target — resolve against protected-aware
    // definition blocks and scan the masked twin
    // built only past the raw-line gate above (the gate exists because
    // this runs on every press — perf F1/F8)
    ctx ??= docContext(doc);
    const lines = ctx.lines;
    // the press's one protection scan feeds the block lookup and masking
    const block = findDefinitionBlocks(lines, ctx.scan.isProtected, ctx.scan).find(
        (candidate) =>
            cursorPosition.line >= candidate.start &&
            cursorPosition.line <= candidate.end,
    );
    let definitionName: string | null = null;
    if (block) {
        definitionName = block.name;
    } else {
        // a blockquoted/callout label ("> [^x]: …", C22) is a definition
        // too, but never part of a column-0 definition BLOCK — match the
        // caret's masked line and re-slice the raw name
        const label = definitionLabelIn(ctx.maskedLine(cursorPosition.line));
        if (label && label.nameStart > 2) {
            definitionName = lineText.slice(label.nameStart, label.nameEnd);
        }
    }
    if (definitionName !== null) {
        // ids are case-insensitive, so the reference may differ in casing from
        // the definition's label ("[^Note]" ↔ "[^note]:") — fold both to compare
        const name = definitionName.toLowerCase();
        const masked = ctx.maskedLines();

        // find the FIRST reference use of this footnote. footnoteReferenceMatches
        // skips a definition's own column-0 label; blockquoted labels read
        // as mid-line references, so they are skipped here — a label
        // ANYWHERE defines, it doesn't reference, and jumping to a
        // blockquoted duplicate's label was a phantom target
        // (parallel-review probe, 2026-08-10)
        for (let i = 0; i < masked.length; i++) {
            const lineLabel = definitionLabelIn(masked[i]);
            for (const use of referenceOccurrences(lines[i], masked[i])) {
                if (lineLabel && use.start === lineLabel.nameStart - 2) {
                    continue;
                }
                if (use.name.toLowerCase() !== name) continue;
                const newCursorPos = { line: i, ch: use.end };
                moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, undefined, true);
                return true;
            }
        }
        // an ORPHANED definition — no reference anywhere. Falling through used
        // to insert a brand-new footnote INTO the definitions area, when the
        // user almost certainly pressed the key to jump to the reference they
        // have since deleted; explain and stand still instead (QOL sweep,
        // 2026-08-07)
        new Notice(
            `Nothing references this footnote. Add a [^${definitionName}] reference in the text, or delete the definition.`,
            8000,
        );
        return true;
    }
    return false;
}

/** Move the caret to the end of the named footnote's definition (including its indented continuation lines). */
export function jumpToFootnoteDefinition(
    footnoteName: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx: DocContext = docContext(doc),
): boolean {
    // find the first line with this definition reference name in it — matching
    // the masked twin so definition-shaped lines inside code don't count
    // (#41); blockquote/callout labels count too (C22)
    const lines = ctx.lines;
    const masked = ctx.maskedLines();
    for (let i = 0; i < masked.length; i++) {
        const label = definitionLabelIn(masked[i]);
        // ids are case-insensitive: the definition label may differ in casing
        // from the reference name that sent us here. Re-slice the ORIGINAL
        // line for the name — a code span inside it masks to NULs
        // (bug-masked-name-identity)
        if (
            label &&
            lines[i].slice(label.nameStart, label.nameEnd).toLowerCase() ===
                footnoteName.toLowerCase()
        ) {
            // land at the END of the definition (indented lines belong to
            // it) so the user can backspace/type without arrow keys — but a
            // PROTECTED indented line (e.g. inside a fence that follows the
            // definition) is not a continuation, matching findDefinitionBlocks
            let endLine = i;
            while (
                endLine < doc.lastLine() &&
                !ctx.scan.isProtected[endLine + 1] &&
                /^\s+\S/.test(lines[endLine + 1])
            ) {
                endLine++;
            }
            const newCursorPos = { line: endLine, ch: doc.getLine(endLine).length };
            moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, undefined, true);
            return true;
        }
    }
    return false;
}

/** Cascade step 2: caret on a reference that HAS a definition → popup-edit it (when enabled) or jump to it. References without a definition return false so creation runs. */
export function shouldJumpFromReferenceToDefinition(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx?: DocContext,
): boolean {
    // Jump cursor TO definition reference:
    // find the reference whose brackets contain the cursor on this line,
    // then place the cursor at that footnote's definition line. This runs on
    // every keypress of both commands and a whole-document scan here is
    // measurable on large notes, so the raw line gates first — masking
    // (which needs the whole document for fence state) only runs when
    // the caret actually sits on something reference-shaped.
    const rawReferences = footnoteReferenceMatches(lineText).map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (referenceAtCursor(rawReferences, cursorPosition.ch) === null) return false;

    // #41: re-check against the masked twin — a reference inside a fence or
    // inline code is plain text, so the press falls through to insertion.
    // The reference TEXT is re-sliced from the raw line: a code span inside
    // the name masks to NULs, and the masked name would break the definition
    // lookup and jump below (bug-masked-name-identity).
    // The context is built only past the raw gate — this step runs on
    // every press, most of which sit on plain text (perf F1)
    ctx ??= docContext(doc);
    const maskedLine = ctx.maskedLine(cursorPosition.line);
    const referencesOnLine = footnoteReferenceMatches(maskedLine).map((match) => {
        const start = match.index ?? 0;
        return {
            footnote: lineText.slice(start, start + match[0].length),
            startIndex: start,
        };
    });
    const referenceTarget = referenceAtCursor(referencesOnLine, cursorPosition.ch);

    if (referenceTarget !== null) {
        // the reference is exactly "[^name]", so the name is a positional
        // slice — regex re-extraction would stop at brackets the mask hid
        {
            const footnoteName = referenceTarget.slice(2, -1);

            // references without a definition line fall through to the
            // definition-creation paths (ids compared case-insensitively)
            if (!idListIncludes(listExistingFootnoteDefinitions(doc, ctx), footnoteName)) {
                return false;
            }

            if (popupEditingAvailable(plugin)) {
                // the popup's close callback runs LATER, after its save may
                // have edited the document — it must build a FRESH context
                void openFootnotePopup(plugin, footnoteName, () => {
                    jumpToFootnoteDefinition(footnoteName, cursorPosition, plugin, doc);
                });
                return true;
            }
            return jumpToFootnoteDefinition(footnoteName, cursorPosition, plugin, doc, ctx);
        }
    }
    return false;
}

export function addFootnoteSectionHeader(
    plugin: FootnotePlugin,
): string {
    //check if 'Enable Footnote Section Heading' is true
    //if so, return the "Footnote Section Heading"
    // else, return ""

    // a cleared-out heading value counts as no heading — the lint path
    // already treats "" that way, and "\n\n" + "" would otherwise strand
    // stray blank lines above the first footnote
    if (
        plugin.settings.enableFootnoteSectionHeading &&
        plugin.settings.footnoteSectionHeading
    ) {
        // the setting holds literal markdown (legacy plain-text values are
        // migrated on load); a blank line ALWAYS separates the heading from
        // the content above it — markdown block convention (requested
        // 2026-07-20), and it keeps a heading starting with a divider from
        // turning the line above into a setext heading
        return `\n\n${plugin.settings.footnoteSectionHeading}`;
    }
    return "";
}

// Build (don't apply) the edit that appends `[^id]: ` to the note's
// footnote definitions: right after the last existing definition block
// when there is one (issue #55 — the definitions may live under a
// mid-document heading with more content below), otherwise after the last
// non-blank line — trimming trailing blank lines if enabled, and adding a
// blank separator plus the optional section heading before the first
// footnote. Returned as data so the caller can bundle it with the reference
// insertion into a single transaction (see moveCursorAndSetJumpPoint).
export function buildDefinitionAppend(
    doc: Editor,
    footnoteId: string,
    isFirstFootnote: boolean,
    plugin: FootnotePlugin,
    ctx: DocContext = docContext(doc),
): { change: EditorChange; cursor: EditorPosition; prepend?: EditorChange } {
    const lines = ctx.lines;
    const isProtected = ctx.scan.isProtected;
    const blocks = findDefinitionBlocks(lines, isProtected, ctx.scan);
    // a non-blank line directly below the new definition would be pulled INTO
    // it — Obsidian lazily continues a definition into the next line — so
    // insertions with content below them add a trailing blank separator
    // (A4 bug, 2026-07-20). The cursor still lands on the definition line.
    const needsSeparator = (insertLine: number) =>
        insertLine + 1 < lines.length && lines[insertLine + 1].trim() !== "";
    if (blocks.length > 0) {
        const lastLine = blocks[blocks.length - 1].end;
        let text = `\n[^${footnoteId}]: `;
        const cursor = { line: lastLine + 1, ch: text.length - 1 };
        if (needsSeparator(lastLine)) text += "\n";
        return {
            change: {
                from: { line: lastLine, ch: doc.getLine(lastLine).length },
                text,
            },
            cursor,
        };
    }

    // no definitions yet — but an existing section heading in the note
    // claims the first footnote (QOL follow-up to issue #55): slot the
    // definition under it instead of appending a second heading at the end.
    // The setting is markdown that can span multiple lines, so match runs.
    if (
        plugin.settings.enableFootnoteSectionHeading &&
        plugin.settings.footnoteSectionHeading
    ) {
        const headingLines = plugin.settings.footnoteSectionHeading.split("\n");
        for (let i = 0; i + headingLines.length <= lines.length; i++) {
            const matches = headingLines.every(
                (headingLine, k) =>
                    !isProtected[i + k] && lines[i + k] === headingLine,
            );
            if (!matches) continue;
            let fromLine = i + headingLines.length - 1;
            let slotText = `\n\n[^${footnoteId}]: `;
            // reuse a blank line already separating the heading from what
            // follows, instead of doubling it
            if (fromLine + 1 < lines.length && lines[fromLine + 1] === "") {
                fromLine += 1;
                slotText = `\n[^${footnoteId}]: `;
            }
            const slotLinesAdded = slotText.split("\n").length - 1;
            const cursor = {
                line: fromLine + slotLinesAdded,
                ch: slotText.length - slotText.lastIndexOf("\n") - 1,
            };
            if (needsSeparator(fromLine)) slotText += "\n";
            return {
                change: {
                    from: { line: fromLine, ch: doc.getLine(fromLine).length },
                    text: slotText,
                },
                cursor,
            };
        }
    }

    let fromLine = doc.lastLine();
    let to: EditorPosition | undefined;
    if (plugin.settings.enableRemoveBlankLastLines) {
        while (fromLine > 0 && doc.getLine(fromLine).length === 0) {
            fromLine--;
        }
        to = { line: doc.lastLine(), ch: doc.getLine(doc.lastLine()).length };
    }
    const from = { line: fromLine, ch: doc.getLine(fromLine).length };

    let text = `\n[^${footnoteId}]: `;
    if (isFirstFootnote) {
        let heading = addFootnoteSectionHeader(plugin);
        // the heading carries its own blank line above; a blank insertion
        // line (trimming off, note ends empty) already supplies it
        if (heading && doc.getLine(fromLine).trim() === "") {
            heading = heading.slice(1);
        }
        text = heading + "\n" + text;
    }

    // cursor lands at the end of the inserted definition line
    const linesAdded = text.split("\n").length - 1;
    const cursor = {
        line: fromLine + linesAdded,
        ch: text.length - text.lastIndexOf("\n") - 1,
    };

    // The first footnote's section heading can carry a column-0 "---"
    // divider; if the note's first line is a bare unclosed "---" (a
    // thematic break), inserting that divider makes Obsidian re-read the
    // whole head as YAML frontmatter, swallowing the prose in it (same
    // hazard as preserveLeadingThematicBreak in
    // move-footnotes-to-the-bottom — verified against metadataCache,
    // 2026-08-10). A blank line prepended in the same transaction pins
    // line 0 as content; it renders identically.
    let prepend: EditorChange | undefined;
    if (isFirstFootnote && lines[0] === "---" && !isProtected[0]) {
        const candidate = lines.slice(0, fromLine + 1).join("\n") + text;
        if (scanDocument(candidate.split("\n")).isProtected[0]) {
            prepend = { from: { line: 0, ch: 0 }, text: "\n" };
            cursor.line += 1;
        }
    }
    return { change: { from, to, text }, cursor, prepend };
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

/** adjust cursor position to insert a footnote only at the end of word */
function adjustFootnotePosition(
    cursorPosition: EditorPosition,
    doc: Editor,
    lineText: string,
    plugin: FootnotePlugin
) {
    if (!plugin.settings.insertAtEndOfWord) return cursorPosition;
    const endOfWordUnderCursor = doc.wordAt(cursorPosition)?.to;
    if (!endOfWordUnderCursor) return cursorPosition; // no word under cursor

    // adjust cursor position to insert a footnote only at the end of word
    const nextChar = lineText.charAt(endOfWordUnderCursor.ch);
    if (isTrailingPunctuation(nextChar)) endOfWordUnderCursor.ch++;
    cursorPosition = endOfWordUnderCursor;
    return cursorPosition;
}

// Insert `text` at the caret of an actively edited table cell, through the
// cell's own editor so the widget handles the markdown write-back. Respects
// the end-of-word setting and leaves the cell caret `caretOffsetInText`
// characters into the inserted text (focus stays in the cell).
export function insertInTableCell(
    cell: TableCellEditor,
    plugin: FootnotePlugin,
    text: string,
    caretOffsetInText: number,
) {
    const cellText = cell.state.doc.toString();
    const head = cell.state.selection.main.head;
    const at = plugin.settings.insertAtEndOfWord
        ? endOfWordOffset(cellText, head)
        : head;
    cell.dispatch({
        changes: { from: at, insert: text },
        selection: { anchor: at + caretOffsetInText },
    });
}

// "Lint on footnote creation", popup flavor: the lint must wait for the
// popup that is about to open to close and settle — linting under it could
// renumber the id it is bound to. Registered BEFORE openFootnotePopup; the
// returned canceller is for its fallback path, where the press degrades to
// the jump flow and the immediate trigger takes over.
// Stryker disable all: popup-settle scheduling against the live workspace —
// smoke-test territory, unreachable from units (coverage-verified 2026-08-11)
function scheduleCreationLintAfterPopup(plugin: FootnotePlugin): () => void {
    if (!plugin.settings.lintOnFootnoteCreation) return () => {};
    const path =
        plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path;
    return runAfterNextPopupSettle(() => {
        lintAfterFootnoteCreation(plugin, false, path);
    });
}
// Stryker restore all

//FUNCTIONS FOR AUTONUMBERED FOOTNOTES

/**
 * The shared entry preamble of every footnote command: settle a pending
 * popup save, toggle-close an open popup (that press is consumed), then
 * resolve an editable editor. Null means the press must do nothing —
 * popup consumed it, no markdown view, a deferred view without an editor
 * (viewEditor), or Reading view, where the editor API happily edits the
 * HIDDEN buffer: one press invisibly inserted "[^]" and the next press
 * toasted about a reference the user could not see (reported 2026-08-08,
 * probed live; main.ts also disables the commands in the palette, this
 * guards programmatic invocation). ORDER MATTERS: the settle wait comes
 * BEFORE the popup toggle so a same-tick second press sees the popup the
 * first press opened (and closes it) instead of racing past it — and
 * document edits must wait for a just-closed popup's pending definition
 * save, or that save clobbers them.
 *
 * Continuation-passing ON PURPOSE: `action` runs synchronously in the SAME
 * microtask as the settle continuation and the toggle check. Returning the
 * editor to an awaiting caller instead adds a microtask hop between the
 * toggle check and the popup registration the action performs — wide
 * enough for a same-tick second press's toggle check to run first, find no
 * popup, and mint a second footnote (the 2026-07-16 regression class;
 * exactly this happened when the preamble was first extracted as a
 * value-returning helper — caught by the rapid-press smoke tests,
 * 2026-08-11).
 */
async function withEditableEditor(
    plugin: FootnotePlugin,
    action: (doc: Editor) => void | Promise<void>,
): Promise<void> {
    await settleFootnotePopupWithFeedback();
    if (toggleCloseFootnotePopup()) return;
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc) return;
    if (readingViewActive(mdView)) return;
    return action(doc);
}

/**
 * The caret guards every footnote command runs before acting, IN THIS
 * ORDER (load-bearing): an EMPTY inline footnote asks for its text before
 * the filled-inline "done typing" hop can trigger; the hop beats the
 * reference guards (an inline body can contain reference-shaped text); an
 * abandoned "[^]" asks for a name instead of nesting; an untouched
 * "[^7-]" prefix placeholder asks for a suffix. True = the press was
 * consumed (toast or hop) and the command stops. The inline/paste
 * commands additionally navigate from inside a real reference
 * (navigateReferenceIfInside) at their call sites — the autonum/named
 * commands run their own jump cascade instead.
 */
function caretGuardsHandled(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null,
): boolean {
    if (warnEmptyInlineFootnoteIfInside(doc, cell)) return true;
    if (exitInlineFootnoteIfInside(doc, cell)) return true;
    if (warnEmptyReferenceIfInside(doc, cell)) return true;
    if (warnPrefilledReferenceIfInside(plugin, doc, cell)) return true;
    return false;
}

/**
 * The shared creation tail of the autonum and named commands' popup path:
 * open the popup editor bound to the new definition. Its fallback (embed
 * registry unavailable, or a late failure) jumps to the definition
 * instead — and there a popup that failed AFTER its DOM existed is still
 * settling its teardown save, so an immediate lint would no-op behind the
 * busy gate; the settle-deferred lint registered here fires instead (E32).
 */
function openPopupForNewDefinition(
    plugin: FootnotePlugin,
    doc: Editor,
    cursorPosition: EditorPosition,
    footnoteId: string,
    definitionCursor: EditorPosition,
) {
    const cancelCreationLint = scheduleCreationLintAfterPopup(plugin);
    void openFootnotePopup(plugin, footnoteId, () => {
        moveCursorAndSetJumpPoint(doc, cursorPosition, definitionCursor, plugin, undefined, true);
        if (footnotePopupBusy()) return;
        cancelCreationLint();
        lintAfterFootnoteCreation(plugin, true);
    });
}

/** The auto-numbered command ("Insert / navigate auto-numbered footnote"): runs the decision cascade, creating "[^N]" + definition when nothing to navigate to. */
export async function insertAutonumFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, (doc) => {
        // an actively edited table cell owns the real caret; getCursor() is
        // stale there, and editing the row via the main editor corrupts the
        // table — reads use the resolved position, writes go through the cell
        const cell = activeTableCellEditor(doc);
        if (caretGuardsHandled(plugin, doc, cell)) return;
        const run = (cursorPosition: EditorPosition) => {
            const lineText = doc.getLine(cursorPosition.line);
            // ONE shared document view for the whole cascade (perf F1) — built
            // inside run() so the table-fallback path reads post-sync state
            const ctx = docContext(doc);

            if (shouldJumpFromDefinitionToReference(lineText, cursorPosition, plugin, doc, ctx))
                return;
            if (shouldJumpFromReferenceToDefinition(lineText, cursorPosition, plugin, doc, ctx))
                return;
            // caret inside a reference with NO definition: continue the half-built
            // footnote (create its definition) instead of nesting "[^N]" into the
            // brackets — parity with the named and inline keys, so an
            // accidental numbered press mid-naming is just the next step
            // (reported from beta.9 phone testing, 2026-08-09)
            if (createMatchingFootnoteDefinition(lineText, cursorPosition, plugin, doc, ctx))
                return;

            createAutonumFootnote(lineText, cursorPosition, plugin, doc, cell, ctx);
        };
        if (cell) run(resolveTableCellCursor(doc) ?? doc.getCursor());
        else runOutsideTableCell(doc, run);
    });
}


/** Cascade step 4 (autonum): insert the next-numbered reference at the caret (through `cell` when in a table) and append its definition, then popup or jump per settings. */
export function createAutonumFootnote(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null = null,
    ctx: DocContext = docContext(doc),
): boolean {
    // create new footnote with the next numerical index — namespaced by the
    // note's footnote-prefix property when set (#31) — reading the editor
    // document (the view's data buffer lags editor edits by a tick, so it
    // can't be trusted here)
    const markdownText = ctx.lines.join("\n");
    const prefix = activeFootnotePrefix(plugin, footnotePrefix(markdownText));
    // an invalid prefix blocks the insert outright (the Notice already
    // explained why) — no unprefixed fallback footnote to clean up; the
    // press was still consumed
    if (prefix === null) return true;
    const currentMax = computeNextFootnoteNumber(
        markdownText,
        prefix,
        ctx.maskedLines().join("\n"),
    );

    const footnoteId = `${prefix}${currentMax}`;
    const footnoteReference = `[^${footnoteId}]`;

    const isFirstFootnote =
        listExistingFootnoteDefinitions(doc, ctx).length === 0 && currentMax === 1;

    if (cell) {
        // the reference goes through the cell's own editor (never the main
        // editor — that races the cell's sync-back and corrupts the table);
        // the definition append is outside the table, so the main editor is safe
        insertInTableCell(cell, plugin, footnoteReference, footnoteReference.length);
        const definition = buildDefinitionAppend(doc, footnoteId, isFirstFootnote, plugin, ctx);
        // the phantom-frontmatter prepend (see buildDefinitionAppend) rides
        // the same transaction; it edits above the table, which is outside
        // the cell sub-editor's region and therefore safe (issue #28 policy)
        const definitionChanges = definition.prepend
            ? [definition.prepend, definition.change]
            : [definition.change];
        if (popupEditingAvailable(plugin)) {
            doc.transaction({ changes: definitionChanges });
            void openFootnotePopup(plugin, footnoteId, () => {
                moveCursorAndSetJumpPoint(doc, cursorPosition, definition.cursor, plugin, undefined, true);
            });
        } else {
            moveCursorAndSetJumpPoint(doc, cursorPosition, definition.cursor, plugin, definitionChanges, true);
        }
        return true;
    }

    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
    const definition = buildDefinitionAppend(doc, footnoteId, isFirstFootnote, plugin, ctx);
    const changes: EditorChange[] = [
        { from: cursorPosition, text: footnoteReference },
        definition.change,
    ];
    // the phantom-frontmatter prepend (see buildDefinitionAppend) rides the
    // same transaction; it shifts every post-transaction line down by one
    if (definition.prepend) changes.push(definition.prepend);
    const lineShift = definition.prepend ? 1 : 0;

    if (popupEditingAvailable(plugin)) {
        // type the definition in a popup instead of jumping to the bottom;
        // the cursor only moves past the new reference
        const afterReference = { line: cursorPosition.line + lineShift, ch: cursorPosition.ch + footnoteReference.length };
        doc.transaction({ changes, selection: { from: afterReference } });
        openPopupForNewDefinition(plugin, doc, cursorPosition, footnoteId, definition.cursor);
    } else {
        moveCursorAndSetJumpPoint(doc, cursorPosition, definition.cursor, plugin, changes, true);
        lintAfterFootnoteCreation(plugin, true);
    }
    return true;
}


//FUNCTIONS FOR INLINE FOOTNOTES (^[...])

/**
 * Clipboard text made safe as the body of an inline footnote. Inline
 * footnotes are single-line, so whitespace runs (including newlines)
 * collapse to one space and the result is trimmed. Balanced brackets pass
 * through (pasted markdown links keep working); if any bracket is
 * unbalanced — which would end the ^[...] early and corrupt the note —
 * every bare bracket is escaped instead (pre-escaped \[ and \] keep their
 * meaning). A dangling trailing backslash would escape the wrapper's own
 * closing "]", so it is doubled into a literal one. Empty/whitespace
 * input becomes "".
 */
export function sanitizeInlineFootnoteContent(raw: string): string {
    let text = raw.replace(/\s+/g, " ").trim();
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "\\") {
            i++; // an escaped character can't open or close anything
        } else if (c === "[") {
            depth++;
        } else if (c === "]") {
            depth--;
            if (depth < 0) break;
        }
    }
    if (depth !== 0) {
        // keep \[ and \] pairs as the balance scan understood them; escape
        // only the bare brackets
        text = text.replace(/\\[\s\S]|[[\]]/g, (m) =>
            m.length === 2 ? m : `\\${m}`,
        );
    }
    // an odd trailing backslash run leaves one backslash escaping the
    // wrapper's closing "]" — double it so it renders literally instead
    const trailing = /\\*$/.exec(text);
    if (trailing && trailing[0].length % 2 === 1) {
        text += "\\";
    }
    return text;
}

// Shared tail of both inline commands: place `text` at the caret (through
// the cell sub-editor inside tables — see the table notes above) with the
// caret landing `caretOffsetInText` characters into the insertion.
function insertInlineText(
    plugin: FootnotePlugin,
    text: string,
    caretOffsetInText: number,
) {
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const doc = mdView && viewEditor(mdView);
    if (!doc) return;

    const cell = activeTableCellEditor(doc);
    if (cell) {
        insertInTableCell(cell, plugin, text, caretOffsetInText);
        return;
    }
    runOutsideTableCell(doc, (cursorPosition) => {
        const lineText = doc.getLine(cursorPosition.line);
        const at = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
        const newCursorPos = { line: at.line, ch: at.ch + caretOffsetInText };
        moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
            { from: at, text },
        ]);
    });
}

/**
 * The inline footnote whose brackets contain `ch` on `lineText`, as its
 * `open` ("^" index) and `close` ("]" index), or null. Bracket matching is
 * escape-aware and steps over nested balanced pairs (markdown links).
 * "Inside" spans from just after the `^` through the closing `]` itself.
 */
export function inlineFootnoteSpanAt(
    lineText: string,
    ch: number,
): { open: number; close: number } | null {
    for (let i = 0; i < lineText.length - 1; i++) {
        const c = lineText[i];
        if (c === "\\") {
            i++;
            continue;
        }
        if (c !== "^" || lineText[i + 1] !== "[") continue;

        let depth = 0;
        let close = -1;
        for (let j = i + 1; j < lineText.length; j++) {
            const cj = lineText[j];
            if (cj === "\\") {
                j++;
            } else if (cj === "[") {
                depth++;
            } else if (cj === "]") {
                depth--;
                if (depth === 0) {
                    close = j;
                    break;
                }
            }
        }
        // this candidate never closes, so it isn't an inline footnote — a
        // LATER "^[" on the line may still close (its opening "[" was
        // counted as nesting above), so keep scanning instead of bailing
        if (close === -1) continue;
        if (ch > i && ch <= close) return { open: i, close };
        i = close; // cursor isn't in this one — keep scanning after it
    }
    return null;
}

/** The position just past an inline footnote's closing bracket when `ch` sits inside one, or null. */
export function inlineFootnoteExitCh(lineText: string, ch: number): number | null {
    const span = inlineFootnoteSpanAt(lineText, ch);
    return span === null ? null : span.close + 1;
}

/**
 * When the caret sits strictly inside a "[^x]" reference, handle the press the
 * way the numbered/named commands would — jump to (or popup-edit) the
 * reference's definition, creating it when missing — and report true. The reverse
 * of exitInlineFootnoteIfInside (QOL, 2026-07-20), shared by both inline
 * commands: inserting "^[…]" into a reference would corrupt it ("[^na^[]med]"),
 * so the inline hotkeys navigate there instead.
 */
export function navigateReferenceIfInside(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null,
): boolean {
    const cursorPosition =
        (cell ? resolveTableCellCursor(doc) : null) ?? doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    // raw-line gate first — masking needs the whole document, and this runs
    // on every inline-command press (same rationale as
    // shouldJumpFromReferenceToDefinition)
    const rawReferences = footnoteReferenceMatches(lineText).map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (referenceAtCursor(rawReferences, cursorPosition.ch) === null) return false;

    // the masked twin decides for real: a "[^x]" inside code is plain text,
    // and inserting an inline footnote there is fine (#41 semantics).
    // One shared context past the gate serves the rest of the press (F1)
    const ctx = docContext(doc);
    const maskedLine = ctx.maskedLine(cursorPosition.line);
    const referencesOnLine = footnoteReferenceMatches(maskedLine).map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (referenceAtCursor(referencesOnLine, cursorPosition.ch) === null) return false;

    if (shouldJumpFromReferenceToDefinition(lineText, cursorPosition, plugin, doc, ctx))
        return true;
    if (createMatchingFootnoteDefinition(lineText, cursorPosition, plugin, doc, ctx))
        return true;
    // however the cascade resolved (e.g. an invalid name's warning), the
    // press is handled — "^[…]" must never land inside the reference
    return true;
}

/**
 * Inline-footnote command: inserts `^[]` with the caret between the
 * brackets for quick writing. A second press while the cursor is still
 * inside an inline footnote instead hops it just past the closing bracket,
 * so typing continues without reaching for the arrow keys. Inside a
 * regular "[^x]" reference the press navigates like the numbered/named
 * commands instead of nesting.
 */
export async function insertInlineFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, (doc) => {
        const cell = activeTableCellEditor(doc);
        if (caretGuardsHandled(plugin, doc, cell)) return;
        // inside a real reference, navigate instead of nesting "^[]"
        if (navigateReferenceIfInside(plugin, doc, cell)) return;

        insertInlineText(plugin, "^[]", 2);
    });
}

/**
 * When the caret sits inside an EMPTY inline footnote ("^[]", or only
 * whitespace between the brackets), leave it where it is, ask for the text
 * via a Notice, and report true. Shared by every footnote command, exactly
 * like the empty "[^]" reference guard (manual combo-test feedback,
 * 2026-08-08): a second press used to silently hop the caret out,
 * stranding an inline footnote with nothing in it. A FILLED inline
 * footnote is not this guard's business — there the press falls through
 * to exitInlineFootnoteIfInside, the deliberate "done typing" hop.
 */
function warnEmptyInlineFootnoteIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
): boolean {
    const text = cell
        ? cell.state.doc.toString()
        : doc.getLine(doc.getCursor().line);
    const ch = cell ? cell.state.selection.main.head : doc.getCursor().ch;
    const span = inlineFootnoteSpanAt(text, ch);
    if (span === null) return false;
    if (text.slice(span.open + 2, span.close).trim() !== "") return false;
    new Notice(
        "This inline footnote is empty. Type its text between the brackets.",
        8000,
    );
    return true;
}

/**
 * When the caret sits inside an inline footnote ("^[...]"), hop it just
 * past the closing bracket and report true. Shared by every insert
 * command: for the numbered/named ones this prevents nesting a "[^x]"
 * reference inside the inline footnote's brackets, which would end the inline
 * footnote early and corrupt it ("^[in [^named]line]").
 */
export function exitInlineFootnoteIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
): boolean {
    if (cell) {
        const exit = inlineFootnoteExitCh(
            cell.state.doc.toString(),
            cell.state.selection.main.head,
        );
        if (exit === null) return false;
        cell.dispatch({ selection: { anchor: exit } });
        return true;
    }
    const cursorPosition = doc.getCursor();
    const exit = inlineFootnoteExitCh(
        doc.getLine(cursorPosition.line),
        cursorPosition.ch,
    );
    if (exit === null) return false;
    doc.setCursor({ line: cursorPosition.line, ch: exit });
    return true;
}

/** Inline-footnote paste command: inserts `^[<clipboard>]` with the caret after it. Inside a "[^x]" reference it navigates like the named command instead (the clipboard stays untouched). */
export async function pasteInlineFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, async (doc) => {
        const pasteCell = activeTableCellEditor(doc);
        // the same guards every other insert command runs (missed here until
        // the 2026-08-07 QOL sweep; pinned by test/paste-inline-in-inline.test.ts)
        if (caretGuardsHandled(plugin, doc, pasteCell)) return;
        if (navigateReferenceIfInside(plugin, doc, pasteCell)) return;

        // read the clipboard BEFORE resolving positions — it's the only await,
        // and everything position-dependent should happen after it
        let raw: string;
        try {
            raw = await navigator.clipboard.readText();
        } catch {
            new Notice("Couldn't read the clipboard.");
            return;
        }
        const content = sanitizeInlineFootnoteContent(raw);
        if (!content) {
            new Notice("The clipboard is empty, so there is nothing to put in an inline footnote.");
            return;
        }
        const text = `^[${content}]`;
        insertInlineText(plugin, text, text.length);
    });
}

//FUNCTIONS FOR NAMED FOOTNOTES

/** The named command ("Insert / navigate named footnote"): same cascade, but creation is two-step — first press inserts "[^]" for name entry, next press (caret on the named reference) creates its definition. */
export async function insertNamedFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, (doc) => {
        // an actively edited table cell owns the real caret; getCursor() is
        // stale there, and editing the row via the main editor corrupts the
        // table — reads use the resolved position, writes go through the cell
        const cell = activeTableCellEditor(doc);
        if (caretGuardsHandled(plugin, doc, cell)) return;
        const run = (cursorPosition: EditorPosition) => {
            const lineText = doc.getLine(cursorPosition.line);
            // ONE shared document view for the whole cascade (perf F1)
            const ctx = docContext(doc);

            if (shouldJumpFromDefinitionToReference(lineText, cursorPosition, plugin, doc, ctx))
                return;
            if (shouldJumpFromReferenceToDefinition(lineText, cursorPosition, plugin, doc, ctx))
                return;

            if (createMatchingFootnoteDefinition(lineText, cursorPosition, plugin, doc, ctx))
                return;
            createFootnoteReference(lineText, cursorPosition, plugin, doc, cell);
        };
        if (cell) run(resolveTableCellCursor(doc) ?? doc.getCursor());
        else runOutsideTableCell(doc, run);
    });
}

/** Cascade step 3 (numbered, named, and the inline keys via navigateReferenceIfInside): caret on a reference with no definition → append the matching definition (or warn on an invalid name). Returns true when it handled the press. The note's footnote-prefix is NOT applied here — it goes in at bracket creation (createFootnoteReference), where the user can see it. */
export function createMatchingFootnoteDefinition(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx?: DocContext,
): boolean {
    // Create matching footnote definition for footnote reference

    // is the cursor inside a footnote reference on this line?
    // does that reference have a definition line?
    // if not, create it and place cursor there
    // (raw-line gate first, masked re-check after — same rationale and
    // #41 semantics as shouldJumpFromReferenceToDefinition above)
    const rawReferences = footnoteReferenceMatches(lineText).map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (referenceAtCursor(rawReferences, cursorPosition.ch) === null) {
        return false;
    }

    // built only past the raw gate (perf F1)
    ctx ??= docContext(doc);
    const maskedLine = ctx.maskedLine(cursorPosition.line);
    // re-slice the raw line for the reference text — a code span inside the
    // name masks to NULs, and creating a definition from the masked name wrote
    // literal NUL bytes into the note (bug-masked-name-identity)
    const referencesOnLine = footnoteReferenceMatches(maskedLine).map((match) => {
        const start = match.index ?? 0;
        return {
            footnote: lineText.slice(start, start + match[0].length),
            startIndex: start,
        };
    });
    const referenceTarget = referenceAtCursor(referencesOnLine, cursorPosition.ch);

    if (referenceTarget !== null) {
        //find if this footnote exists by listing existing footnote definitions
        {
            // positional slice of "[^name]" — see shouldJumpFromReferenceToDefinition
            const footnoteId = referenceTarget.slice(2, -1);

            // a spaced or backticked name is an authoring mistake Obsidian
            // won't render; warn instead of creating a definition that can't work
            if (!isValidFootnoteName(footnoteId)) {
                const offender = footnoteId.includes("`")
                    ? "backticks"
                    : "spaces";
                new Notice(
                    `Footnote name "${footnoteId}" contains ${offender}, so Obsidian won't render it as a footnote. Remove the ${offender}.`,
                    8000,
                );
                return true;
            }

            const list = listExistingFootnoteDefinitions(doc, ctx);

            // Check if the list doesn't include current footnote (ids are
            // case-insensitive — a "[^note]:" definition already covers a
            // "[^Note]" reference, so this must navigate, not create a duplicate)
            // if so, add definition for the current footnote
            if (!idListIncludes(list, footnoteId)) {
                const definition = buildDefinitionAppend(doc, footnoteId, list.length === 0, plugin, ctx);
                // the phantom-frontmatter prepend rides the same
                // transaction (see buildDefinitionAppend)
                const definitionChanges = definition.prepend
                    ? [definition.prepend, definition.change]
                    : [definition.change];

                if (popupEditingAvailable(plugin)) {
                    // type the definition in a popup instead of jumping to the
                    // bottom; the cursor stays on the reference
                    doc.transaction({ changes: definitionChanges });
                    openPopupForNewDefinition(plugin, doc, cursorPosition, footnoteId, definition.cursor);
                } else {
                    moveCursorAndSetJumpPoint(doc, cursorPosition, definition.cursor, plugin, definitionChanges, true);
                    lintAfterFootnoteCreation(plugin, true);
                }

                return true;
            }
            // the reference already has a definition — not this step's
            // press to handle; the cascade continues
            return false;
        }
    }
    return false;
}

/**
 * When the caret sits inside an untouched prefilled reference — "[^7-]",
 * exactly the note's footnote-prefix with no name typed yet — leave the
 * caret where it is, ask for a suffix via a Notice, and report true. The
 * prefilled reference is the prefix-era twin of the empty "[^]" placeholder;
 * a press inside it must never create a footnote named after the bare
 * prefix. It used to hop the caret out instead (like "[^]"), but staying
 * put with an explanation is easier to understand (2026-08-05).
 */
export function warnPrefilledReferenceIfInside(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null,
): boolean {
    if (!plugin.settings.enableFootnotePrefix) return false;
    // cheap gate before any document work: no "[^" near the caret means no
    // placeholder to warn about, and this guard runs on EVERY command press
    const rawText = cell
        ? cell.state.doc.toString()
        : doc.getLine(doc.getCursor().line);
    if (!rawText.includes("[^")) return false;
    const prefix = footnotePrefixFromEditor(doc);
    // silent validity check — the invalid-prefix Notice belongs to the
    // insert path, not to every caret movement guard
    if (!prefix || footnotePrefixProblem(prefix) !== null) return false;
    const placeholder = `[^${prefix}]`;
    if (!caretInsidePlaceholder(doc, cell, placeholder)) return false;
    new Notice("Please add a footnote suffix after the prefix.");
    return true;
}

/**
 * Whether the caret sits strictly inside a live occurrence of `placeholder`
 * ("[^]" or the prefilled "[^7-]"), in the cell's text or the caret's line.
 * A raw hit is confirmed against the code-masked text — a placeholder-shaped
 * fragment inside inline code or a fence is plain text (#41 semantics), and
 * warning there would block a legitimate insert. The raw gate keeps the
 * whole-document masking off the hot path (this runs on every press).
 */
function caretInsidePlaceholder(
    doc: Editor,
    cell: TableCellEditor | null,
    placeholder: string,
): boolean {
    if (cell) {
        const head = cell.state.selection.main.head;
        const cellText = cell.state.doc.toString();
        if (emptyReferenceStart(cellText, head, placeholder) === null) return false;
        // cell text is a single line, so line-local masking suffices
        return emptyReferenceStart(maskInlineRegions(cellText), head, placeholder) !== null;
    }
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    if (emptyReferenceStart(lineText, cursorPosition.ch, placeholder) === null) {
        return false;
    }
    const maskedLine =
        maskedLineAt(docLines(doc), cursorPosition.line);
    return emptyReferenceStart(maskedLine, cursorPosition.ch, placeholder) !== null;
}

/**
 * When the caret sits inside an abandoned empty reference "[^]", leave it
 * where it is, ask for a name via a Notice, and report true. Shared by
 * every footnote command (QOL sweep, 2026-08-07): "[^]" is invisible to
 * the reference regexes (they require a non-empty name), so without this
 * guard the numbered/inline commands nested their insertion INTO the
 * brackets ("[^[^1]]") and the named command silently hopped the caret
 * out — a warning is the one response that tells the user what the
 * fragment is and how to fix it.
 */
function warnEmptyReferenceIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
): boolean {
    if (!caretInsidePlaceholder(doc, cell, "[^]")) return false;
    new Notice(
        "This footnote reference is empty. Type a name between the brackets.",
        8000,
    );
    return true;
}

/** Cascade step 4 (named): insert an empty reference (through `cell` when in a table) ready for name entry — "[^]" with the caret between the brackets, or "[^7-]" with the caret after the prefix when the note's footnote-prefix is active, so the namespace is visible while the name is typed (requested 2026-07-20). A press with the caret still inside an empty "[^]" never reaches this step — warnEmptyReferenceIfInside claims it at the command entry — but the hop-out branches below stay as a last line of defense against nesting "[^[^]]". */
export function createFootnoteReference(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null = null,
): boolean {
    //create empty footnote reference for name input, cursor after [^ and any
    //prefix. The prefix gate runs AFTER the second-press hop checks: an
    //invalid prefix blocks reference CREATION (toast only, nothing to clean
    //up — reported 2026-08-07), but never plain caret navigation.
    // footnotePrefixFromEditor stops at the closing frontmatter fence —
    // the old doc.getValue() materialized the whole document per press
    // (the half of F1 this path had missed)
    const resolvePrefix = () =>
        plugin.settings.enableFootnotePrefix
            ? activeFootnotePrefix(plugin, footnotePrefixFromEditor(doc))
            : "";

    if (cell) {
        const cellText = cell.state.doc.toString();
        // masked confirm like caretInsidePlaceholder: a "[^]"-shaped
        // fragment inside inline code is plain text (#41 semantics)
        const inEmpty = emptyReferenceStart(cellText, cell.state.selection.main.head);
        if (
            inEmpty !== null &&
            emptyReferenceStart(
                maskInlineRegions(cellText),
                cell.state.selection.main.head,
            ) !== null
        ) {
            cell.dispatch({ selection: { anchor: inEmpty + "[^]".length } });
            return true;
        }
        const prefix = resolvePrefix();
        if (prefix === null) return true;
        // through the cell's own editor (never the main editor — that races
        // the cell's sync-back and corrupts the table); the caret lands
        // inside the brackets and focus stays in the cell for name entry
        insertInTableCell(cell, plugin, `[^${prefix}]`, 2 + prefix.length);
        return true;
    }

    const inEmpty = emptyReferenceStart(lineText, cursorPosition.ch);
    if (
        inEmpty !== null &&
        emptyReferenceStart(
            maskInlineRegions(lineText),
            cursorPosition.ch,
        ) !== null
    ) {
        doc.setCursor({ line: cursorPosition.line, ch: inEmpty + "[^]".length });
        return true;
    }

    const prefix = resolvePrefix();
    if (prefix === null) return true;
    const emptyReference = `[^${prefix}]`;
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
    const newCursorPos = {
        line: cursorPosition.line,
        ch: cursorPosition.ch + 2 + prefix.length,
    };
    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
        { from: cursorPosition, text: emptyReference },
    ]);
    return true;
}
