import { Editor, EditorChange, EditorPosition, Modal, Notice, Setting } from "obsidian";

import type FootnotePlugin from "../main";
import {
    computeNextFootnoteNumber,
    idListIncludes,
    isValidFootnoteName,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { activeFootnotePrefix, footnotePrefixFromEditor } from "../parsing/footnote-prefix";
import { moveCursorAndSetJumpPoint } from "../editor/cursor-motion";
import { buildDefinitionAppend, seedDefinitionBody } from "./definition-append";
import { DocContext, docContext, listExistingFootnoteDefinitions } from "../editor/doc-context";
import { openFootnotePopup, popupEditingAvailable } from "./footnote-popup";
import { inlineFootnoteSpanAt, sanitizeInlineFootnoteContent } from "./inline-footnotes";
import {
    caretInsideMaskedSpan,
    ProtectedCreationNotice,
    simulateChanges,
    simulatedAnchor,
} from "../editor/insertion-liveness";
import {
    findDefinitionBlocks,
    maskInlineRegions,
    maskedLineAt,
    scanDocument,
} from "../parsing/markdown-scan";
import { openPopupForNewDefinition, replaceInTableCell } from "./create-footnote";
import { DefinitionCreationNotice } from "./press-guards";
import { TableCellEditor } from "../editor/table-cursor";

// Turning a selection into a footnote (issue #35): a creation press with a
// live selection REPLACES the selected text instead of inserting at the
// caret — the auto-numbered key moves it into a new definition's body, the
// inline key wraps it as "^[…]" in place, and the NAMED key asks for the
// name in a small modal and then does what autonum does under the chosen
// name (Jason's ask 2026-08-13; the named flow's usual second press can't
// carry a body statelessly, so the modal replaces it for selections).
// Only the paste key redirects: its body is the clipboard, so a selection
// press is genuinely ambiguous there. Always on, no toggle (Jason's call,
// 2026-08-12): a press with a selection previously inserted at the stale
// caret, which served nobody.
//
// Multi-line selections convert too (Jason's ask 2026-08-19 — academic
// footnotes hold whole paragraphs): the autonum/named keys move the
// selected block into a MULTI-PARAGRAPH definition (continuation lines
// indented four spaces, the shape the scanner and the jump commands
// already speak). The INLINE key refuses line-spanning selections and
// redirects to those two keys instead (Jason's ruling 2026-08-20: the
// flatten-like-paste behavior basically never looked correct on anything
// but clean paragraphs, and paste already covers the flatten use case).
// Protected constructs (fences, math, comments, inline spans) may ride
// along when the selection contains them WHOLE; only a selection that
// CUTS one — an edge inside a construct, or a delimiter grabbed without
// its partner, which would reclassify innocent text below — refuses.

export const SelectionSpanNotice =
    "Select one continuous stretch of text to turn it into a footnote.";
export const SelectionCommandNotice =
    "To turn the selected text into a footnote, use the auto-numbered, named, or inline footnote command.";
export const SelectionChangedNotice =
    "The note changed while naming the footnote. Reselect the text and try again.";
// inline footnotes are single-line by nature; flattening a multi-line
// selection (paste parity) was tried and REVERTED (Jason, 2026-08-20) —
// it basically never looked correct outside clean paragraphs
export const InlineSelectionNotice =
    "Inline footnotes are single-line. Use the auto-numbered or named footnote command to convert a multi-line selection.";
// distinct from ProtectedCreationNotice on purpose (Jason's manual pass,
// 2026-08-13): here the caret isn't INSIDE protected text — the selection
// EDGE cuts through some. Whole constructs inside the selection are fine
// (2026-08-19); cutting one apart would corrupt what stays behind.
export const ProtectedSelectionNotice =
    "No footnote was created: the selection cuts through code, math, or other protected text. Select all of it or none of it.";

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
        if (command === "paste") {
            new Notice(SelectionCommandNotice, 8000);
            return true;
        }
        // protected-EDGE cut is refused UP FRONT, not just simulated: the
        // liveness checks prove the RESULT is live, but a selection that
        // eats one delimiter of a span can make a live result out of
        // destroying the construct. A span contained WHOLE travels into
        // the footnote instead (2026-08-19; see the main-editor twin).
        const maskedCell = maskInlineRegions(cellText);
        if (
            caretInsideMaskedSpan(maskedCell, from, false, false) ||
            caretInsideMaskedSpan(maskedCell, to, false, false)
        ) {
            new Notice(ProtectedSelectionNotice, 8000);
            return true;
        }
        const text = cellText.slice(from, to);
        if (command === "inline") {
            const wrapped = `^[${sanitizeInlineFootnoteContent(text)}]`;
            // liveness refusal (with its own Notice) happens inside
            replaceInTableCell(cell, wrapped, from, to, wrapped.length);
            return true;
        }
        if (command === "named") {
            new NameSelectionModal(plugin, doc, {
                kind: "cell",
                cell,
                selection: { from, to, text },
                cursorPosition,
            }).open();
            return true;
        }
        convertCellSelection(
            plugin,
            doc,
            cell,
            { from, to, text },
            cursorPosition,
            autonumFootnoteId(plugin, doc),
        );
        return true;
    }

    const resolved = normalizedMainSelection(doc);
    if (resolved === null) return false;
    if (resolved === "multi") {
        new Notice(SelectionSpanNotice, 8000);
        return true;
    }
    // shrink to the non-whitespace core (line breaks included): a
    // selection made by double-click or drag routinely carries an edge
    // space or a trailing newline, and that whitespace belongs to the
    // prose, not to the footnote
    const trimmed = trimSelectionEdges(doc, resolved.from, resolved.to);
    if (trimmed === null) return false;
    if (command === "paste") {
        new Notice(SelectionCommandNotice, 8000);
        return true;
    }
    // the inline key only converts within one line — a line-spanning
    // selection redirects to the definition-backed keys (2026-08-20)
    if (command === "inline" && trimmed.from.line !== trimmed.to.line) {
        new Notice(InlineSelectionNotice, 8000);
        return true;
    }
    const ctx = docContext(doc);
    const text = rangeText(ctx.lines, trimmed.from, trimmed.to);
    // protected CUTS are refused UP FRONT, not just simulated: the
    // born-dead checks prove the RESULT is live, but a selection that eats
    // a delimiter makes a live result out of DESTROYING the construct —
    // wrapping the first backtick of a fence opener un-fenced everything
    // below it (found by the conversion property, 2026-08-12). Constructs
    // contained WHOLE travel into the footnote instead (2026-08-19): an
    // edge strictly inside protected text, or a replacement that would
    // reclassify any line it doesn't touch, is what refuses.
    const replacement =
        command === "inline"
            ? `^[${sanitizeInlineFootnoteContent(text)}]`
            : "[^x]";
    if (
        selectionCutsProtectedText(ctx, trimmed.from, trimmed.to) ||
        replacementReclassifiesDoc(ctx, trimmed.from, trimmed.to, replacement)
    ) {
        new Notice(ProtectedSelectionNotice, 8000);
        return true;
    }
    // a selection inside — or lapping over — another footnote's definition
    // would nest footnotes into each other, refused like the caret presses
    // (Jason's ruling 2026-08-13). Any overlap counts: starting inside a
    // block nests the new footnote into it, and swallowing a block nests
    // it into the new footnote.
    if (
        findDefinitionBlocks(ctx.lines, ctx.scan.isProtected, ctx.scan).some(
            (block) =>
                trimmed.from.line <= block.end && trimmed.to.line >= block.start,
        )
    ) {
        new Notice(DefinitionCreationNotice, 8000);
        return true;
    }
    const selection = { from: trimmed.from, to: trimmed.to, text };
    if (command === "inline") {
        convertMainSelectionToInline(plugin, doc, selection, ctx);
    } else if (command === "named") {
        new NameSelectionModal(plugin, doc, { kind: "main", selection }).open();
    } else {
        convertMainSelection(plugin, doc, selection, ctx, autonumFootnoteId(plugin, doc, ctx));
    }
    return true;
}

