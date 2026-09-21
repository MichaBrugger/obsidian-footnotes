import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorPosition } from "obsidian";

import { noticed, resetNotices } from "./helpers/notices";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

import type FootnotePlugin from "../src/main";
import { insertAutonumFootnote } from "../src/commands/insert-or-navigate-footnotes";
import { TableSelectionNotice } from "../src/commands/selection-footnote";

// These tests take over three checks that used to sit on manual sheet 08
// ("Tables"). All three are about the text a press leaves behind, so a
// machine can settle them:
//
//  1. "Switch to SOURCE mode. Select `word target` inside the cell and
//     press the numbered hotkey: converts in place, pipes intact"
//  2. "Select the header row `| a | b |` through the `| --- | --- |` row"
//     (one of the four cut-through-a-table refusals)
//  3. "Select from `| 1 | 2 |` through `after the table`" (another of
//     those four)
//
// The other two refusals of that group were already pinned, in
// test/selection-to-footnote.test.ts, by "two cells of one row across
// their pipe" and "the header row alone (prose above through the
// header)".
//
// In SOURCE mode there is no live table widget, so the note is just lines
// of text and the plain fake editor is the right stand-in. The cases where
// Obsidian's own cell editor owns the caret are the smoke suite's, because
// only a running Obsidian has that editor.

function fakeEditor(
    lines: string[],
    cursor: EditorPosition,
    selection?: { anchor: EditorPosition; head: EditorPosition },
): FakeEditor {
    return sharedFakeEditor(lines, {
        cursor,
        selection,
        edits: true,
        wholeDoc: true,
    });
}

// The sheet's settings line says defaults.
function fakePlugin(
    doc: FakeEditor,
    overrides: Partial<FootnotePlugin["settings"]> = {},
): FootnotePlugin {
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
            ...overrides,
        },
        doc,
    );
}

beforeEach(() => {
    resetNotices();
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe("a several-word selection inside ONE cell, in source mode", () => {
    const table = [
        "| Convert in me | Notes |",
        "| ------------- | ----- |",
        "| cell word target | click into the cell first |",
    ];
    // where "word target" sits on the third line
    const row = table[2];
    const from = row.indexOf("word target");
    const to = from + "word target".length;

    it("converts in place and leaves every pipe where it was", async () => {
        const doc = fakeEditor(table, { line: 2, ch: from }, {
            anchor: { line: 2, ch: from },
            head: { line: 2, ch: to },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(noticed(TableSelectionNotice)).toBe(false);
        // the reference sits where the words were, and the words are now
        // the definition's body at the bottom of the note
        expect(doc.lines[2]).toBe("| cell[^1] | click into the cell first |");
        expect(doc.lines.at(-1)).toBe("[^1]: word target");
        // the row still has its four pipes, none of them escaped
        expect((doc.lines[2].match(/\|/g) ?? []).length).toBe(
            (row.match(/\|/g) ?? []).length,
        );
        expect(doc.lines[2]).not.toContain("\\|");
        // and the two rows above are untouched
        expect(doc.lines[0]).toBe(table[0]);
        expect(doc.lines[1]).toBe(table[1]);
    });
});

describe("selections that cut through a table refuse", () => {
    const table = [
        "before the table",
        "",
        "| a | b |",
        "| --- | --- |",
        "| 1 | 2 |",
        "",
        "after the table",
    ];

    it("the header row through the delimiter row below it", async () => {
        const doc = fakeEditor(table, { line: 2, ch: 0 }, {
            anchor: { line: 2, ch: 0 },
            head: { line: 3, ch: table[3].length },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(table);
        expect(noticed(TableSelectionNotice)).toBe(true);
    });

    it("the last body row through the prose below the table", async () => {
        const doc = fakeEditor(table, { line: 4, ch: 0 }, {
            anchor: { line: 4, ch: 0 },
            head: { line: 6, ch: table[6].length },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(table);
        expect(noticed(TableSelectionNotice)).toBe(true);
    });
});
