import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";

// BUG: a backticked "<!--" (inline code) on an earlier line is treated as a
// real multi-line comment opener, hiding the rest of the note.
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: protectedLines scans for "<!--" without masking inline code.

describe("fixed 2026-08-10: a comment opener inside inline code is code", () => {
    it("does not let an inline-code comment opener hide later footnotes", () => {
        const markdown = "`<!--` is sample syntax\nreal[^7]\n\n[^7]: seven";

        expect(computeNextFootnoteNumber(markdown)).toBe(8);
    });
});
