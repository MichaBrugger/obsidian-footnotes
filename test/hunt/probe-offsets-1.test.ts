import { describe, expect, it } from "vitest";

import { endOfWordOffset } from "../../src/insert-or-navigate-footnotes";

// Offset-lens probes for endOfWordOffset: out-of-range offsets, unicode
// (combining marks, precomposed accents, surrogate pairs), punctuation at
// EOL, tabs.

describe("endOfWordOffset probes", () => {
    it("returns an offset greater than the text length unchanged", () => {
        expect(endOfWordOffset("ab", 5)).toBe(5);
    });

    it("offset exactly at length after a word stays at length", () => {
        expect(endOfWordOffset("word", 4)).toBe(4);
    });

    it("offset 0 on a word moves to its end", () => {
        expect(endOfWordOffset("word rest", 0)).toBe(4);
    });

    it("does not split a combining mark off its base letter", () => {
        // "cafe" + U+0301 combining acute = café (decomposed), then ", x"
        //          c a f e ́  ,   x
        // indices: 0 1 2 3 4  5 6 7
        const text = "café, x";
        // the word ends after the combining mark; hopping the comma gives 6.
        // Returning 4 would insert the marker BETWEEN the base letter and
        // its accent, attaching the accent to "[".
        expect(endOfWordOffset(text, 2)).toBe(6);
    });

    it("does not split a combining mark at the start of a word", () => {
        // "e" + U+0301 + "tude" = étude (decomposed)
        const text = "étude x";
        // cursor at 0 (on the base "e"): end of the word étude is 6
        expect(endOfWordOffset(text, 0)).toBe(6);
    });

    it("treats a precomposed accented word as one word", () => {
        //          c a f é(U+00E9)   x
        // indices: 0 1 2 3         4 5
        const text = "café x";
        // cursor mid-word at 2: user wants the marker after "café" (4),
        // not inside it at "caf|é" (3). The main editor's wordAt() is
        // unicode-aware; this cell-local twin should match it.
        expect(endOfWordOffset(text, 2)).toBe(4);
    });

    it("stops before an emoji following a word", () => {
        // "ab" + 😀 (surrogate pair at 2-3)
        expect(endOfWordOffset("ab\u{1F600}cd", 1)).toBe(2);
    });

    it("leaves an offset between the surrogates of an emoji unchanged", () => {
        // 😀 occupies 0-1; offset 1 is between high and low surrogate
        expect(endOfWordOffset("\u{1F600}ab", 1)).toBe(1);
    });

    it("hops trailing punctuation even at the very end of the text", () => {
        expect(endOfWordOffset("end.", 1)).toBe(4);
    });

    it("does not hop punctuation when the offset touches no word", () => {
        // cursor right after a tab, before punctuation
        expect(endOfWordOffset("a\t.b", 2)).toBe(2);
    });

    it("treats a tab as a word boundary", () => {
        expect(endOfWordOffset("ab\tcd", 1)).toBe(2);
    });

    it("underscores and digits are word characters", () => {
        expect(endOfWordOffset("foo_bar9 x", 1)).toBe(8);
    });
});
