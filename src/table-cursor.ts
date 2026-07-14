import { Editor, EditorPosition } from "obsidian";

import { EditorWithCm } from "./obsidian-internals";

// A table cell being edited runs in its own CodeMirror sub-editor, and the
// main editor's getCursor() does NOT track its caret: clicking around inside
// a cell leaves the main selection wherever it last was. Commands that trust
// getCursor() then insert text at a stale position — displacing the row's
// pipes and shredding the table. When focus is in a cell sub-editor, recover
// the true document position from the sub-editor itself.

/** CM6 attaches `cmView` to its content DOM; `view` is the cell's EditorView. */
interface ContentDOMWithView extends Element {
    cmView?: {
        view?: {
            state: {
                doc: { toString(): string };
                selection: { main: { head: number } };
            };
        };
    };
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

    const cellView = (active as ContentDOMWithView).cmView?.view;
    if (!cellView) return null;

    // the table widget's start position anchors the row's line number;
    // rendered rows skip the delimiter line
    const startLine = editor.offsetToPos(cm.posAtDOM(table)).line;
    const rowIdx = Array.prototype.indexOf.call(
        (table as HTMLTableElement).rows,
        tr,
    );
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
