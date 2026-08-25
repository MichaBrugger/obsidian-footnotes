import { EditorPosition } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    pasteInlineFootnote,
} from "../src/commands/insert-or-navigate-footnotes";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

// Manual combo-test feedback (Jason, 2026-08-08): a second press of the
// inline hotkey while the just-inserted "^[]" was still EMPTY silently
// hopped the caret out, stranding an inline footnote with no text. Like
// the empty "[^]" reference, every footnote command now warns to fill it out
// and keeps the caret in place. A FILLED inline footnote keeps the hop:
// there the second press is the deliberate "done typing" gesture.

function fakeEditor(lines: string[], cursor: EditorPosition): FakeEditor {
    return sharedFakeEditor(lines, { cursor, edits: true, wholeDoc: true });
}

function fakePlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: false,
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

afterEach(() => {
    vi.unstubAllGlobals();
});

// caret between the brackets of "^[]", where the first press left it
const EMPTY_LINE = "word ^[] more";
const INSIDE_EMPTY = { line: 0, ch: 7 };

describe("footnote commands inside an EMPTY inline footnote", () => {
    it("inline command warns and stays instead of hopping out", async () => {
        const doc = fakeEditor([EMPTY_LINE], { ...INSIDE_EMPTY });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(INSIDE_EMPTY);
    });

    it("numbered command warns and stays too", async () => {
        const doc = fakeEditor([EMPTY_LINE], { ...INSIDE_EMPTY });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(INSIDE_EMPTY);
    });

    it("paste command warns without touching the clipboard", async () => {
        const reads = { count: 0 };
        vi.stubGlobal("navigator", {
            clipboard: {
                readText: async () => {
                    reads.count++;
                    return "clip";
                },
            },
        });
        const doc = fakeEditor([EMPTY_LINE], { ...INSIDE_EMPTY });
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(INSIDE_EMPTY);
        expect(reads.count).toBe(0);
    });

    it("whitespace-only content still counts as empty", async () => {
        const doc = fakeEditor(["word ^[  ] more"], { line: 0, ch: 8 });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual({ line: 0, ch: 8 });
    });
});

describe("a FILLED inline footnote keeps the hop-out", () => {
    it("inline second press hops past the closing bracket", async () => {
        const line = "word ^[filled note] more";
        const doc = fakeEditor([line], { line: 0, ch: 10 });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual({ line: 0, ch: line.indexOf("]") + 1 });
    });

    it("numbered command hops out of a filled inline footnote", async () => {
        const line = "word ^[filled note] more";
        const doc = fakeEditor([line], { line: 0, ch: 10 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual({ line: 0, ch: line.indexOf("]") + 1 });
    });
});
