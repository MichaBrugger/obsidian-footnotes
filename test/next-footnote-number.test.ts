import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../src/insert-or-navigate-footnotes";

// The pure core of the auto-numbered command: next number = highest
// existing numbered marker/detail + 1. Deliberate policy pinned here:
// gaps are never reused and named footnotes never count.

describe("computeNextFootnoteNumber", () => {
    it("returns 1 for an empty document", () => {
        expect(computeNextFootnoteNumber("")).toBe(1);
    });

    it("returns 1 for a document with no footnotes", () => {
        expect(computeNextFootnoteNumber("plain prose, nothing here")).toBe(1);
    });

    it("returns one more than the highest number", () => {
        expect(computeNextFootnoteNumber("alpha[^1] bravo[^2]")).toBe(3);
    });

    it("does not fill gaps in the numbering", () => {
        // [^2] is free, but reusing it would silently merge with a footnote
        // the user may still intend to create; max+1 is always safe
        expect(computeNextFootnoteNumber("alpha[^1] bravo[^3]")).toBe(4);
    });

    it("ignores named footnotes", () => {
        expect(computeNextFootnoteNumber("alpha[^note] bravo[^why]")).toBe(1);
    });

    it("counts only the numbered markers in a mixed document", () => {
        expect(computeNextFootnoteNumber("alpha[^note] bravo[^4]")).toBe(5);
    });

    it("counts a number used twice only once", () => {
        expect(computeNextFootnoteNumber("alpha[^2] bravo[^2]")).toBe(3);
    });

    it("counts detail lines as well as markers", () => {
        // an orphaned detail still reserves its number
        expect(computeNextFootnoteNumber("[^7]: an orphaned detail")).toBe(8);
    });

    it("handles multi-digit numbers", () => {
        expect(computeNextFootnoteNumber("alpha[^10]")).toBe(11);
    });

    it("never returns less than 1", () => {
        expect(computeNextFootnoteNumber("alpha[^0]")).toBe(1);
    });

    it("scans across lines", () => {
        const text = "alpha[^1] bravo\ncharlie\n\n[^1]: one\n[^5]: five";
        expect(computeNextFootnoteNumber(text)).toBe(6);
    });
});
