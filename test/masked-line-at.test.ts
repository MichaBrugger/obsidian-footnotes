import { describe, expect, it } from "vitest";

import { maskProtectedLines, maskedLineAt } from "../src/markdown-scan";

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
