// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 3 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";
import { noticeCalls } from "../mocks/obsidian";
import { resetNotices } from "../helpers/notices";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";

// A user in source mode (no cell sub-editor; the main-editor path) puts the
// caret at a table row's outer edge and presses the numbered key. Nothing in
// the cascade models tables for a CARET press, so the reference lands
// outside the row's cell structure:
//   - at end of "| a | b |" it becomes "| a | b |[^1]": GFM drops cells
//     beyond the header count, so the reference never renders and its
//     freshly appended definition is orphaned on arrival;
//   - at the row's start it becomes "[^1]| a | b |": now " b " is the
//     excess cell and silently disappears from the rendered table;
//   - inside the delimiter row's dashes it becomes "| -[^1]-- | --- |": the
//     delimiter cell is no longer dashes, so the whole table stops being a
//     table.
// Selections doing the same thing are refused up front (TableSelectionNotice,
// Jason's ruling 2026-09-04, and bug-cmd-delimiter-cell-selection for the
// delimiter row's dashes). The born-dead verification cannot see any of this
// because the scanner treats a table line as ordinary live text.

function fakePlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: false,
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

const TABLE = ["| H | I |", "| --- | --- |", "| a | b |"];

describe("a caret press at a table row's outer edge (main-editor path)", () => {
    it("does not append the reference after the row's closing pipe", async () => {
        const doc = sharedFakeEditor(TABLE, {
            cursor: { line: 2, ch: "| a | b |".length },
            edits: true,
            wholeDoc: true,
        });
        resetNotices();
        await insertAutonumFootnote(fakePlugin(doc));
        // a refusal (any notice, line untouched) or a landing inside the
        // row's cells both satisfy this; landing past the closing pipe does not
        expect(doc.lines[2].endsWith("|[^1]")).toBe(false);
    });

    it("does not prepend the reference before the row's opening pipe", async () => {
        const doc = sharedFakeEditor(TABLE, {
            cursor: { line: 2, ch: 0 },
            edits: true,
            wholeDoc: true,
        });
        resetNotices();
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[2].startsWith("[^1]")).toBe(false);
    });

    it("does not splice the reference into the delimiter row's dashes", async () => {
        const doc = sharedFakeEditor(TABLE, {
            cursor: { line: 1, ch: 3 },
            edits: true,
            wholeDoc: true,
        });
        resetNotices();
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[1].includes("[^1]")).toBe(false);
        expect(doc.lines[1]).toBe(TABLE[1]);
        expect(noticeCalls.length).toBeGreaterThan(0);
    });
});
