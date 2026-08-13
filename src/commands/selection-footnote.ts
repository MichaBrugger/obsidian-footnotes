import { Editor, EditorChange, EditorPosition, Notice } from "obsidian";

import type FootnotePlugin from "../main";
import {
    computeNextFootnoteNumber,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { activeFootnotePrefix, footnotePrefixFromEditor } from "../parsing/footnote-prefix";
import { moveCursorAndSetJumpPoint } from "../editor/cursor-motion";
import { buildDefinitionAppend, seedDefinitionBody } from "./definition-append";
import { DocContext, docContext, listExistingFootnoteDefinitions } from "../editor/doc-context";
import { openFootnotePopup, popupEditingAvailable } from "./footnote-popup";
import { inlineFootnoteSpanAt, sanitizeInlineFootnoteContent } from "./inline-footnotes";
import {
    ProtectedCreationNotice,
    simulateChanges,
    simulatedAnchor,
    simulatedMaskedLine,
} from "../editor/insertion-liveness";
import {
    findDefinitionBlocks,
    maskInlineRegions,
    maskedLineAt,
    scanDocument,
} from "../parsing/markdown-scan";
import { openPopupForNewDefinition, replaceInTableCell } from "./create-footnote";
import { TableCellEditor } from "../editor/table-cursor";

// Turning a selection into a footnote (issue #35): a creation press with a
// live selection REPLACES the selected text instead of inserting at the
// caret — the auto-numbered key moves it into a new definition's body, the
// inline key wraps it as "^[…]" in place. The named and paste keys can't
// carry a body (name entry is a second press; the clipboard already IS the
// body), so they redirect with a Notice rather than silently ignoring the
// selection. Always on, no toggle (Jason's call, 2026-08-12): a press with
// a selection previously inserted at the stale caret, which served nobody.

export const SelectionSpanNotice =
    "Select one stretch of text on a single line to turn it into a footnote.";
export const SelectionCommandNotice =
    "To turn the selected text into a footnote, use the auto-numbered or inline footnote command.";

export type FootnoteCommandKind = "autonum" | "named" | "inline" | "paste";

/**
 * The selection claim every creation command checks first: when a usable
 * selection exists, convert it (autonum/inline), or explain why this key
 * can't (named/paste, multi-line, multiple selections) — either way the
 * press is consumed (true). False = no usable selection; the normal caret
 * cascade owns the press. A whitespace-only selection counts as none —
 * there is no text to move into a footnote.
 *
 * `cursorPosition` is the RESOLVED document caret the autonum/named
 * commands already hold (table sub-editor fallback); the cell conversion's
 * definition jump falls back to getCursor() without it.
 */
export function selectionPressHandled(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null,
    command: FootnoteCommandKind,
    cursorPosition?: EditorPosition,
): boolean {
    if (cell) {
        // the cell sub-editor owns the real selection while a table cell is
        // being edited — the main editor's is stale (see table-cursor.ts)
        const { anchor, head } = cell.state.selection.main;
        if (anchor === head) return false;
        const cellText = cell.state.doc.toString();
        let from = Math.min(anchor, head);
        let to = Math.max(anchor, head);
        while (from < to && /\s/.test(cellText[from])) from++;
        while (to > from && /\s/.test(cellText[to - 1])) to--;
        if (from === to) return false;
        if (command === "named" || command === "paste") {
            new Notice(SelectionCommandNotice, 8000);
            return true;
        }
        // protected text is refused UP FRONT, not just simulated: the
        // liveness checks prove the RESULT is live, but a selection that
        // eats a delimiter can make a live result out of destroying the
        // construct (see the main-editor twin below)
        if (maskInlineRegions(cellText).slice(from, to).includes("\0")) {
            new Notice(ProtectedCreationNotice, 8000);
            return true;
        }
        const text = cellText.slice(from, to);
        if (command === "inline") {
            const wrapped = `^[${sanitizeInlineFootnoteContent(text)}]`;
            // liveness refusal (with its own Notice) happens inside
            replaceInTableCell(cell, wrapped, from, to, wrapped.length);
            return true;
        }
        convertCellSelectionToAutonum(
            plugin,
            doc,
            cell,
            { from, to, text },
            cursorPosition,
        );
        return true;
    }

    const resolved = normalizedMainSelection(doc);
    if (resolved === null) return false;
    if (resolved === "multi") {
        new Notice(SelectionSpanNotice, 8000);
        return true;
    }
    // shrink to the non-whitespace core: a selection made by double-click
    // or drag routinely carries an edge space, and that space belongs to
    // the prose, not to the footnote
    const lineText = doc.getLine(resolved.from.line);
    let fromCh = resolved.from.ch;
    let toCh = resolved.to.ch;
    while (fromCh < toCh && /\s/.test(lineText[fromCh])) fromCh++;
    while (toCh > fromCh && /\s/.test(lineText[toCh - 1])) toCh--;
    if (fromCh === toCh) return false;
    if (command === "named" || command === "paste") {
        new Notice(SelectionCommandNotice, 8000);
        return true;
    }
    // protected text is refused UP FRONT, not just simulated: the born-dead
    // checks prove the RESULT is live, but a selection that eats a
    // delimiter makes a live result out of DESTROYING the construct —
    // wrapping the first backtick of a fence opener un-fenced everything
    // below it (found by the conversion property, 2026-08-12). Any masked
    // character inside the trimmed span, or a span on a protected line,
    // means the selected text belongs to code/math/comment territory.
    const ctx = docContext(doc);
    if (
        ctx.scan.isProtected[resolved.from.line] ||
        ctx.maskedLine(resolved.from.line).slice(fromCh, toCh).includes("\0")
    ) {
        new Notice(ProtectedCreationNotice, 8000);
        return true;
    }
    const selection = {
        from: { line: resolved.from.line, ch: fromCh },
        to: { line: resolved.from.line, ch: toCh },
        text: lineText.slice(fromCh, toCh),
    };
    if (command === "inline") {
        convertMainSelectionToInline(plugin, doc, selection);
    } else {
        convertMainSelectionToAutonum(plugin, doc, selection, ctx);
    }
    return true;
}

/**
 * The main editor's one usable selection range, oriented from ≤ to:
 * null = nothing selected, "multi" = unconvertible (multiple selection
 * ranges, or a range spanning lines — a footnote body is single-line). A
 * full-line drag ends at ch 0 of the NEXT line; that shape converts as
 * "to the end of the selected line" instead of refusing.
 */
function normalizedMainSelection(
    doc: Editor,
): { from: EditorPosition; to: EditorPosition } | "multi" | null {
    const posCmp = (a: EditorPosition, b: EditorPosition) =>
        a.line - b.line || a.ch - b.ch;
    const ranges = doc
        .listSelections()
        .filter((range) => posCmp(range.anchor, range.head) !== 0);
    if (ranges.length === 0) return null;
    if (ranges.length > 1) return "multi";
    let from = ranges[0].anchor;
    let to = ranges[0].head;
    if (posCmp(from, to) > 0) [from, to] = [to, from];
    if (to.line === from.line + 1 && to.ch === 0) {
        to = { line: from.line, ch: doc.getLine(from.line).length };
    }
    if (to.line !== from.line) return "multi";
    return { from, to };
}

// The inline flavor: the selection becomes "^[…]" in place, caret after
// the closing bracket — the sanitizer (shared with paste) collapses
// whitespace and escapes unbalanced brackets so the wrapper can't end
// early. Same born-dead refusal as insertInlineText: the span must survive
// on the masked simulated line (a selection inside protected text, or one
// whose removal completes a construct around it, dies here).
function convertMainSelectionToInline(
    plugin: FootnotePlugin,
    doc: Editor,
    selection: { from: EditorPosition; to: EditorPosition; text: string },
): void {
    const text = `^[${sanitizeInlineFootnoteContent(selection.text)}]`;
    const masked = simulatedMaskedLine(doc, selection.from, text, selection.to.ch);
    if (inlineFootnoteSpanAt(masked, selection.from.ch + 2)?.open !== selection.from.ch) {
        new Notice(ProtectedCreationNotice, 8000);
        return;
    }
    const after = { line: selection.from.line, ch: selection.from.ch + text.length };
    moveCursorAndSetJumpPoint(doc, selection.from, after, plugin, [
        { from: selection.from, to: selection.to, text },
    ]);
}

// The auto-numbered flavor: the selection is replaced by the next-numbered
// reference and moved into that footnote's definition body — then popup or
// jump per settings, exactly like createAutonumFootnote. The simulate-and-
// verify step matters MORE here than for a plain insert: deleting the
// selection can un-close a construct (its closer was selected) and the
// seeded body travels arbitrary text into the definition line.
function convertMainSelectionToAutonum(
    plugin: FootnotePlugin,
    doc: Editor,
    selection: { from: EditorPosition; to: EditorPosition; text: string },
    ctx: DocContext,
): void {
    const prefix = activeFootnotePrefix(plugin, footnotePrefixFromEditor(doc));
    // an invalid prefix blocks the conversion outright (the Notice already
    // explained why); the press was still consumed
    if (prefix === null) return;
    const masked = ctx.maskedLines().join("\n");
    const footnoteId = `${prefix}${computeNextFootnoteNumber(masked, prefix, masked)}`;
    const footnoteReference = `[^${footnoteId}]`;
    const isFirstFootnote = listExistingFootnoteDefinitions(doc, ctx).length === 0;

    const definition = seedDefinitionBody(
        buildDefinitionAppend(doc, footnoteId, isFirstFootnote, plugin, ctx),
        footnoteId,
        selection.text,
    );
    const changes: EditorChange[] = [
        { from: selection.from, to: selection.to, text: footnoteReference },
        definition.change,
    ];
    if (definition.prepend) changes.push(definition.prepend);

    // same verification as createAutonumFootnote: the new reference must be
    // live and its definition must parse as a live block on the SIMULATED
    // result; refuse like the protected-caret guard otherwise. The
    // reference is re-found through simulatedAnchor — a definition appended
    // ABOVE the selection shifts every later line (entry-corpus find,
    // 2026-08-12)
    const simulated = simulateChanges(ctx.lines, changes);
    const simulatedScan = scanDocument(simulated);
    const definitionLive = findDefinitionBlocks(
        simulated,
        simulatedScan.isProtected,
        simulatedScan,
    ).some((block) => block.start === definition.cursor.line);
    const referenceAnchor = simulatedAnchor(ctx.lines, changes, 0, simulated);
    const referenceLive = referenceOccurrences(
        simulated[referenceAnchor.line],
        maskedLineAt(simulated, referenceAnchor.line),
    ).some(
        (occurrence) =>
            occurrence.start === referenceAnchor.ch &&
            occurrence.name === footnoteId,
    );
    if (!definitionLive || !referenceLive) {
        new Notice(ProtectedCreationNotice, 8000);
        return;
    }

    if (popupEditingAvailable(plugin)) {
        // edit the pre-filled definition in a popup; the cursor only moves
        // past the new reference
        // Stryker disable all: popup arm — units run popup-off, so mutants
        // here are no-coverage noise; smoke territory (verified 2026-08-12)
        const afterReference = {
            line: referenceAnchor.line,
            ch: referenceAnchor.ch + footnoteReference.length,
        };
        doc.transaction({ changes, selection: { from: afterReference } });
        openPopupForNewDefinition(plugin, doc, selection.from, footnoteId, definition.cursor);
        // Stryker restore all
    } else {
        moveCursorAndSetJumpPoint(doc, selection.from, definition.cursor, plugin, changes, true);
    }
}

// The auto-numbered flavor inside an actively edited table cell: the
// reference replaces the cell selection through the cell's own editor, the
// pre-filled definition appends outside the table — mirroring
// createAutonumFootnote's cell branch, including its refused-cell
// contract: a born-dead cell replacement must not leave an orphaned
// definition behind.
function convertCellSelectionToAutonum(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor,
    selection: { from: number; to: number; text: string },
    cursorPosition?: EditorPosition,
): void {
    const ctx = docContext(doc);
    const prefix = activeFootnotePrefix(plugin, footnotePrefixFromEditor(doc));
    if (prefix === null) return;
    const masked = ctx.maskedLines().join("\n");
    const footnoteId = `${prefix}${computeNextFootnoteNumber(masked, prefix, masked)}`;
    const footnoteReference = `[^${footnoteId}]`;
    const isFirstFootnote = listExistingFootnoteDefinitions(doc, ctx).length === 0;
    if (
        !replaceInTableCell(cell, footnoteReference, selection.from, selection.to, footnoteReference.length)
    ) {
        return;
    }
    const definition = seedDefinitionBody(
        buildDefinitionAppend(doc, footnoteId, isFirstFootnote, plugin, ctx),
        footnoteId,
        selection.text,
    );
    const definitionChanges = definition.prepend
        ? [definition.prepend, definition.change]
        : [definition.change];
    const origin = cursorPosition ?? doc.getCursor();
    if (popupEditingAvailable(plugin)) {
        // Stryker disable all: popup arm — units run popup-off, so mutants
        // here are no-coverage noise; smoke territory (verified 2026-08-12)
        doc.transaction({ changes: definitionChanges });
        void openFootnotePopup(plugin, footnoteId, () => {
            moveCursorAndSetJumpPoint(doc, origin, definition.cursor, plugin, undefined, true);
        });
        // Stryker restore all
    } else {
        moveCursorAndSetJumpPoint(doc, origin, definition.cursor, plugin, definitionChanges, true);
    }
}
