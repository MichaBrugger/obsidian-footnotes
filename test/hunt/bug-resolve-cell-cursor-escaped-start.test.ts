import type { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import { resolveTableCellCursor, type TableCellEditor } from "../../src/editor/table-cursor";

// BUG: a caret at the very start of a table cell whose text BEGINS with an
// escaped pipe resolves one column too far, landing between the backslash
// and the pipe it protects; and a stale cell caret reported past the end of
// the cell's text resolves onto the cell's closing pipe.
//
// What the user would see: nothing today. Both wrong positions are only
// ever READ on the cell paths (the write itself goes through
// insertInTableCell, which starts from cellCaret), so no row of a table is
// corrupted by either one. What they would see if a future caller ever
// wrote at the resolved position: an insertion slipped between "\" and "|"
// is itself escaped by that backslash and leaves the pipe unescaped, which
// splits the row into an extra cell; an insertion at the closing pipe lands
// outside the cell entirely. This is pinned as a trap for future code.
//
// Hunt: 2026-09-13. Lens: offsets.
//
// Source of truth: the ruling pinned in bug-table-escape-offset - every
// escaping backslash BEFORE the caret uses up a column of the raw line but
// no column of the cell editor, and at cell offset 0 no backslash has been
// used yet, so the caret belongs at the first column of the cell's content;
// and cellCaret's own docstring, "Every cell path reads its caret through
// here" (Jason's report, sheet 08, 2026-09-11), which resolveTableCellCursor
// does not honour because it reads cellView.state.selection.main.head raw.

// The fake DOM the resolver walks: one table with a header row and one body
// row, with focus inside the body row's cell. Copied from the pin above.
function resolve(
    lineText: string,
    cellText: string,
    head: number,
    cellIndex = 0,
): ReturnType<typeof resolveTableCellCursor> {
    const bodyRow = {};
    const table = { rows: [{}, bodyRow] as unknown[] };
    const td = { cellIndex };
    const active = {
        closest(selector: string) {
            if (selector === "td, th") return td;
            if (selector === "table") return table;
            if (selector === "tr") return bodyRow;
            return null;
        },
    };
    const cellView: TableCellEditor = {
        state: {
            doc: { toString: () => cellText },
            selection: { main: { head, anchor: head } },
        },
        dispatch() {},
    };
    class MainView {
        static findFromDOM() {
            return cellView;
        }

        contentDOM = {
            ownerDocument: { activeElement: active },
            contains: () => true,
        };
        posAtDOM = () => 100;
    }
    const editor = {
        cm: new MainView(),
        offsetToPos: () => ({ line: 5, ch: 0 }),
        lastLine: () => 20,
        getLine: () => lineText,
    } as unknown as Editor;
    return resolveTableCellCursor(editor);
}

describe("a cell whose text begins with an escaped pipe", () => {
    // The row "| \| | b |". The first cell's source text is " \| " and the
    // cell's own editor shows a single "|". Column 2 of the row is the
    // backslash, column 3 the pipe it protects.
    const line = "| \\| | b |";

    it.fails("cell offset 0 maps to the cell's first column, not into the escape", () => {
        // the resolver looks for the cell editor's text inside the raw cell
        // and finds the bare "|" at column 3, skipping past the backslash
        // that belongs to it
        expect(resolve(line, "|", 0)?.ch).toBe(2);
    });

    it("control: cell offset 1, past the shown pipe, maps past the whole escape", () => {
        expect(resolve(line, "|", 1)?.ch).toBe(4);
    });
});

describe("a cell that begins with an escaped pipe and carries more text", () => {
    const line = "| \\|x | b |";

    it.fails("cell offset 0 maps to the cell's first column", () => {
        expect(resolve(line, "|x", 0)?.ch).toBe(2);
    });

    it("control: cell offset 2 maps past the whole escape and the letter", () => {
        expect(resolve(line, "|x", 2)?.ch).toBe(5);
    });
});

describe("a stale cell caret reported past the end of the cell text", () => {
    const line = "| alpha | bravo |";

    it.fails("is clamped to just past the cell's text, the way cellCaret clamps it", () => {
        // Obsidian can report a caret belonging to the LONGER text the cell
        // held before a rebuild, which is why cellCaret exists. Walking that
        // stale head runs the mapping off the end of the cell and parks it
        // on the closing pipe at column 8 instead of column 7, just past
        // "alpha".
        expect(resolve(line, "alpha", 99)?.ch).toBe(7);
    });

    it("control: a caret at the true end of the cell text is already right", () => {
        expect(resolve(line, "alpha", 5)?.ch).toBe(7);
    });
});
