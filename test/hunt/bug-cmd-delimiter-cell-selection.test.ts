// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 1 of 1 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";
import { TableSelectionNotice } from "../../src/commands/selection-footnote";
import { resetNotices, noticed } from "../helpers/notices";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";

// A user drags over the "---" dashes of a table's delimiter row and presses
// the footnote key. The selection claim lets it through, because both edges
// sit "inside one cell" of the row - but the delimiter row's dashes are not
// cell text, they are the thing that makes the line a table at all. The
// conversion replaces them with "[^1]", the header row above loses its
// delimiter, and the whole table stops rendering as a table: exactly the
// shredding TableSelectionNotice exists to refuse ("Moving a cell, a few
// cells, or a whole row into a footnote shreds the table that stays
// behind", Jason's ruling 2026-09-04).

function fakePlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: false,
            expandSelectionToWholeWords: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

describe("a selection covering a delimiter row's dashes", () => {
    it.fails("refuses instead of converting the table's spine into a footnote", async () => {
        const lines = ["| H |", "| --- |", "| a |"];
        const doc = sharedFakeEditor(lines, {
            cursor: { line: 1, ch: 2 },
            selection: {
                anchor: { line: 1, ch: 2 },
                head: { line: 1, ch: 5 },
            },
            edits: true,
            wholeDoc: true,
        });
        resetNotices();
        await insertAutonumFootnote(fakePlugin(doc));
        expect(noticed(TableSelectionNotice)).toBe(true);
        expect(doc.lines.join("\n")).toBe(lines.join("\n"));
    });
});
