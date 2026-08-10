import { describe, expect, it } from "vitest";

import {
    maskLineRegions,
    maskProtectedLines,
    maskedLineAt,
} from "../src/markdown-scan";

// Perf helper (2026-08-07): the per-keypress paths need exactly ONE line of
// the document's masked twin; maskedLineAt must agree with the full
// maskProtectedLines on every line, while only paying inline-masking cost
// for the line asked about.

describe("maskedLineAt", () => {
    const cases: string[][] = [
        ["plain text [^1] here", "more `code [^2]` text"],
        ["```", "fenced [^3] fake", "```", "after"],
        ["---", "footnote-prefix: 2.", "---", "body [^4]"],
        ["a <!-- [^5] --> b", "> quoted ```", "> still [^6] fenced"],
        // multi-line comment BOUNDARY lines: live before the opener and
        // after the closer, masked in between (fixed 2026-08-10)
        ["live[^7] <!-- open", "interior [^8]", "--> tail[^9]"],
        // escape, code-span, and short-form openers never start comments
        ["\\<!-- literal", "x `<!--` y", "short <!--> form", "live[^10]"],
    ];

    it("matches maskProtectedLines line by line", () => {
        for (const lines of cases) {
            const full = maskProtectedLines(lines);
            for (let i = 0; i < lines.length; i++) {
                expect(maskedLineAt(lines, i)).toBe(full[i]);
            }
        }
    });

    it("returns an empty string for an out-of-range index", () => {
        expect(maskedLineAt(["only line"], 5)).toBe("");
        expect(maskedLineAt([], 0)).toBe("");
    });
});

// the combined one-pass scanner behind all masking (2026-08-10): code spans
// and comments claim content leftmost-first, CommonMark-style
describe("maskLineRegions", () => {
    const NUL = (n: number) => "\0".repeat(n);

    it("masks a comment opener through EOL and reports the open state", () => {
        const { masked, endsInComment } = maskLineRegions("ab <!-- open");
        expect(masked).toBe("ab " + NUL("<!-- open".length));
        expect(endsInComment).toBe(true);
    });

    it("a line starting in a comment is masked up to its closer", () => {
        const { masked, endsInComment } = maskLineRegions("gone --> live", true);
        expect(masked).toBe(NUL("gone -->".length) + " live");
        expect(endsInComment).toBe(false);
    });

    it("a comment claims backticks inside it; code claims openers inside it", () => {
        // comment first: its closer inside the backticks still closes it
        expect(maskLineRegions("<!-- a `--> ` b").masked).toBe(
            NUL("<!-- a `-->".length) + " ` b",
        );
        // code first: the opener inside the span never starts a comment
        expect(maskLineRegions("`<!--` b").endsInComment).toBe(false);
    });

    it("escaped openers of both kinds are literal", () => {
        expect(maskLineRegions("\\<!-- x").masked).toBe("\\<!-- x");
        expect(maskLineRegions("\\`not code` x").masked).toBe("\\`not code` x");
    });

    it("short-form comments are complete", () => {
        expect(maskLineRegions("a <!--> b").endsInComment).toBe(false);
        expect(maskLineRegions("a <!---> b").endsInComment).toBe(false);
    });
});

// REVERSED 2026-08-10: Jason verified live that "$" inside a footnote
// reference is id text, not math — nearby dollar-signed ids never pair
describe("dollars inside references vs math", () => {
    it("two dollar-signed ids on one line never pair into math", () => {
        const line = "b[^a$9] a[^a$4] end";
        expect(maskLineRegions(line).masked).toBe(line);
    });

    it("a reference BETWEEN two dollars is still math content", () => {
        const { masked } = maskLineRegions("cost $[^7]$ real[^1]");
        expect(masked).toBe("cost " + "\0".repeat("$[^7]$".length) + " real[^1]");
    });
});