/**
 * The selection's non-whitespace core, edges walked ACROSS line breaks
 * (multi-line selections routinely start or end on a blank line), or null
 * when nothing but whitespace is selected. Also normalizes the full-line
 * drag (ending at ch 0 of the next line) back onto the dragged line.
 */
export function trimSelectionEdges(
    doc: Editor,
    from: EditorPosition,
    to: EditorPosition,
): { from: EditorPosition; to: EditorPosition } | null {
    let { line: fromLine, ch: fromCh } = from;
    let { line: toLine, ch: toCh } = to;
    while (fromLine < toLine || fromCh < toCh) {
        const lineText = doc.getLine(fromLine);
        if (fromCh >= lineText.length) {
            // the implicit line break is whitespace too
            fromLine++;
            fromCh = 0;
            continue;
        }
        if (!/\s/.test(lineText[fromCh])) break;
        fromCh++;
    }
    while (toLine > fromLine || toCh > fromCh) {
        if (toCh === 0) {
            toLine--;
            toCh = doc.getLine(toLine).length;
            continue;
        }
        if (!/\s/.test(doc.getLine(toLine)[toCh - 1])) break;
        toCh--;
    }
    if (fromLine === toLine && fromCh === toCh) return null;
    return {
        from: { line: fromLine, ch: fromCh },
        to: { line: toLine, ch: toCh },
    };
}

