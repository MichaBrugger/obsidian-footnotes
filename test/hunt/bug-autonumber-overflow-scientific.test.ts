import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";

// BUG: autonumbering goes through a JavaScript Number, so a marker with a huge
// number (beyond 2^53) makes the next footnote id render in scientific notation.
// computeNextFootnoteNumber does `Number(match[1]) + 1` and returns a number the
// caller stringifies; after "[^99999999999999999999999]" the next value is
// 1e+23, so the plugin would insert a literal "[^1e+23]". The next number should
// always be a plain integer string.
// Scenario: an absurdly large existing footnote number yields a "[^1e+23]" id.
// pinned 2026-07-17, hunt-bugs consolidation.
// Provenance: iteration-1/eval-1/without_skill/run-1 (bug sweep, BUG 7).

describe("bug: absurdly large footnote numbers break autonumbering", () => {
    it("the next footnote number formats as a plain integer", () => {
        const next = computeNextFootnoteNumber(
            "Alpha[^99999999999999999999999].",
        );
        expect(String(next)).toMatch(/^\d+$/);
    });
});
