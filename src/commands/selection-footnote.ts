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
// inline key wraps it as "^[…]" in place, and the NAMED key asks for the
// name in a small modal and then does what autonum does under the chosen
// name (Jason's ask 2026-08-13; the named flow's usual second press can't
// carry a body statelessly, so the modal replaces it for selections).
// Only the paste key redirects: its body is the clipboard, so a selection
// press is genuinely ambiguous there. Always on, no toggle (Jason's call,
// 2026-08-12): a press with a selection previously inserted at the stale
// caret, which served nobody.

export const SelectionSpanNotice =
    "Select one stretch of text on a single line to turn it into a footnote.";
export const SelectionCommandNotice =
    "To turn the selected text into a footnote, use the auto-numbered, named, or inline footnote command.";
export const SelectionChangedNotice =
    "The note changed while naming the footnote. Reselect the text and try again.";
// distinct from ProtectedCreationNotice on purpose (Jason's manual pass,
// 2026-08-13): here the caret isn't INSIDE protected text — the selected
// text CONTAINS some, and the footnote body can't carry it
export const ProtectedSelectionNotice =
    "No footnote was created: footnotes can't contain code, math, or other protected text.";

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
        // protected text is refused UP FRONT, not just simulated: the
        // liveness checks prove the RESULT is live, but a selection that
        // eats a delimiter can make a live result out of destroying the
        // construct (see the main-editor twin below)
        if (maskInlineRegions(cellText).slice(from, to).includes("\0")) {
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
    // shrink to the non-whitespace core: a selection made by double-click
    // or drag routinely carries an edge space, and that space belongs to
    // the prose, not to the footnote
    const lineText = doc.getLine(resolved.from.line);
    let fromCh = resolved.from.ch;
    let toCh = resolved.to.ch;
    while (fromCh < toCh && /\s/.test(lineText[fromCh])) fromCh++;
    while (toCh > fromCh && /\s/.test(lineText[toCh - 1])) toCh--;
    if (fromCh === toCh) return false;
    if (command === "paste") {
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
        new Notice(ProtectedSelectionNotice, 8000);
        return true;
    }
    const selection = {
        from: { line: resolved.from.line, ch: fromCh },
        to: { line: resolved.from.line, ch: toCh },
        text: lineText.slice(fromCh, toCh),
    };
    if (command === "inline") {
        convertMainSelectionToInline(plugin, doc, selection);
    } else if (command === "named") {
        new NameSelectionModal(plugin, doc, { kind: "main", selection }).open();
    } else {
        convertMainSelection(plugin, doc, selection, ctx, autonumFootnoteId(plugin, doc, ctx));
    }
    return true;
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
        selection.from.line >= doc.lineCount() ||
        doc.getLine(selection.from.line).slice(selection.from.ch, selection.to.ch) !==
            selection.text
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
