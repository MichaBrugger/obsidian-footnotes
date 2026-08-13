import { Editor, EditorChange, EditorPosition } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import FootnotePlugin from "../src/main";
import { pasteInlineFootnote } from "../src/commands/insert-or-navigate-footnotes";

// Bug (QOL sweep, 2026-08-07): the paste-inline-footnote command skipped the
// inside-an-inline-footnote guard the other insert commands share, so pasting
// with the caret inside "^[...]" nested a second "^[...]" into it — ending
// the outer footnote early and corrupting it ("^[in ^[clip]line]"). The
// press must hop the caret past the closing bracket instead, exactly like
// insertInlineFootnote's second press.

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition;
}

function fakeEditor(line: string, ch: number): FakeDoc {
    const doc = {
        appliedChanges: [] as EditorChange[],
        cursor: { line: 0, ch },
        getCursor: () => doc.cursor,
        listSelections: () => [{ anchor: doc.cursor, head: doc.cursor }],
        getLine: () => line,
        lineCount: () => 1,
        setCursor(pos: EditorPosition) {
            doc.cursor = pos;
        },
        transaction(spec: {
            changes?: EditorChange[];
            selection?: { from: EditorPosition };
        }) {
            if (spec.changes) doc.appliedChanges.push(...spec.changes);
            if (spec.selection) doc.cursor = spec.selection.from;
        },
    };
    return doc as unknown as FakeDoc;
}

function fakePlugin(doc: FakeDoc): FootnotePlugin {
    return {
        app: {
            workspace: { getActiveViewOfType: () => ({ editor: doc }) },
            vault: {},
        },
        settings: {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
        },
    } as unknown as FootnotePlugin;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("pasteInlineFootnote inside an inline footnote", () => {
    it("hops out instead of nesting the clipboard into it", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { readText: async () => "clip" },
        });
        const line = "text ^[an inline footnote] more";
        const doc = fakeEditor(line, 10);
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual({ line: 0, ch: line.indexOf("]") + 1 });
    });

    it("still pastes normally when the caret is outside", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { readText: async () => "clip" },
        });
        const doc = fakeEditor("plain text", 5);
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([
            { from: { line: 0, ch: 5 }, text: "^[clip]" },
        ]);
    });
});