/** The text `[from, to)` spans, LF-joined — the fake-editor-safe getRange. */
function rangeText(
    lines: string[],
    from: EditorPosition,
    to: EditorPosition,
): string {
    if (from.line === to.line) {
        return (lines[from.line] ?? "").slice(from.ch, to.ch);
    }
    const parts = [(lines[from.line] ?? "").slice(from.ch)];
    for (let i = from.line + 1; i < to.line; i++) parts.push(lines[i] ?? "");
    parts.push((lines[to.line] ?? "").slice(0, to.ch));
    return parts.join("\n");
}

/**
 * Whether either selection EDGE cuts into protected text: strictly inside
 * a masked span on its line, inside a multi-line region (comment/math/
 * fence) that crosses the edge, or anywhere in YAML frontmatter (metadata
 * is never prose — a footnote body carrying half a properties block helps
 * nobody). Constructs the selection contains WHOLE pass: their edges see
 * live text on the outside. Trimming guarantees the character AT `from`
 * and BEFORE `to` exist, so only the outward-facing neighbor needs the
 * open-region stand-in.
 */
function selectionCutsProtectedText(
    ctx: DocContext,
    from: EditorPosition,
    to: EditorPosition,
): boolean {
    const { lines, scan } = ctx;
    // frontmatter starts at line 0, so any overlap includes `from`
    if (lines[0] === "---" && scan.isProtected[0]) {
        for (let j = 1; j < lines.length; j++) {
            if (/^(---|\.\.\.)\s*$/.test(lines[j])) {
                if (from.line <= j) return true;
                break;
            }
        }
    }
    // the startsIn* trio says whether a multi-line region (comment, math,
    // fence — quoted ones included) crosses the edge line's START; the
    // fence flag exists precisely because a QUOTED fence is invisible to
    // every endsProtected probe (30k-soak find, 2026-08-20: a full-line
    // drag on a quoted fence's interior converted the line, demoting its
    // quote and killing the fence).
    const openInto = (line: number) =>
        scan.startsInComment[line] ||
        scan.startsInMath[line] ||
        scan.startsInFence[line];
    // a protected from-line carrying NO region flag is a legitimate edge
    // only when it's a fence OPENER — its construct extends DOWN into the
    // selection. Everything else protected-and-unflagged (quote-relative
    // indented code starts with ">" at ch 0, where the whitespace trim
    // can't shield the edge — the second 30k-soak find of 2026-08-20 —
    // plus doc-level indented chunks and dead openers) refuses.
    const fenceOpener = (line: number) =>
        line + 1 < lines.length
            ? scan.startsInFence[line + 1]
            : scan.endsProtected;
    if (
        scan.isProtected[from.line] &&
        !openInto(from.line) &&
        !fenceOpener(from.line)
    ) {
        return true;
    }
    if (
        caretInsideMaskedSpan(
            ctx.maskedLine(from.line),
            from.ch,
            openInto(from.line),
            false, // `from` points AT a character — the after-side is on-line
        )
    ) {
        return true;
    }
    const openAtTo =
        to.line + 1 < lines.length ? openInto(to.line + 1) : scan.endsProtected;
    return caretInsideMaskedSpan(
        ctx.maskedLine(to.line),
        to.ch,
        false, // `to` follows a character — the before-side is on-line
        openAtTo,
    );
}

