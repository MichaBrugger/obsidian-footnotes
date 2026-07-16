import { describe, expect, it } from "vitest";

import { endOfWordOffset } from "../src/insert-or-navigate-footnotes";

// Cell-local twin of the main editor's end-of-word adjustment: used when
// inserting a marker inside an actively edited table cell, where the main
// editor's wordAt() can't see the cell text.

describe("endOfWordOffset", () => {
    it("moves a mid-word offset to the end of the word", () => {
        //          0123456789
        expect(endOfWordOffset("Sit dolor", 1)).toBe(3);
    });

    it("keeps an offset already at the end of a word", () => {
        expect(endOfWordOffset("Sit dolor", 3)).toBe(3);
    });

    it("hops over one trailing punctuation mark", () => {
        expect(endOfWordOffset("Sit, dolor", 1)).toBe(4);
    });

    it("hops over only one punctuation mark, not a run", () => {
        expect(endOfWordOffset("wait... what", 2)).toBe(5);
    });

    it("leaves an offset between non-word characters alone", () => {
        // e.g. the caret between the parens of "()"
        expect(endOfWordOffset("Sit ()", 5)).toBe(5);
    });

    it("leaves an offset in whitespace alone", () => {
        expect(endOfWordOffset("Sit  dolor", 4)).toBe(4);
    });

    it("moves to the end when the offset is at the start of a word", () => {
        expect(endOfWordOffset("Sit dolor", 4)).toBe(9);
    });

    it("handles an offset at the very end of the text", () => {
        expect(endOfWordOffset("Sit", 3)).toBe(3);
    });

    it("handles empty text", () => {
        expect(endOfWordOffset("", 0)).toBe(0);
    });
});
