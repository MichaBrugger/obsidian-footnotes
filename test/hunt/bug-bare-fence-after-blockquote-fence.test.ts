import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";

// BUG: a fence opened inside a blockquote dies when the quote ends; a bare
// ``` after it OPENS a new document-level fence per CommonMark, but the
// plugin treats it as a clean close and exposes everything after.
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: protectedLines strips blockquote prefixes from closer
// candidates without tracking the opener's container.

describe("fixed 2026-08-10: bare delimiter after a blockquoted fence", () => {
    it("a bare delimiter after a blockquoted fence starts a new fence", () => {
        expect(
            computeNextFootnoteNumber("> ```\n> fake[^7]\n```\nreal[^1]"),
        ).toBe(1);
    });
});
