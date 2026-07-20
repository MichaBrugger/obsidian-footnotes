import { Editor, EditorChange, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { navigateMarkerIfInside } from "../src/insert-or-navigate-footnotes";

// QOL (2026-07-20), the reverse of the inline-footnote hop: pressing the
// INLINE footnote hotkey while the caret sits inside a numbered or named
// marker must not nest "^[]" into it ("[^na^[]med]" is invalid). The press
// behaves like the numbered/named hotkey instead: jump to the marker's
// detail, or create the detail when it is missing.

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition | null;
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
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: true,
        },
    } as unknown as FootnotePlugin;
}

describe("navigateMarkerIfInside (inline hotkey on a regular marker)", () => {
    it("jumps to the detail when the caret is inside a marker that has one", () => {
        const doc = fakeEditor(["Alpha[^1] b", "", "[^1]: one"], {
            line: 0,
            ch: 7,
        });
        expect(navigateMarkerIfInside(fakePlugin(), doc, null)).toBe(true);
        // caret lands at the end of the detail, nothing was inserted
        expect(doc.cursor).toEqual({ line: 2, ch: "[^1]: one".length });
        expect(doc.appliedChanges).toEqual([]);
    });

    it("creates the missing detail like the named hotkey would", () => {
        const doc = fakeEditor(["Alpha[^note] b"], { line: 0, ch: 8 });
        expect(navigateMarkerIfInside(fakePlugin(), doc, null)).toBe(true);
        expect(doc.appliedChanges).toEqual([
            {
                from: { line: 0, ch: "Alpha[^note] b".length },
                to: { line: 0, ch: "Alpha[^note] b".length },
                text: "\n\n[^note]: ",
            },
        ]);
    });

    it("reports false when the caret is not inside any marker", () => {
        const doc = fakeEditor(["Alpha[^1] b", "", "[^1]: one"], {
            line: 0,
            ch: 2,
        });
        expect(navigateMarkerIfInside(fakePlugin(), doc, null)).toBe(false);
        expect(doc.appliedChanges).toEqual([]);
    });

    it("a caret just past the closing bracket is outside (issue #49 parity)", () => {
        const doc = fakeEditor(["Alpha[^1] b", "", "[^1]: one"], {
            line: 0,
            ch: 9,
        });
        expect(navigateMarkerIfInside(fakePlugin(), doc, null)).toBe(false);
    });

    it("a marker inside inline code is plain text (issue #41 parity)", () => {
        const doc = fakeEditor(["code `x [^1] y` end", "", "[^1]: one"], {
            line: 0,
            ch: 10,
        });
        expect(navigateMarkerIfInside(fakePlugin(), doc, null)).toBe(false);
        expect(doc.appliedChanges).toEqual([]);
    });
});
