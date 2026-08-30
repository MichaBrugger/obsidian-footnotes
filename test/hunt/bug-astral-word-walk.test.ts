import { describe, expect, it } from "vitest";

import { endOfWordOffset } from "../../src/editor/cursor-motion";

// endOfWordOffset treats astral-plane letters as non-word: the walk never starts on one, stops mid-word before one, and splits a name on CJK Ext-B kanji - diverging from the CM6 wordAt used on the main-editor path.
// Hunt: 2026-08-09. Lens: offsets.
// Root cause: the walk tests single UTF-16 code units against \p{L}, so each half of an astral surrogate pair is a lone surrogate matching no unicode property, violating the function's own grapheme-aware contract comment.

describe("fixed 2026-08-10: endOfWordOffset word walk breaks on astral-plane letters", () => {
    // Deseret alphabet letters are \p{L} but live above the BMP, so each is
    // TWO UTF-16 code units.
    const DESERET_A = "\uD801\uDC00"; // 𐐀
    const DESERET_B = "\uD801\uDC01"; // 𐐁

    it("walks to the end of a word written in astral letters", () => {
        // word spans code units 0..3, space at 4
        expect(endOfWordOffset(DESERET_A + DESERET_B + " x", 0)).toBe(4);
    });

    it("does not stop a word walk at an astral letter following a BMP letter", () => {
        // "a𐐀": the word ends after the astral letter (offset 3), not at 1
        expect(endOfWordOffset("a" + DESERET_A, 0)).toBe(3);
    });

    it("treats a CJK ext-B kanji (Japanese name character 𠮷 U+20BB7) as word", () => {
        // 田 (BMP) + 𠮷 (astral): a real surname; word ends at 3
        expect(endOfWordOffset("\u7530\uD842\uDFB7", 0)).toBe(3);
    });
});
