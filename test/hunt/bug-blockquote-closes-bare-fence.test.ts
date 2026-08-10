import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";

// BUG: a "> ```" (or "> ~~~") line CLOSES a fence opened at document level;
// per CommonMark a blockquote line is fence content (containers can't
// interrupt an open fence), so the fence runs to EOF and everything the
// plugin exposes after it gets rewritten as live prose.
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: protectedLines strips blockquote prefixes from closer
// candidates without tracking the opener's container.

describe("bug: blockquote-prefixed delimiter closes a bare fence", () => {
    it.fails("a blockquote-prefixed delimiter does not close a bare fence (backtick)", () => {
        expect(computeNextFootnoteNumber("```\ncode\n> ```\nreal[^1]")).toBe(1);
    });

    it.fails("a blockquote-prefixed delimiter does not close a bare fence (tilde)", () => {
        expect(computeNextFootnoteNumber("~~~\ncode\n> ~~~\nreal[^1]")).toBe(1);
    });
});
