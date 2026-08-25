import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import { fakeEditor as sharedFakeEditor } from "./helpers/fake-editor";

import { exitInlineFootnoteIfInside } from "../src/commands/inline-footnotes";

// QOL (2026-07-18): the numbered/named hotkeys pressed INSIDE an inline
// footnote hop the caret past its closing bracket instead of nesting a
// "[^x]" reference in there, which would end the inline footnote early
// ("^[in [^named]line]").

function fakeEditor(line: string, ch: number) {
    const doc = sharedFakeEditor([line], { cursor: { line: 0, ch } });
    return { doc, moves: doc.moves };
}

describe("exitInlineFootnoteIfInside", () => {
    it("hops past the closing bracket when the caret is inside", () => {
        const line = "text ^[an inline footnote] more";
        const { doc, moves } = fakeEditor(line, 10);
        expect(exitInlineFootnoteIfInside(doc, null)).toBe(true);
        expect(moves).toEqual([{ line: 0, ch: line.indexOf("]") + 1 }]);
    });

    it("does nothing when the caret is outside", () => {
        const { doc, moves } = fakeEditor("text ^[inline] more", 17);
        expect(exitInlineFootnoteIfInside(doc, null)).toBe(false);
        expect(moves).toEqual([]);
    });

    // bracket-walking definitions (nesting, escapes, unclosed) are the pure
    // core's spec — see inline-footnote-exit.test.ts; this file only pins
    // the wrapper's delegation and editor plumbing

    it("routes through the cell editor when a table cell is active", () => {
        const dispatches: unknown[] = [];
        const cell = {
            state: {
                doc: { toString: () => "cell ^[inline] text" },
                selection: { main: { head: 9 } },
            },
            dispatch: (tr: unknown) => dispatches.push(tr),
        };
        const handled = exitInlineFootnoteIfInside(
            {} as unknown as Editor,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cell as any,
        );
        expect(handled).toBe(true);
        expect(dispatches).toEqual([
            { selection: { anchor: "cell ^[inline]".length } },
        ]);
    });
});
