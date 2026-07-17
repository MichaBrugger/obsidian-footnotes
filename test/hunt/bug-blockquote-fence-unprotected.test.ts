import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";

// BUG: a fenced code block nested inside a blockquote or callout is not
// protected. `protectedLines`' fence-open regex is anchored at column 0
// (up to 3 leading spaces only), so a "> ```" opener — valid CommonMark, and
// how Obsidian renders code inside a blockquote/callout — is never recognized.
// Footnote-shaped text inside the quoted code is counted as a live marker and
// gets rewritten by reindex/tidy (the exact class issue #41 fixed for
// top-level fences).
// Hunt: 2026-07-17. Lens: contexts / regressions. Severity: data-loss.
// fixed 2026-07-17: protectedLines strips a leading blockquote/callout prefix
// before testing the fence delimiters.

describe("bug: fenced code inside a blockquote/callout is not protected", () => {
    it("a fenced block inside a blockquote is protected", () => {
        expect(
            computeNextFootnoteNumber("> ```\n> fake[^7]\n> ```\nreal[^1]"),
        ).toBe(2);
    });

    it("a fenced block inside a callout is protected", () => {
        expect(
            computeNextFootnoteNumber(
                "> [!note]\n> ```\n> fake[^7]\n> ```\nreal[^1]",
            ),
        ).toBe(2);
    });
});
