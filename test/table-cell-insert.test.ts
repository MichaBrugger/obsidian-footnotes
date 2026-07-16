import { describe, expect, it } from "vitest";

import { insertInTableCell } from "../src/insert-or-navigate-footnotes";
import type FootnotePlugin from "../src/main";
import type { TableCellEditor } from "../src/table-cursor";

// Regression companion to the table-corruption smoke test (2026-07-15).
// The contract with Obsidian itself — that a cell sub-editor can be FOUND
// and that its dispatch syncs back to the document — can only be verified
// by the smoke layer against the real app. What CAN be pinned here is the
// deterministic half: given a found cell editor, the dispatched edit must
// target the right offset and land the caret in the right place.

function fakeCell(text: string, head: number) {
    const dispatched: {
        changes?: { from: number; to?: number; insert: string };
        selection?: { anchor: number };
    }[] = [];
    const cell: TableCellEditor = {
        state: {
            doc: { toString: () => text },
            selection: { main: { head } },
        },
        dispatch: (spec) => {
            dispatched.push(spec);
        },
    };
    return { cell, dispatched };
}

function fakePlugin(insertAtEndOfWord: boolean): FootnotePlugin {
    return { settings: { insertAtEndOfWord } } as unknown as FootnotePlugin;
}

describe("insertInTableCell", () => {
    it("inserts at the caret when end-of-word is off", () => {
        //                            0123456
        const { cell, dispatched } = fakeCell("Dolor ", 3);
        insertInTableCell(cell, fakePlugin(false), "[^]", 2);
        expect(dispatched).toEqual([
            { changes: { from: 3, insert: "[^]" }, selection: { anchor: 5 } },
        ]);
    });

    it("moves a mid-word caret to the end of the word when end-of-word is on", () => {
        const { cell, dispatched } = fakeCell("Dolor sit", 2);
        insertInTableCell(cell, fakePlugin(true), "[^]", 2);
        expect(dispatched).toEqual([
            { changes: { from: 5, insert: "[^]" }, selection: { anchor: 7 } },
        ]);
    });

    it("keeps a caret that touches no word where it is, even with end-of-word on", () => {
        // the user's repro: caret at the end of the cell, after a space
        const { cell, dispatched } = fakeCell("Dolor ", 6);
        insertInTableCell(cell, fakePlugin(true), "[^]", 2);
        expect(dispatched).toEqual([
            { changes: { from: 6, insert: "[^]" }, selection: { anchor: 8 } },
        ]);
    });

    it("places the caret between the brackets of a named marker", () => {
        const { cell, dispatched } = fakeCell("Sit", 3);
        insertInTableCell(cell, fakePlugin(false), "[^]", 2);
        // anchor = insertion point + 2 → between "[^" and "]"
        expect(dispatched[0]?.selection).toEqual({ anchor: 5 });
    });

    it("places the caret after a full autonumbered marker", () => {
        const { cell, dispatched } = fakeCell("Sit", 3);
        insertInTableCell(cell, fakePlugin(false), "[^12]", "[^12]".length);
        expect(dispatched[0]?.selection).toEqual({ anchor: 8 });
    });

    it("dispatches exactly one transaction", () => {
        const { cell, dispatched } = fakeCell("Dolor", 5);
        insertInTableCell(cell, fakePlugin(true), "[^]", 2);
        expect(dispatched).toHaveLength(1);
    });
});
