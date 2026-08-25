import { EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import { fakeEditor as sharedFakeEditor, FakeEditor } from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

import FootnotePlugin from "../src/main";
import { insertAutonumFootnote } from "../src/commands/insert-or-navigate-footnotes";

// Bug (Jason, from beta.9 phone testing 2026-08-09): mid-way through
// creating a named footnote (name typed, definition not yet created), an
// accidental press of the NUMBERED key inserted a numbered reference right
// inside the named reference's brackets ("[^na[^1]me]"). The numbered
// cascade had no "reference without a definition" step, so the press fell
// through to plain insertion at the caret. It now continues the
// half-built footnote instead, creating the missing definition, exactly like
// the named and inline keys already do in that spot.

function fakeEditor(lines: string[], cursor: EditorPosition): FakeEditor {
    return sharedFakeEditor(lines, {
        cursor,
        edits: true,
        wholeDoc: true,
        words: true,
    });
}

function fakePlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: true,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: true,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

describe("numbered key inside a definition-less reference", () => {
    it("creates the named reference's definition instead of nesting [^N]", async () => {
        // caret where the user just typed the name: inside [^note]
        const line = "Alpha[^note] bravo";
        const doc = fakeEditor([line], { line: 0, ch: 8 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([line, "", "[^note]: "]);
    });

    it("does the same for a hand-typed numbered reference without a definition", async () => {
        const line = "Alpha[^7] bravo";
        const doc = fakeEditor([line], { line: 0, ch: 7 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([line, "", "[^7]: "]);
    });

    it("still navigates when the reference already has a definition", async () => {
        const lines = ["Alpha[^note] bravo", "", "[^note]: existing"];
        const doc = fakeEditor(lines, { line: 0, ch: 8 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(lines);
        expect(doc.cursor).toEqual({ line: 2, ch: "[^note]: existing".length });
    });

    it("a caret outside any reference still inserts a numbered footnote", async () => {
        const doc = fakeEditor(["Alpha bravo"], { line: 0, ch: 2 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines.join("\n")).toContain("[^1]");
    });
});
