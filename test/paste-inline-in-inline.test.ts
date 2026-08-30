import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeEditor as sharedFakeEditor, FakeEditor } from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

import FootnotePlugin from "../src/main";
import { pasteInlineFootnote } from "../src/commands/insert-or-navigate-footnotes";

// Bug (QOL sweep, 2026-08-07): the paste-inline-footnote command skipped the
// inside-an-inline-footnote guard the other insert commands share, so pasting
// with the caret inside "^[...]" nested a second "^[...]" into it - ending
// the outer footnote early and corrupting it ("^[in ^[clip]line]"). The
// press must hop the caret past the closing bracket instead, exactly like
// insertInlineFootnote's second press.

function fakeEditor(line: string, ch: number): FakeEditor {
    return sharedFakeEditor([line], { cursor: { line: 0, ch }, edits: true });
}

function fakePlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
        },
        doc,
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("pasteInlineFootnote inside an inline footnote", () => {
    it("hops out instead of nesting the clipboard into it", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { readText: () => Promise.resolve("clip") },
        });
        const line = "text ^[an inline footnote] more";
        const doc = fakeEditor(line, 10);
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([line]);
        expect(doc.cursor).toEqual({ line: 0, ch: line.indexOf("]") + 1 });
    });

    it("still pastes normally when the caret is outside", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { readText: () => Promise.resolve("clip") },
        });
        const doc = fakeEditor("plain text", 5);
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["plain^[clip] text"]);
    });
});