/**
 * Whether replacing the selection with `replacement` changes the
 * protection classification of ANY line the edit doesn't touch — the
 * construct-destruction oracle: a selection that eats a fence delimiter
 * (or completes/un-closes a region by removal) leaves a live-looking
 * result precisely BECAUSE innocent text below got reclassified, which
 * the reference/definition liveness checks can't see.
 */
function replacementReclassifiesDoc(
    ctx: DocContext,
    from: EditorPosition,
    to: EditorPosition,
    replacement: string,
): boolean {
    const before = ctx.scan;
    const simulated = simulateChanges(ctx.lines, [
        { from, to, text: replacement },
    ]);
    const after = scanDocument(simulated);
    const delta = simulated.length - ctx.lines.length;
    const changed = (i: number, j: number) =>
        before.isProtected[i] !== after.isProtected[j] ||
        before.startsInComment[i] !== after.startsInComment[j] ||
        before.startsInMath[i] !== after.startsInMath[j] ||
        // fence-role flips too: a closer whose opener the edit destroyed
        // becomes an opener itself — same isProtected, different construct
        before.startsInFence[i] !== after.startsInFence[j];
    for (let i = 0; i < from.line; i++) {
        if (changed(i, i)) return true;
    }
    for (let i = to.line + 1; i < ctx.lines.length; i++) {
        if (changed(i, i + delta)) return true;
    }
    return false;
}

/**
 * `text` as a definition body: the first line rides the label, every
 * later line becomes a four-space-indented continuation (the shape the
 * scanner, the jump commands, and Obsidian's renderer all read as ONE
 * multi-paragraph footnote). Whitespace-only lines become exactly "    "
 * — still paragraph separators to the scanner and the renderer (both
 * treat whitespace-only as blank), but visually flush with the
 * continuation indent (Jason's ask, 2026-08-21).
 */
export function indentDefinitionBody(text: string): string {
    return text
        .split("\n")
        .map((line, i) =>
            i === 0 ? line : line.trim() === "" ? "    " : `    ${line}`,
        )
        .join("\n");
}

/** The next auto-numbered id under the note's active prefix, or null when the prefix is invalid (its Notice already explained why). */
function autonumFootnoteId(
    plugin: FootnotePlugin,
    doc: Editor,
    ctx: DocContext = docContext(doc),
): string | null {
    const prefix = activeFootnotePrefix(plugin, footnotePrefixFromEditor(doc));
    if (prefix === null) return null;
    const masked = ctx.maskedLines().join("\n");
    return `${prefix}${computeNextFootnoteNumber(masked, prefix, masked)}`;
}

/**
 * The modal's validation: why `name` can't name the selection's new
 * footnote, or null when it can. An existing DEFINITION refuses (the
 * selection's text needs somewhere to live — duplicates are the merge
 * rule's business, not a creation side effect); a name that only dangling
 * references carry is WELCOME, since defining it heals them.
 */
function namedSelectionProblem(
    doc: Editor,
    name: string,
    ctx: DocContext = docContext(doc),
): string | null {
    if (/[[\]]/.test(name)) {
        return "Footnote names can't contain brackets.";
    }
    if (!isValidFootnoteName(name)) {
        return "Footnote names can't contain spaces or backticks.";
    }
    if (idListIncludes(listExistingFootnoteDefinitions(doc, ctx), name)) {
        return `"[^${name}]" is already defined. Pick a new name.`;
    }
    return null;
}

/**
 * The named conversion the modal submits (exported for units — the modal
 * itself is DOM territory): validates against the CURRENT document,
 * confirms the captured selection still reads the same text (the note can
 * change under an open modal), then converts exactly like autonum under
 * `name`. Returns the problem to show inline (modal stays open), or null
 * when the press is settled — converted, or refused with its own Notice.
 */
export function convertSelectionToNamed(
    plugin: FootnotePlugin,
    doc: Editor,
    selection: { from: EditorPosition; to: EditorPosition; text: string },
    name: string,
): string | null {
    const ctx = docContext(doc);
    const problem = namedSelectionProblem(doc, name, ctx);
    if (problem !== null) return problem;
    if (
        selection.to.line >= doc.lineCount() ||
        rangeText(ctx.lines, selection.from, selection.to) !== selection.text
    ) {
        new Notice(SelectionChangedNotice, 8000);
        return null;
    }
    convertMainSelection(plugin, doc, selection, ctx, name);
    return null;
}

