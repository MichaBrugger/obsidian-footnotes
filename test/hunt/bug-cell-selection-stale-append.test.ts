// Imported from the Kimi K3 cycle 3 hunt of 2026-09-16 (OpenCode worktree); 1 of 2 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { beforeEach, describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { convertCellSelectionToNamed } from "../../src/commands/selection-footnote";
import type { TableCellEditor } from "../../src/editor/table-cursor";
import { fakeEditor as sharedFakeEditor, FakeEditor } from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";
import { resetNotices } from "../helpers/notices";

// Converting a selection inside a table cell replaces the selection with
// the reference through the CELL's own editor (whose widget writes the
// row back into the note), then appends the pre-filled definition. The
// append's position is worked out from a DocContext built BEFORE the
// replacement: convertCellSelection builds it once at the top and never
// reads the note again. When the table is the note's last block, the row
// IS the note's last line, and the replacement has changed its length -
// "y" to "[^note1]" - so the stale append point lands in the MIDDLE of
// the new row: the definition's text splits the reference and the row,
// and the table is gone.
//
// The sibling step createAutonumFootnote's cell branch had exactly this
// bug and fixed it by reading docContext(doc) again AFTER the cell write
// (its comment: "the context built before the press still holds the old
// row, so the append was landing four characters short of the row's new
// end"). The selection conversion twin was left with the stale read.
//
    // (the shrinking twin of the growing case - "some long text" to
    // "[^note1]" - lands the stale append point PAST the new row's end,
    // which the fake editor maps to the document end, so it cannot show
    // what CodeMirror does with an out-of-range position. Filed as
    // spec-cell-selection-shrinking-row-append.)
//
// Source of truth: the pinned createAutonumFootnote fix (sheet 06's
// family; the note must be re-read after the cell's write-back) + Jason's
// ruling 2026-09-04 that footnote writes never break a table.
//
// Settings involved: defaults; the conversion path is the numbered/named
// selection claim inside a cell editor.

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

// a fake table cell editor whose dispatch SYNCS the new cell text back
// into the main document's row, like Obsidian's table widget does
function syncingCell(
    doc: FakeEditor,
    rowLine: number,
    cellFrom: number,
    cellTo: number,
    text: string,
    head: number,
    anchor: number,
): TableCellEditor {
    let cellText = text;
    return {
        state: {
            doc: { toString: () => cellText },
            selection: { main: { head, anchor } },
        },
        dispatch: (spec) => {
            if (spec.changes) {
                const { from, to, insert } = spec.changes;
                cellText = cellText.slice(0, from) + insert + cellText.slice(to ?? from);
            }
            const row = doc.lines[rowLine];
            doc.lines[rowLine] = row.slice(0, cellFrom) + cellText + row.slice(cellTo);
        },
    };
}

describe("a cell selection conversion in a table that ends the note", () => {
    beforeEach(() => {
        resetNotices();
    });

    it("the definition lands BELOW the row, not inside it (selection grows the row)", () => {
        const lines = ["intro", "", "| a | x |", "| --- | --- |", "| b | y |"];
        const doc = sharedFakeEditor(lines, { wholeDoc: true, edits: true, cursor: { line: 4, ch: 6 } });
        const cell = syncingCell(doc, 4, 6, 7, "y", 1, 0);
        convertCellSelectionToNamed(fakePlugin(doc), doc, cell, { from: 0, to: 1, text: "y", lead: "" }, "note1");
        // the row holds the reference, whole; the definition sits below it
        expect(doc.lines[4]).toBe("| b | [^note1] |");
        expect(doc.lines.filter((line) => line.startsWith("[^note1]:"))).toHaveLength(1);
        expect(doc.lines[doc.lines.length - 1]).toBe("[^note1]: y");
    });

    it("control: prose AFTER the table - the append goes to the real end and works", () => {
        const lines = ["intro", "", "| a | x |", "| --- | --- |", "| b | y |", "", "tail prose"];
        const doc = sharedFakeEditor(lines, { wholeDoc: true, edits: true, cursor: { line: 4, ch: 6 } });
        const cell = syncingCell(doc, 4, 6, 7, "y", 1, 0);
        convertCellSelectionToNamed(fakePlugin(doc), doc, cell, { from: 0, to: 1, text: "y", lead: "" }, "note1");
        expect(doc.lines[4]).toBe("| b | [^note1] |");
        expect(doc.lines[doc.lines.length - 1]).toBe("[^note1]: y");
    });
});
