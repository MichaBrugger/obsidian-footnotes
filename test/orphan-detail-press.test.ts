import { Editor, EditorChange, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { shouldJumpFromDetailToMarker } from "../src/insert-or-navigate-footnotes";

// QOL sweep (2026-08-07): pressing a footnote hotkey with the caret on an
// ORPHANED definition ("[^x]: …" with no marker anywhere) used to fall
// through the whole cascade and insert a brand-new footnote right into the
// definitions area — the user almost certainly pressed the key to jump to
// the (deleted) marker. The press is now handled with an explanatory
// notice: cascade step 1 claims it and changes nothing.

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition;
}

function fakeEditor(lines: string[], cursor: EditorPosition): FakeDoc {
    const doc = {
        appliedChanges: [] as EditorChange[],
        cursor,
        getCursor: () => doc.cursor,
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
        setCursor(pos: EditorPosition) {
            doc.cursor = pos;
        },
        scrollIntoView() {},
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

function fakePlugin(): FootnotePlugin {
    return {
        app: { vault: {} },
        settings: {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
        },
    } as unknown as FootnotePlugin;
}

describe("footnote hotkey on an orphaned definition", () => {
    it("handles the press without editing or moving the caret", () => {
        const lines = ["some text", "", "[^orphan]: stranded detail"];
        const cursor = { line: 2, ch: lines[2].length };
        const doc = fakeEditor(lines, cursor);
        expect(
            shouldJumpFromDetailToMarker(lines[2], cursor, doc, fakePlugin()),
        ).toBe(true);
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(cursor);
    });

    it("handles the press on an orphan's continuation line too", () => {
        const lines = ["text", "", "[^orphan]: first line", "    continued"];
        const cursor = { line: 3, ch: 4 };
        const doc = fakeEditor(lines, cursor);
        expect(
            shouldJumpFromDetailToMarker(lines[3], cursor, doc, fakePlugin()),
        ).toBe(true);
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(cursor);
    });

    it("still jumps to the marker when one exists", () => {
        const lines = ["ref[^1] text", "", "[^1]: detail"];
        const cursor = { line: 2, ch: lines[2].length };
        const doc = fakeEditor(lines, cursor);
        expect(
            shouldJumpFromDetailToMarker(lines[2], cursor, doc, fakePlugin()),
        ).toBe(true);
        expect(doc.cursor).toEqual({ line: 0, ch: "ref[^1]".length });
    });

    it("a detail-shaped line inside a code fence still falls through (#41)", () => {
        const lines = ["```", "[^orphan]: in code", "```"];
        const cursor = { line: 1, ch: 5 };
        const doc = fakeEditor(lines, cursor);
        expect(
            shouldJumpFromDetailToMarker(lines[1], cursor, doc, fakePlugin()),
        ).toBe(false);
    });
});
