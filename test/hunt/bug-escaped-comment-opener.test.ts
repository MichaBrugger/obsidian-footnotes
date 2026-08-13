import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/parsing/footnote-grammar";

// BUG: a backslash-escaped "\<!--" is literal text per CommonMark §2.4, but
// it hides the rest of the note as if a comment opened.
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: protectedLines treats an escaped "\<!--" as a comment opener.

describe("fixed 2026-08-10: an escaped comment opener is literal text", () => {
    it("does not treat a backslash-escaped comment opener as an HTML comment", () => {
        const markdown = "\\<!-- shown literally\nreal[^7]";

        expect(computeNextFootnoteNumber(markdown)).toBe(8);
    });
});
