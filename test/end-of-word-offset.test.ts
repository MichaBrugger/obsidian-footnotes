import { describe, expect, it } from "vitest";

import { endOfWordOffset } from "../src/cursor-motion";

// Cell-local twin of the main editor's end-of-word adjustment: used when
// inserting a reference inside an actively edited table cell, where the main
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

    // ! and ? are in the lint transform's punctuation set; skipping only
    // . , : ; here made the two features fight (hunt 2026-07-17)
    it("hops over a terminal exclamation mark", () => {
        expect(endOfWordOffset("Hello!", 2)).toBe(6);
    });

    it("hops over a terminal question mark", () => {
        expect(endOfWordOffset("Really?", 2)).toBe(7);
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

// Unicode awareness (hunt 2026-07-17): a bare per-code-unit /\w/ walk matched
// neither combining marks (U+0301) nor precomposed accented letters (U+00E9),
// so a reference inserted in a table cell could land mid-grapheme or mid-word.
// Strings use \u escapes so decomposed vs precomposed is exact.
describe("endOfWordOffset and unicode graphemes/words", () => {
    const COMBINING_ACUTE = String.fromCharCode(0x0301);
    const PRECOMPOSED_E_ACUTE = String.fromCharCode(0x00e9);

    it("does not split a decomposed combining mark off its base letter", () => {
        // c0 a1 f2 e3 U+0301(4) ,5 (space)6 x7 — word spans 0..4, comma hopped → 6.
        const text = "cafe" + COMBINING_ACUTE + ", x";
        expect(endOfWordOffset(text, 2)).toBe(6);
    });

    it("does not stop at a combining mark at the start of a word", () => {
        // e0 U+0301(1) t2 u3 d4 e5 (space)6 x7 — the word ends at 6.
        const text = "e" + COMBINING_ACUTE + "tude x";
        expect(endOfWordOffset(text, 0)).toBe(6);
    });

    it("treats a precomposed accented word as one word", () => {
        // c0 a1 f2 U+00E9(3) (space)4 x5 — the word ends at 4, not 3.
        const text = "caf" + PRECOMPOSED_E_ACUTE + " x";
        expect(endOfWordOffset(text, 2)).toBe(4);
    });
});

// found by fast-check on its first run (2026-08-10): a caret offset landing
// mid-surrogate-pair snaps back to the code point boundary before walking
describe("mid-surrogate-pair offsets", () => {
    it("snaps a mid-pair start to the pair's boundary and walks the word", () => {
        // "𐐀 " — offset 1 is inside the astral letter; the word ends at 2
        expect(endOfWordOffset("\uD801\uDC00 ", 1)).toBe(2);
    });
});
