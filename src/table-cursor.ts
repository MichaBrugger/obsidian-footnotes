import { Editor, EditorPosition } from "obsidian";

import { EditorWithCm } from "./obsidian-internals";

// A table cell being edited runs in its own CodeMirror sub-editor, and the
// main editor's getCursor() does NOT track its caret: clicking around inside
// a cell leaves the main selection wherever it last was. Commands that trust
// getCursor() then insert text at a stale position — displacing the row's
// pipes and shredding the table. When focus is in a cell sub-editor, recover
// the true document position from the sub-editor itself.

/**
 * The slice of the cell sub-editor's EditorView the plugin uses. Edits that
 * must land inside an actively edited cell are dispatched HERE, not into the
 * main editor: the cell's widget owns the markdown write-back (pipe
 * escaping, padding, position mapping), so going through it can't race the
 * sync-back the way a main-editor transaction into the row does.
 */
export interface TableCellEditor {
    state: {
        doc: { toString(): string };
        selection: { main: { head: number } };
    };
    dispatch(spec: {
        changes?: { from: number; to?: number; insert: string };
        selection?: { anchor: number };
    }): void;
}

/**
 * The EditorView of the actively edited table cell, or null when focus
 * isn't inside a table cell sub-editor.
 *
 * Obsidian attaches no plugin-visible handle to the cell sub-editor's DOM
 * (older builds exposed `cmView` on the content element; current ones do
 * not — verified 2026-07-15), so the cell view is recovered through CM6's
 * own registry: `EditorView.findFromDOM` returns the innermost EditorView
 * owning an element, and the main view's constructor IS the app's
 * EditorView class, so no @codemirror import is needed.
 */
export function activeTableCellEditor(editor: Editor): TableCellEditor | null {
    const cm = (editor as EditorWithCm).cm;
    if (!cm) return null;
    const active = cm.contentDOM.ownerDocument.activeElement;
    if (!active || active === cm.contentDOM || !cm.contentDOM.contains(active)) {
        return null;
    }
    if (!active.closest("td, th")) return null;
    const EditorViewClass = cm.constructor as unknown as {
        findFromDOM?: (el: HTMLElement) => TableCellEditor | null;
    };
    const view = EditorViewClass.findFromDOM?.(active as HTMLElement) ?? null;
    if (!view || (view as unknown) === (cm as unknown)) return null;
    return view;
}

/** Cell spans of a table row line, aware of `\|` escapes. */
export function tableRowCellSpans(lineText: string): { from: number; to: number }[] {
    const spans: { from: number; to: number }[] = [];
    let start = -1;
    for (let i = 0; i < lineText.length; i++) {
        const c = lineText[i];
        if (c === "\\") {
            i++;
        } else if (c === "|") {
            if (start !== -1) {
                spans.push({ from: start, to: i });
            }
            start = i + 1;
        }
    }
    if (start !== -1 && start < lineText.length) {
        spans.push({ from: start, to: lineText.length });
    }
    return spans;
}

/**
 * The document position of the caret inside the actively edited table cell,
 * or null when focus isn't in a table cell sub-editor (or any lookup fails,
 * in which case callers should keep trusting the main editor's cursor).
 */
export function resolveTableCellCursor(editor: Editor): EditorPosition | null {
    const cm = (editor as EditorWithCm).cm;
    if (!cm || !cm.posAtDOM) return null;

    // only relevant while a sub-editor nested in the main editor owns focus
    const doc = cm.contentDOM.ownerDocument;
    const active = doc.activeElement;
    if (!active || active === cm.contentDOM || !cm.contentDOM.contains(active)) {
        return null;
    }

    const td = active.closest("td, th");
    const table = active.closest("table");
    const tr = active.closest("tr");
    if (!td || !table || !tr) return null;

    const cellView = activeTableCellEditor(editor);
    if (!cellView) return null;

    // the table widget's start position anchors the row's line number;
    // rendered rows skip the delimiter line
    const startLine = editor.offsetToPos(cm.posAtDOM(table)).line;
    const rowIdx = Array.prototype.indexOf.call(table.rows, tr);
    if (rowIdx < 0) return null;
    const line = startLine + (rowIdx === 0 ? 0 : rowIdx + 1);
    if (line > editor.lastLine()) return null;

    const lineText = editor.getLine(line);
    const span = tableRowCellSpans(lineText)[(td as HTMLTableCellElement).cellIndex];
    if (!span) return null;

    // the sub-editor's doc is the cell's source sans padding; anchor it
    // inside the raw cell, then add the sub-editor's caret offset
    const rawCell = lineText.slice(span.from, span.to);
    const cellText = cellView.state.doc.toString();
    let base = span.from + (rawCell.length - rawCell.trimStart().length);
    if (cellText.length > 0) {
        const idx = rawCell.indexOf(cellText);
        if (idx >= 0) base = span.from + idx;
    }
    const ch = Math.min(base + cellView.state.selection.main.head, span.to);
    return { line, ch };
}
