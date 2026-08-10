import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";

// BUG: a line like `<!-- [^9] `--> `` is a one-line HTML block (fully inert),
// but the comment's marker stays visible to autonumbering.
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: maskInlineRegions masks inline code FIRST, so the backtick run
// swallows the "-->" and the comment never gets masked.

describe("bug: inline-code masking runs before comment masking", () => {
    it.fails(
        "a backtick inside a one-line comment does not unmask the comment's marker",
        () => {
            expect(
                computeNextFootnoteNumber("<!-- [^9] `--> `\nreal[^2]"),
            ).toBe(3);
        },
    );
});