/** The cell twin of convertSelectionToNamed. */
export function convertCellSelectionToNamed(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor,
    selection: { from: number; to: number; text: string },
    name: string,
    cursorPosition?: EditorPosition,
): string | null {
    const problem = namedSelectionProblem(doc, name);
    if (problem !== null) return problem;
    const cellText = cell.state.doc.toString();
    if (cellText.slice(selection.from, selection.to) !== selection.text) {
        new Notice(SelectionChangedNotice, 8000);
        return null;
    }
    convertCellSelection(plugin, doc, cell, selection, cursorPosition, name);
    return null;
}

/**
 * The main editor's one usable selection range, oriented from ≤ to:
 * null = nothing selected, "multi" = unconvertible (multiple selection
 * ranges — one footnote can't stand in for several disjoint stretches).
 * Line-spanning ranges are usable since 2026-08-19: they become
 * multi-paragraph definitions.
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
    return { from, to };
}

// The inline flavor: the selection becomes "^[…]" in place, caret after
// the closing bracket — single-line selections only (the entry redirects
// line-spanning ones, 2026-08-20); the sanitizer (shared with paste)
// collapses whitespace and escapes unbalanced brackets so the wrapper
// can't end early. Same born-dead refusal as insertInlineText: the span
// must survive on the masked simulated line (a selection inside protected
// text, or one whose removal completes a construct around it, dies here).
function convertMainSelectionToInline(
    plugin: FootnotePlugin,
    doc: Editor,
    selection: { from: EditorPosition; to: EditorPosition; text: string },
    ctx: DocContext,
): void {
    const text = `^[${sanitizeInlineFootnoteContent(selection.text)}]`;
    const simulated = simulateChanges(ctx.lines, [
        { from: selection.from, to: selection.to, text },
    ]);
    const masked = maskedLineAt(simulated, selection.from.line);
    if (inlineFootnoteSpanAt(masked, selection.from.ch + 2)?.open !== selection.from.ch) {
        new Notice(ProtectedCreationNotice, 8000);
        return;
    }
    const after = { line: selection.from.line, ch: selection.from.ch + text.length };
    moveCursorAndSetJumpPoint(doc, selection.from, after, plugin, [
        { from: selection.from, to: selection.to, text },
    ]);
}

// The definition-backed flavor, shared by autonum (next-numbered id) and
// the named modal (typed id): the selection is replaced by "[^id]" and
// moved into that footnote's definition body — then popup or jump per
// settings, exactly like createAutonumFootnote. The simulate-and-verify
// step matters MORE here than for a plain insert: deleting the selection
// can un-close a construct (its closer was selected) and the seeded body
// travels arbitrary text into the definition line. A null id means the
// note's prefix is invalid (its Notice already explained); the press was
// still consumed.
function convertMainSelection(
    plugin: FootnotePlugin,
    doc: Editor,
    selection: { from: EditorPosition; to: EditorPosition; text: string },
    ctx: DocContext,
    footnoteId: string | null,
): void {
    if (footnoteId === null) return;
    const footnoteReference = `[^${footnoteId}]`;
    const isFirstFootnote = listExistingFootnoteDefinitions(doc, ctx).length === 0;

    // a multi-line selection becomes a multi-paragraph body: continuation
    // lines indented four spaces under the label (2026-08-19)
    const body = indentDefinitionBody(selection.text);
    const bodyExtraLines = body.split("\n").length - 1;
    const definition = seedDefinitionBody(
        buildDefinitionAppend(doc, footnoteId, isFirstFootnote, plugin, ctx),
        footnoteId,
        body,
    );
    const changes: EditorChange[] = [
        { from: selection.from, to: selection.to, text: footnoteReference },
        definition.change,
    ];
    if (definition.prepend) changes.push(definition.prepend);

    // same verification as createAutonumFootnote: the new reference must be
    // live and its definition must parse as a live block — one that claims
    // every seeded continuation line — on the SIMULATED result; refuse like
    // the protected-caret guard otherwise. BOTH anchors are re-found
    // through simulatedAnchor — a definition appended ABOVE the selection
    // shifts every later line (entry-corpus find, 2026-08-12), and a
    // multi-line selection collapsing to "[^id]" shifts every line BELOW
    // it, the appended definition included (2026-08-19)
    const simulated = simulateChanges(ctx.lines, changes);
    const simulatedScan = scanDocument(simulated);
    const definitionAnchor = simulatedAnchor(ctx.lines, changes, 1, simulated);
    const labelAt = definition.change.text.lastIndexOf(`[^${footnoteId}]: `);
    const labelLine =
        definitionAnchor.line +
        definition.change.text.slice(0, labelAt).split("\n").length -
        1;
    // where the caret should land AFTER the transaction: the end of the
    // seeded body, in simulated coordinates
    const definitionCursor = {
        line: labelLine + bodyExtraLines,
        ch: definition.cursor.ch,
    };
    const definitionLive = findDefinitionBlocks(
        simulated,
        simulatedScan.isProtected,
        simulatedScan,
    ).some(
        (block) =>
            block.start === labelLine &&
            block.end >= labelLine + bodyExtraLines,
    );
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
        openPopupForNewDefinition(plugin, doc, selection.from, footnoteId, definitionCursor);
        // Stryker restore all
    } else {
        moveCursorAndSetJumpPoint(doc, selection.from, definitionCursor, plugin, changes, true);
    }
}

// The definition-backed flavor inside an actively edited table cell,
// shared by autonum and the named modal: the reference replaces the cell
// selection through the cell's own editor, the pre-filled definition
// appends outside the table — mirroring createAutonumFootnote's cell
// branch, including its refused-cell contract: a born-dead cell
// replacement must not leave an orphaned definition behind.
function convertCellSelection(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor,
    selection: { from: number; to: number; text: string },
    cursorPosition: EditorPosition | undefined,
    footnoteId: string | null,
): void {
    if (footnoteId === null) return;
    const ctx = docContext(doc);
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

/** What the name modal converts on submit: the captured main-editor or cell selection. */
type NamedSelectionTarget =
    | {
          kind: "main";
          selection: { from: EditorPosition; to: EditorPosition; text: string };
      }
    | {
          kind: "cell";
          cell: TableCellEditor;
          selection: { from: number; to: number; text: string };
          cursorPosition?: EditorPosition;
      };

