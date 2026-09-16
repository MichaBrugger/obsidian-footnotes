// Imported from the Kimi K3 cycle 3 hunt of 2026-09-16 (OpenCode worktree); 2 of 4 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { beforeEach, describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";
import { fakeEditor as sharedFakeEditor, FakeEditor } from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";
import { noticeCalls } from "../mocks/obsidian";
import { resetNotices } from "../helpers/notices";

// The table-edge guard (warnTableEdgeCaretIfOutside) refuses a caret that
// sits on a table row but outside every cell: a reference written before
// the opening pipe "pushes the last cell out of the table". On a QUOTED
// row ("> | a | b |") the cell splitter counts the "> " quote marker as
// the first cell (spans start at 0, because the leading-pipe test only
// accepts optional spaces), so a caret at column 0, 1, or 2 counts as
// "inside a cell" and the press writes there anyway. At column 0 the
// reference un-quotes the row ("[^1]> | a | b |" - a paragraph line, not
// a quote), and the table below it is gone: the quoted delimiter and rows
// have no header any more. Just after the marker the row gains a third
// cell against its two-cell delimiter, which GFM refuses to read as a
// table either.
//
// What the user sees: one hotkey press at the very start of a quoted
// table row, and the table stops rendering as a table; the footnote
// itself lands fine, so nothing looks wrong until they scroll up.
//
// Source of truth: the guard's own contract (press-guards.ts: "the caret
// is at the edge of a table row, outside its cells" must refuse) + GFM's
// table rules (a quoted table's rows are quoted; a row with more cells
// than the delimiter is not a table) + Jason's ruling 2026-09-04 that
// footnote writes never break a table.
//
// Settings involved: none; the edge guard is always on.

function fakePlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

const TABLE = ["text", "", "> | a | b |", "> | --- | --- |", "> | c | d |", "", "tail"];

describe("a caret on a QUOTED table row's quote marker", () => {
    beforeEach(() => {
        resetNotices();
    });

    it("column 0: refuses instead of un-quoting the row", async () => {
        const doc = sharedFakeEditor(TABLE, {
            cursor: { line: 2, ch: 0 },
            edits: true,
            wholeDoc: true,
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines.join("\n")).toBe(TABLE.join("\n"));
        expect(noticeCalls.length).toBeGreaterThan(0);
    });

    it("column 1 (between marker and pipe): refuses instead of adding a third cell", async () => {
        const doc = sharedFakeEditor(TABLE, {
            cursor: { line: 2, ch: 1 },
            edits: true,
            wholeDoc: true,
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines.join("\n")).toBe(TABLE.join("\n"));
    });

    it("control: a caret inside a real cell inserts fine", async () => {
        const doc = sharedFakeEditor(TABLE, {
            cursor: { line: 2, ch: 5 },
            edits: true,
            wholeDoc: true,
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[2]).toBe("> | a[^1] | b |");
    });

    it("control: a caret after the closing pipe refuses (the existing edge guard)", async () => {
        const doc = sharedFakeEditor(TABLE, {
            cursor: { line: 2, ch: 12 },
            edits: true,
            wholeDoc: true,
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines.join("\n")).toBe(TABLE.join("\n"));
    });
});
