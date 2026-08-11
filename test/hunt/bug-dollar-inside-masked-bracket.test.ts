import { describe, expect, it } from "vitest";

import { footnoteAfterPunctuation } from "../../src/linting/rules/footnote-after-punctuation";
import { maskLineRegions } from "../../src/markdown-scan";

// Bug (2026-08-11 review, Kimi): dollarInsideReference walked the RAW line
// backwards, so a "[^" fragment already masked away as code (or comment)
// still claimed every "$" after it as reference-id text — suppressing math
// masking for the rest of the line. The walk must read the masked-so-far
// characters: a NUL means the bracket run is broken by a construct that
// already claimed it, so the dollar is free to open (or close) math.

describe("a masked '[^' fragment cannot suppress math (bug-dollar-inside-masked-bracket)", () => {
    it("math after a code span containing '[^' is still masked", () => {
        const { masked } = maskLineRegions("`[^` $[^1].$ tail");
        // the code span (0..3) and the whole math span (5..11) are NULed
        expect(masked).toBe("\0\0\0\0 " + "\0".repeat(7) + " tail");
    });

    it("an unclosed $$ after a code span containing '[^' still opens a math region", () => {
        expect(maskLineRegions("`[^` $$").endsInMath).toBe(true);
    });

    it("a dollar inside a REAL reference still never opens math", () => {
        const { masked } = maskLineRegions("pay [^a$1] now $5 or $6");
        expect(masked).toBe("pay [^a$1] now $5 or $6");
    });

    it("the punctuation rule leaves the reference inside that math alone", () => {
        const text = "`[^` $[^1].$ tail";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });
});
