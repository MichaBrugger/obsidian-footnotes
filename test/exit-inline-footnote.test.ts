import { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import { exitInlineFootnoteIfInside } from "../src/insert-or-navigate-footnotes";

// QOL (2026-07-18): the numbered/named hotkeys pressed INSIDE an inline
// footnote hop the caret past its closing bracket instead of nesting a
// "[^x]" marker in there, which would end the inline footnote early
// ("^[in [^named]line]").

function fakeEditor(line: string, ch: number) {
    const moves: EditorPosition[] = [];
    const doc = {
        getLine: () => line,
        getCursor: () => ({ line: 0, ch }),
        setCursor: (pos: EditorPosition) => moves.push(pos),
    } as unknown as Editor;
    return { doc, moves };
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

    it("steps over nested balanced brackets", () => {
        const line = "a ^[with [link](x) inside] b";
        const { doc, moves } = fakeEditor(line, 6);
        expect(exitInlineFootnoteIfInside(doc, null)).toBe(true);
        expect(moves).toEqual([{ line: 0, ch: line.lastIndexOf("]") + 1 }]);
    });

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
