import { describe, expect, it } from "vitest";

import { maskInlineRegions } from "../../src/parsing/markdown-scan";

// Review B1 (2026-09-09): insideReferenceShape walked outward from every
// dollar and backtick candidate, to the start of the line whenever no
// bracket or NUL lay behind it, so a long line of prices masked in
// quadratic time (measured: 1000 chars 14 ms, 8000 chars 344 ms). The walk
// is now answered from two lazily built state tables. The bound here is
// generous on purpose (a timing pin must not flake on a slow machine); the
// old code missed it by a factor of ten and more.

describe("masking a long line of dollars and backticks", () => {
    const shapes = [
        "$ ".repeat(4000),
        "` ".repeat(4000),
        "$5 or $6 and ".repeat(600),
        "`a` ".repeat(2000),
        "[^x] ".repeat(1600),
    ];

    it.each(shapes.map((s, i) => [i, s] as const))("shape %i masks in linear-ish time", (_i, line) => {
        const started = performance.now();
        const masked = maskInlineRegions(line);
        const took = performance.now() - started;
        expect(masked.length).toBe(line.length);
        expect(took).toBeLessThan(150);
    });

    it("keeps the reference guard's answers", () => {
        // a dollar inside a reference shape is id text, not math
        expect(maskInlineRegions("pay[^a$1] and[^b$2] now")).toBe("pay[^a$1] and[^b$2] now");
        // an unclosed "[^" is a bracket: the code span and the math both mask
        const masked = maskInlineRegions("`[^` $[^1].$");
        expect(masked.startsWith("\0\0\0\0")).toBe(true);
        expect(masked.endsWith("\0".repeat(7))).toBe(true);
    });
});
