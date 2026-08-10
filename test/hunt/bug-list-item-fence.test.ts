import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";

// BUG: a fence opening on a list-item line ("- ```" / "1. ~~~") is missed:
// the code body stays live and the indented closer OPENS a phantom fence
// that swallows the note below (protection exactly inverted).
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: protectedLines has no awareness of list markers when testing
// fence delimiters.

describe("bug: a fence opening on a list-item line is not protected", () => {
    it.fails("unordered list item", () => {
        expect(
            computeNextFootnoteNumber("- ```\n  code[^9]\n  ```\nreal[^1]"),
        ).toBe(2);
    });

    it.fails("ordered list item", () => {
        expect(
            computeNextFootnoteNumber("1. ~~~\n   code[^9]\n   ~~~\nreal[^1]"),
        ).toBe(2);
    });
});
