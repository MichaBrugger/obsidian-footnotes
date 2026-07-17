import { describe, expect, it } from "vitest";

import { inlineFootnoteExitCh } from "../../src/insert-or-navigate-footnotes";

// Offset-lens probes for inlineFootnoteExitCh: exact bracket boundaries,
// escapes adjacent to the ^[ opener, offsets past end-of-line, unicode
// content, and an unclosed footnote shadowing a later closed one.

describe("inlineFootnoteExitCh probes", () => {
    it("cursor exactly ON the closing bracket exits past it", () => {
        //           0123456
        expect(inlineFootnoteExitCh("a^[bc]d", 5)).toBe(6);
    });

    it("cursor exactly at the opening bracket position (after ^) exits", () => {
        expect(inlineFootnoteExitCh("a^[bc]d", 2)).toBe(6);
    });

    it("cursor offset beyond the line length returns null", () => {
        expect(inlineFootnoteExitCh("a^[bc]d", 99)).toBeNull();
    });

    it("footnote at the very start of the line works from offset 1", () => {
        //                             0123
        expect(inlineFootnoteExitCh("^[x] y", 1)).toBe(4);
    });

    it("escaped caret does not open an inline footnote", () => {
        // \^[x] renders a literal ^ then a bracket span
        expect(inlineFootnoteExitCh("a\\^[x]b", 4)).toBeNull();
    });

    it("escaped backslash before the caret still opens a footnote", () => {
        // a\\^[x]b : literal backslash, then a real inline footnote
        //  0 1 2 34567
        const line = "a\\\\^[x]b"; // a \ \ ^ [ x ] b
        expect(inlineFootnoteExitCh(line, 5)).toBe(7);
    });

    it("surrogate-pair content keeps UTF-16 offsets consistent", () => {
        // a ^ [ 😀 ] b  → [ at 2, surrogates 3-4, ] at 5
        const line = "a^[\u{1F600}]b";
        expect(inlineFootnoteExitCh(line, 4)).toBe(6);
    });

    it("an earlier unclosed footnote does not swallow a later closed one", () => {
        //            0         1         2
        //            0123456789012345678901
        const line = "a^[open b^[closed] c";
        // ^[closed] spans 9-17; a caret inside it should exit to 18.
        // The unclosed ^[ at 1 renders as literal text and should not
        // disable exit navigation for the well-formed footnote after it.
        expect(inlineFootnoteExitCh(line, 12)).toBe(18);
    });

    it("closing bracket as the last character of the line", () => {
        //           01234
        expect(inlineFootnoteExitCh("a^[b]", 3)).toBe(5);
    });

    it("content that is a single escaped closing bracket", () => {
        // a^[\]] : content is \], real close at 5
        //  012 3 45
        const line = "a^[\\]]x";
        expect(inlineFootnoteExitCh(line, 3)).toBe(6);
    });

    it("trailing backslash inside an unclosed footnote returns null", () => {
        expect(inlineFootnoteExitCh("a^[b\\", 3)).toBeNull();
    });
});
