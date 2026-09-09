import { beforeEach, describe, expect, it } from "vitest";

import { noticed, resetNotices } from "../helpers/notices";
import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";

import {
    SelectionCommandNotice,
    selectionPressHandled,
} from "../../src/commands/selection-footnote";
import { TableCellEditor } from "../../src/editor/table-cursor";

// BUG (review A5, Jason confirmed live 2026-09-08): the paste key's
// selection redirect fired at different points in the two branches of
// selectionPressHandled. The main editor redirected BEFORE trimming, so a
// whitespace-only selection plus the paste key toasted "To turn the
// selected text into a footnote, use ..."; the cell branch redirected
// AFTER "if (from === to) return false", so the same gesture inside a
// table cell fell through and pasted the clipboard. Same gesture, one
// answer: the cell branch now redirects as soon as it knows a selection
// exists, exactly like the main branch.

function fakeCell(text: string, anchor: number, head: number) {
    const dispatched: unknown[] = [];
    const cell: TableCellEditor = {
        state: {
            doc: { toString: () => text },
            selection: { main: { head, anchor } },
        },
        dispatch: (spec) => {
            dispatched.push(spec);
        },
    };
    return { cell, dispatched };
}

describe("a whitespace-only cell selection plus the paste key", () => {
    beforeEach(resetNotices);

    it("redirects like the main editor does, and pastes nothing", () => {
        const { cell, dispatched } = fakeCell("one two", 3, 4);
        const doc = fakeEditor(["| one two |"], {
            cursor: { line: 0, ch: 5 },
            edits: true,
            wholeDoc: true,
        });
        const handled = selectionPressHandled(fakePlugin({}, doc), doc, cell, "paste");
        expect(handled).toBe(true);
        expect(noticed(SelectionCommandNotice)).toBe(true);
        expect(dispatched).toEqual([]);
    });
});
