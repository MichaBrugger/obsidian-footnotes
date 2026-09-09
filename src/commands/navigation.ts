import { Editor, EditorPosition } from "obsidian";

import type FootnotePlugin from "../main";
import { moveCursorAndSetJumpPoint } from "../editor/cursor-motion";
import {
    DocContext,
    docContext,
    listExistingFootnoteDefinitions,
    referenceOccurrenceAtCursor,
} from "../editor/doc-context";
import {
    definitionLabelWithName,
    idListIncludes,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { openFootnotePopup, popupEditingAvailable } from "./footnote-popup";
import { definitionLabelIn } from "../parsing/markdown-scan";

import { addReferenceOrDeleteDefinition, showNotice } from "../editor/notice";
// The jump half of the decision cascade. From a definition it jumps to the
// first reference; from a reference it jumps to its definition, or opens the
// popup editor when that setting is on.
//
// This file imports the popup but never the linter, so that the linter can
// depend on jumps without the two importing each other in a circle. Split
// out of the all-in-one commands file 2026-08-11.

/** Cascade step 1: with the caret on a definition line, jump to the first place that footnote is referenced. Returns whether it handled the press. */
export function shouldJumpFromDefinitionToReference(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx?: DocContext,
): boolean {
    // work out whether the caret is on a definition line ("[^1]: footnote")
    // or on one of its continuation lines. If it is, jump back to the
    // footnote's reference in the text.

    // a cheap check on the raw line first. The whole-document scanning below
    // only runs when the caret sits on something definition-shaped: the
    // "[^x]:" line itself, or an indented line that MIGHT be a continuation
    // line. That second case matters because jumping to a definition parks
    // the caret on the LAST continuation line on purpose, and pressing the
    // hotkey there used to insert a new footnote instead of jumping back
    // (bug reported 2026-07-17).
    if (definitionLabelIn(lineText) === null && !/^\s+\S/.test(lineText)) return false;

    // #41: a "[^x]:" inside a code block is not a definition, and a
    // reference inside code is not somewhere to jump to. So look the
    // definition up in blocks that know about protected text, and scan the
    // masked twin (the copy of the note with protected text blanked out).
    // This reading of the document is only built once past the raw-line
    // check above, which exists because this runs on every press
    // (perf F1/F8).
    ctx ??= docContext(doc);
    const lines = ctx.lines;
    // the single scan for protected text that this press makes feeds both
    // the block lookup and the masking
    const block = ctx.blocks().find(
        (candidate) =>
            cursorPosition.line >= candidate.start &&
            cursorPosition.line <= candidate.end,
    );
    let definitionName: string | null = null;
    if (block) {
        definitionName = block.name;
    } else {
        // a label inside a blockquote or callout ("> [^x]: …", C22) is a
        // definition too, but it never belongs to a definition BLOCK, which
        // only forms at the start of a line. Match against the caret line's
        // masked twin instead.
        const hit = definitionLabelWithName(
            lineText,
            ctx.maskedLine(cursorPosition.line),
        );
        if (hit?.label.quoted && ctx.definitionStarts()[cursorPosition.line]) {
            definitionName = hit.name;
        }
    }
    if (definitionName !== null) {
        // footnote names ignore case, so a reference can be cased
        // differently from its definition's label ("[^Note]" and "[^note]:"
        // are the same footnote). Lowercase both before comparing.
        const name = definitionName.toLowerCase();
        const masked = ctx.maskedLines();

        // find the FIRST place this footnote is referenced. A label defines
        // a footnote wherever it appears; it never counts as a reference to
        // it. referenceOccurrences therefore skips a line's own label,
        // whether it starts the line or sits in a blockquote. Without that,
        // jumping could land on a blockquoted duplicate's label, a target
        // that is not really there (parallel-review probe 2026-08-10;
        // the exclusion was centralized 2026-09-08).
        const useStarts = ctx.definitionStarts();
        for (let i = 0; i < masked.length; i++) {
            for (const use of referenceOccurrences(lines[i], masked[i], useStarts[i])) {
                if (use.name.toLowerCase() !== name) continue;
                const newCursorPos = { line: i, ch: use.end };
                moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, undefined, true);
                return true;
            }
        }
        // this is an orphaned definition: nothing references it anywhere.
        // Falling through from here used to insert a brand-new footnote INTO
        // the definitions area, when the user had almost certainly pressed
        // the key to jump to a reference they have since deleted. Explain
        // instead, and change nothing (QOL sweep, 2026-08-07).
        showNotice(
            `Nothing references this footnote. ${addReferenceOrDeleteDefinition(definitionName)}`,
            8000,
        );
        return true;
    }
    return false;
}

