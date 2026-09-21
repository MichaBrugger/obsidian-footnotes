import { describe, expect, it } from "vitest";

import {
    ClosingMarkChars,
    FootnotePlacement,
    referenceLandingAfter,
    TrailingPunctuationChars,
} from "../src/parsing/markdown-scan";

// Footnote reference placement relative to punctuation (T5 of the 2026-09
// feature round; Jason's ruling 2026-09-20: one global three-way setting,
// after / before / don't move, default after). "After" is the convention
// English, Taiwanese, Korean and Dutch writing share; "before" is mainland
// Chinese, Japanese, French, Italian, Portuguese, Polish and the EU style
// guide; "don't move" is for Russian, Polish per-mark placement, German and
// mixed-script notes placed by hand. Every convention found puts the marker
// AFTER a closing quotation bracket, so closing marks are stepped over in
// every mode, and in "before" mode a punctuation run that a closing mark
// follows is stepped over together with it. Research saved in the
// project's "Footnote placement research 2026-09-20.md".

/** Where a reference lands after the word that ends `word.length` characters into `text`. */
function landing(text: string, wordLength: number, placement?: FootnotePlacement): number {
    return referenceLandingAfter(text, wordLength, placement);
}

describe("referenceLandingAfter, after punctuation (the default and today's behaviour)", () => {
    it("steps past punctuation and closing marks, with no placement given", () => {
        expect(landing("word.", 4)).toBe(5);
        expect(landing('"word".', 5)).toBe(7);
    });

    it("steps past punctuation and closing marks when asked for 'after'", () => {
        expect(landing("word.", 4, "after")).toBe(5);
        expect(landing("「句子。」", 3, "after")).toBe(5);
    });
});

describe("referenceLandingAfter, before punctuation", () => {
    it("stops at the end of the word in front of punctuation", () => {
        expect(landing("word.", 4, "before")).toBe(4);
        expect(landing("word... next", 4, "before")).toBe(4);
        expect(landing("句子。", 2, "before")).toBe(2);
    });

    it("still steps past a closing mark", () => {
        expect(landing('"word"', 5, "before")).toBe(6);
        expect(landing("**bold**", 6, "before")).toBe(8);
    });

    it("steps over punctuation that sits inside a closing quote, together with the quote", () => {
        // the marker goes after the closing bracket in every convention found
        expect(landing("「句子。」", 3, "before")).toBe(5);
        expect(landing('"quoted."', 7, "before")).toBe(9);
        expect(landing("word.”", 4, "before")).toBe(6);
        expect(landing("(see this.) next", 10, "before")).toBe(11);
    });

    it("stops in front of punctuation that follows a closing mark", () => {
        expect(landing('"word".', 5, "before")).toBe(6);
        expect(landing("word.”.", 4, "before")).toBe(6);
    });
});

describe("referenceLandingAfter, don't move", () => {
    it("stops at the end of the word in front of punctuation", () => {
        expect(landing("word.", 4, "none")).toBe(4);
    });

    it("still steps past closing marks, and stops before the punctuation after them", () => {
        expect(landing('"word".', 5, "none")).toBe(6);
        expect(landing("word)", 4, "none")).toBe(5);
    });

    it("does not step over punctuation even inside a closing quote", () => {
        expect(landing('"quoted."', 7, "none")).toBe(7);
    });
});

describe("the fourteen marks added on 2026-09-21 (the CJK coverage audit of 2026-09-19)", () => {
    it("adds the fullwidth and halfwidth stops, the two ellipses and the doubled marks to the trailing set", () => {
        for (const mark of "．｡､⋯‥‼⁇⁈⁉") {
            expect(TrailingPunctuationChars.includes(mark), mark).toBe(true);
        }
    });

    it("adds the halfwidth and fullwidth closing brackets and the prime quotes to the closing set", () => {
        for (const mark of "｣］｝｠〗〙〛〞〟") {
            expect(ClosingMarkChars.includes(mark), mark).toBe(true);
        }
    });

    it("keeps the word-internal marks out of both sets", () => {
        for (const mark of "ー・･－〜～") {
            expect(TrailingPunctuationChars.includes(mark), mark).toBe(false);
            expect(ClosingMarkChars.includes(mark), mark).toBe(false);
        }
    });

    it("walks over them like any other mark", () => {
        expect(landing("word．", 4)).toBe(5);
        expect(landing("word⋯⋯", 4)).toBe(6);
        expect(landing("word｣.", 4)).toBe(6);
        expect(landing("word.｣", 4, "before")).toBe(6);
        expect(landing("word‼", 4, "none")).toBe(4);
    });
});
