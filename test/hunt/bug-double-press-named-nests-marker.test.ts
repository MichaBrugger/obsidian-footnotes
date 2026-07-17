import { Editor, EditorChange, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { shouldCreateFootnoteMarker } from "../../src/insert-or-navigate-footnotes";

// BUG: pressing the named-footnote hotkey twice in a row (before typing a name)
// nests a second empty marker inside the first: "[^]" becomes "[^[^]]". The
// first press leaves "[^]" with the caret between the brackets; the second press
// falls all the way to shouldCreateFootnoteMarker, which blindly inserts another
// "[^]" at the caret. The empty "[^]" doesn't match AllMarkers (which requires a
// non-empty name), so every earlier cascade step misses it. The inline command
// already handles the equivalent double-press by hopping the caret out; the
// named command has no guard.
// Scenario: double-pressing the named hotkey corrupts "[^]" into "[^[^]]".
// pinned 2026-07-17, hunt-bugs consolidation.
// Provenance: iteration-1/eval-1/without_skill/run-1 (bug sweep, BUG 5).

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition | null;
}

function fakeEditor(lines: string[]): FakeDoc {
    const doc = {
        appliedChanges: [] as EditorChange[],
        cursor: null as EditorPosition | null,
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
        setCursor(pos: EditorPosition) {
            doc.cursor = pos;
        },
        scrollIntoView() {},
        transaction(spec: { changes?: EditorChange[]; selection?: { from: EditorPosition } }) {
            if (spec.changes) doc.appliedChanges.push(...spec.changes);
            if (spec.selection) doc.cursor = spec.selection.from;
        },
    };
    return doc as unknown as FakeDoc;
}

function fakePlugin(overrides: Record<string, unknown> = {}): FootnotePlugin {
    return {
        app: { vault: {} },
        settings: {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            ...overrides,
        },
    } as unknown as FootnotePlugin;
}

describe("bug: double-pressing the named hotkey nests [^] markers", () => {
    it("does not insert a second [^] inside the empty marker", () => {
        const line = "[^]";
        const doc = fakeEditor([line]);
        // caret between the brackets, where the first press left it
        shouldCreateFootnoteMarker(line, { line: 0, ch: 2 }, doc, fakePlugin());
        const inserted = doc.appliedChanges.some(
            (change) => change.text === "[^]" && change.from.ch === 2,
        );
        expect(inserted).toBe(false);
    });
});
