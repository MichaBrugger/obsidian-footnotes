import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/parsing/footnote-grammar";

// BUG: a line like `<!-- [^9] `--> `` is a one-line HTML block (fully inert),
// but the comment's reference stays visible to autonumbering.
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: maskInlineRegions masks inline code FIRST, so the backtick run
// swallows the "-->" and the comment never gets masked.

describe("fixed 2026-08-10: one left-to-right scan orders code vs comments", () => {
    it(
        "a backtick inside a one-line comment does not unmask the comment's reference",
        () => {
            expect(
                computeNextFootnoteNumber("<!-- [^9] `--> `\nreal[^2]"),
            ).toBe(3);
        },
    );
});
