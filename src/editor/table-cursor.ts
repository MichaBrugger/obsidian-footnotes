import { Editor, EditorPosition } from "obsidian";

import { EditorWithCm } from "./obsidian-internals";

// A table cell being edited runs in its own CodeMirror sub-editor, and the
// main editor's getCursor() does NOT track its caret: clicking around inside
// a cell leaves the main selection wherever it last was. Commands that trust
// getCursor() then insert text at a stale position - displacing the row's
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
        // anchor ≠ head is a live selection inside the cell - the
        // selection-to-footnote conversion (issue #35) replaces that range
        selection: { main: { head: number; anchor: number } };
    };
    dispatch(spec: {
        changes?: { from: number; to?: number; insert: string };
        selection?: { anchor: number };
    }): void;
}

/**
 * Whether a sub-editor NESTED inside the main editor's contentDOM owns
 * focus (an actively edited table cell, or any similar widget editor).
 * Document edits in that state race the sub-editor's sync-back - the
 * issue-#28 corruption family - so callers either defer, re-route, or
 * skip. One shared predicate; it used to be pasted in three places (E9).
 */
export function nestedSubEditorOwnsFocus(editor: Editor): boolean {
    const cm = (editor as EditorWithCm).cm;
    const active = cm?.contentDOM.ownerDocument.activeElement;
    return !!(
        cm &&
        active &&
        active !== cm.contentDOM &&
        cm.contentDOM.contains(active)
    );
}

// Fallback for the rare state where focus sits in a nested sub-editor whose
// EditorView isn't reachable (activeTableCellEditor returned null): editing
// the document while a sub-editor owns focus races its sync-back on blur -
// the sub-editor rewrites its region from pre-edit state, which at best
// swallows the inserted footnote and at worst displaces a table row's pipes
// (regression reported 2026-07-14; same family as issue #28). Hand focus
// back to the main editor and only edit once the sync-back has settled.
// The primary table-cell path dispatches through the cell's own editor
// instead - see createAutonumFootnote / createFootnoteReference.
export function runOutsideTableCell(
    doc: Editor,
    run: (cursorPosition: EditorPosition) => void,
) {
    const cursorPosition = resolveTableCellCursor(doc) ?? doc.getCursor();
    const cm = (doc as EditorWithCm).cm;
    if (!cm || !nestedSubEditorOwnsFocus(doc)) {
        run(cursorPosition);
        return;
    }
    cm.focus();
    // rAF stalls entirely while the window is hidden (same reason the popup
    // teardown uses a timeout), which would swallow the command outright -
    // whichever of the two fires first runs the edit. Timers come from the
    // editor's OWN window, so a note popped out into a separate window
    // isn't scheduled on the main one (E37)
    const win = cm.contentDOM.ownerDocument.defaultView ?? window;
    let ran = false;
    const invoke = () => {
        if (ran) return;
        ran = true;
        run(cursorPosition);
    };
    win.requestAnimationFrame(invoke);
    win.setTimeout(invoke, 100);
}

/**
 * The EditorView of the actively edited table cell, or null when focus
 * isn't inside a table cell sub-editor.
 *
 * Obsidian attaches no plugin-visible handle to the cell sub-editor's DOM
 * (older builds exposed `cmView` on the content element; current ones do
 * not - verified 2026-07-15), so the cell view is recovered through CM6's
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
    // the leading pipe is optional in GFM ("A | B" is a valid row) - without
    // one the first cell starts at column 0 instead of after a "|"
    const leadingPipe = lineText.match(/^\s*\|/);
    let start = leadingPipe ? leadingPipe[0].length : 0;
    let sawPipe = leadingPipe !== null;
    for (let i = start; i < lineText.length; i++) {
        const c = lineText[i];
        if (c === "\\") {
            i++;
        } else if (c === "|") {
            sawPipe = true;
            spans.push({ from: start, to: i });
            start = i + 1;
        }
    }
    // a line with no unescaped pipe at all isn't a table row - no cells
    if (!sawPipe) return [];
    if (start < lineText.length) {
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
    // a rendered column can outrun the source row's cells - bounds-check
    // instead of trusting the index
    const spans = tableRowCellSpans(lineText);
    const cellIndex = (td as HTMLTableCellElement).cellIndex;
    if (cellIndex < 0 || cellIndex >= spans.length) return null;
    const span = spans[cellIndex];

    // the sub-editor's doc is the cell's source sans padding; anchor it
    // inside the raw cell, then walk the sub-editor's caret offset through
    // the raw text. The walk is escape-aware: the cell editor shows "\|"
    // as a bare "|", so each escape byte before the caret consumes a
    // source column but no cell-editor column - plain addition resolved
    // one column short per escape and read a caret just inside a reference
    // as OUTSIDE it, nesting a new reference (bug-table-escape-offset).
    const rawCell = lineText.slice(span.from, span.to);
    const cellText = cellView.state.doc.toString();
    let start = rawCell.length - rawCell.trimStart().length;
    if (cellText.length > 0) {
        const idx = rawCell.indexOf(cellText);
        if (idx >= 0) start = idx;
    }
    const head = cellView.state.selection.main.head;
    let raw = start;
    for (let c = 0; c < head && raw < rawCell.length; c++) {
        if (rawCell[raw] === "\\" && rawCell[raw + 1] === cellText[c]) {
            raw += 2; // escape byte + the character the cell editor shows
        } else {
            raw += 1;
        }
    }
    const ch = Math.min(span.from + raw, span.to);
    return { line, ch };
}