// One text input for the footnote's name; Enter (or Create) converts the
// captured selection under it. Invalid names and collisions show their
// reason inline and keep the modal open — same shape as the rename and
// set-prefix modals. Validation and conversion live in the exported
// functions above; this is thin wiring.
// Stryker disable all: modal DOM against the live app — smoke-test
// territory, unreachable from units (same policy as RenameFootnoteModal).
class NameSelectionModal extends Modal {
    private plugin: FootnotePlugin;
    private doc: Editor;
    private target: NamedSelectionTarget;
    private value = "";
    private errorEl!: HTMLElement;

    constructor(plugin: FootnotePlugin, doc: Editor, target: NamedSelectionTarget) {
        super(plugin.app);
        this.plugin = plugin;
        this.doc = doc;
        this.target = target;
    }

    onOpen() {
        this.setTitle("Name the footnote");
        const { contentEl } = this;

        new Setting(contentEl)
            .setName("Name")
            .setDesc(
                `Replaces the selection with "[^name]" and moves the selected text into that footnote's definition.`,
            )
            .addText((text) => {
                text.setPlaceholder("Smith2019").onChange((value) => {
                    this.value = value;
                    this.errorEl.setText("");
                });
                text.inputEl.addEventListener("keydown", (evt) => {
                    if (evt.key === "Enter") {
                        evt.preventDefault();
                        this.submit();
                    }
                });
                text.inputEl.focus();
            });

        this.errorEl = contentEl.createDiv({
            cls: "footnote-shortcut-prefix-error",
        });

        new Setting(contentEl).addButton((button) =>
            button
                .setButtonText("Create")
                .setCta()
                .onClick(() => {
                    this.submit();
                }),
        );
    }

    private submit() {
        const name = this.value.trim();
        if (name === "") {
            this.close();
            return;
        }
        const problem =
            this.target.kind === "main"
                ? convertSelectionToNamed(
                      this.plugin,
                      this.doc,
                      this.target.selection,
                      name,
                  )
                : convertCellSelectionToNamed(
                      this.plugin,
                      this.doc,
                      this.target.cell,
                      this.target.selection,
                      name,
                      this.target.cursorPosition,
                  );
        if (problem !== null) {
            this.errorEl.setText(problem);
            return;
        }
        this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
// Stryker restore all
