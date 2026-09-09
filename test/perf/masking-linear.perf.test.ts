import { describe, expect, it } from "vitest";

import { maskInlineRegions } from "../../src/parsing/markdown-scan";

// Timing pin for review B1 (2026-09-09): insideReferenceShape walked
// outward from every dollar and backtick candidate, to the start of the
// line whenever no bracket or NUL lay behind it, so a long line of prices
// masked in quadratic time (measured: 1000 chars 14 ms, 8000 chars 344 ms).
// The walk is now answered from tables built once over the raw line. The
// bound is generous on purpose (a timing pin must not flake on a slow
// machine); the old code missed it by an order of magnitude.
//
// Lives under test/perf/ because Stryker's INSTRUMENTED dry run is several
// times slower than plain vitest (527 ms here where plain runs take a few
// ms), which failed the pin and aborted the whole audit; vitest.stryker
// .config.ts excludes this folder. The behavioral half of the pin stays in
// test/hunt/spec-long-line-masking-is-linear.

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
});