/** Move the caret to the end of the named footnote's definition, counting its indented continuation lines as part of it. */
export function jumpToFootnoteDefinition(
    footnoteName: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx: DocContext = docContext(doc),
): boolean {
    // find the LAST line carrying this definition label. When a note has
    // duplicate definitions, Obsidian renders only the last of them
    // (ground-truthed 2026-08-12), so jumping to an earlier one would land
    // the user on text nobody sees. The matching runs on the masked twin
    // (the copy of the note with protected text blanked out) so that
    // definition-shaped lines inside code do not count (#41). Labels inside
    // a blockquote or callout do count (C22).
    const lines = ctx.lines;
    const masked = ctx.maskedLines();
    const starts = ctx.definitionStarts();
    let labelLine = -1;
    for (let i = 0; i < masked.length; i++) {
        if (!starts[i]) continue;
        // names ignore case: the definition's label may be cased differently
        // from the reference name that sent us here
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (hit && hit.name.toLowerCase() === footnoteName.toLowerCase()) {
            labelLine = i;
        }
    }
    if (labelLine !== -1) {
        // land at the END of the definition, continuation lines included,
        // so the user can backspace or type without reaching for the arrow
        // keys. How far the definition block reaches comes from
        // findDefinitionBlocks itself. A walk written by hand here stopped
        // at runs of blank lines and inside regions the block walk absorbs,
        // which left the caret in the middle of a definition (2026-08-11
        // review bug #12). A label in a blockquote never belongs to a
        // block, so its own line is where the caret lands.
        const block = ctx.blocks().find((candidate) => candidate.start === labelLine);
        const endLine = block ? block.end : labelLine;
        const newCursorPos = { line: endLine, ch: doc.getLine(endLine).length };
        moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, undefined, true);
        return true;
    }
    return false;
}

/** Cascade step 2: with the caret on a reference that HAS a definition, open the popup editor on it when that setting is on, or else jump to it. A reference with no definition returns false, so the creation step runs instead. */
export function shouldJumpFromReferenceToDefinition(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx?: DocContext,
): boolean {
    // Jump from the reference to its definition: find the reference whose
    // brackets hold the cursor on this line, then put the cursor on that
    // footnote's definition line.
    //
    // The shared lookup checks the raw line before it consults the masked
    // twin. This runs on every press of both commands, and the
    // whole-document scan is slow enough to notice on large notes (perf F1,
    // the #41 re-check against the mask, and a name re-slice that survives
    // NUL characters; see referenceOccurrenceAtCursor).
    const hit = referenceOccurrenceAtCursor(lineText, cursorPosition, doc, ctx);
    if (hit === null) return false;
    ctx = hit.ctx;
    const footnoteName = hit.target.name;

    // a reference with no definition line falls through to the steps that
    // create one. Names are compared ignoring case.
    if (!idListIncludes(listExistingFootnoteDefinitions(doc, ctx), footnoteName)) {
        return false;
    }

    if (popupEditingAvailable(plugin)) {
        // the popup's fallback callback runs LATER, by which time its save
        // may have edited the document, so it must build a FRESH reading of
        // the document rather than reuse this one
        void openFootnotePopup(plugin, footnoteName, () => {
            jumpToFootnoteDefinition(footnoteName, cursorPosition, plugin, doc);
        });
        return true;
    }
    return jumpToFootnoteDefinition(footnoteName, cursorPosition, plugin, doc, ctx);
}
