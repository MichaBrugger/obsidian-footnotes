import { describe, expect, it } from "vitest";

import { endOfWordOffset } from "../../src/insert-or-navigate-footnotes";

// BUG: endOfWordOffset is not unicode-aware. It walks the text with a bare
// per-code-unit /\w/ test, which matches neither combining marks (U+0301) nor
// precomposed accented letters (U+00E9). It is the cell-local twin of the main
// editor's word-at adjustment (CodeMirror wordAt walks grapheme clusters and
// \p{Alphabetic}); the divergence means a footnote marker inserted in a table
// cell can land mid-grapheme (between a base letter and its accent) or mid-word
// — visibly corrupting common accented words.
// Strings use ASCII \u escapes so decomposed vs precomposed is exact.
// Hunt: 2026-07-17. Lens: offsets. Severity: wrong-output (in-cell corruption).

const COMBINING_ACUTE = String.fromCharCode(0x0301);
const PRECOMPOSED_E_ACUTE = String.fromCharCode(0x00e9);

describe("bug: endOfWordOffset splits unicode graphemes/words", () => {
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
