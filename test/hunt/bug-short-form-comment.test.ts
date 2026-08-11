import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/footnote-grammar";

// BUG: "<!-->" and "<!--->" mid-line are COMPLETE comments per CommonMark
// 0.31.2 §6.6, but protectedLines enters multi-line comment state and hides
// the rest of the note.
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: indexOf("-->", open+4) misses the overlapping closer.

describe("fixed 2026-08-10: complete short comments <!--> and <!---> mid-line", () => {
    it("<!--> mid-line is a complete comment, not an opener", () => {
        expect(computeNextFootnoteNumber("x <!-->\nreal[^1]")).toBe(2);
    });

    it("<!---> mid-line is a complete comment, not an opener", () => {
        expect(computeNextFootnoteNumber("x <!--->\nreal[^1]")).toBe(2);
    });

    it("text after a complete <!--> on the same line is live", () => {
        expect(computeNextFootnoteNumber("x <!--> [^9]\nreal[^1]")).toBe(10);
    });
});
