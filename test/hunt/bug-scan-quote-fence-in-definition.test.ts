// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 2 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/parsing/footnote-grammar";
import { scanDocument } from "../../src/parsing/markdown-scan";

// A fenced code block inside a blockquote inside a footnote definition's
// indented continuation ("    > ```") renders as code, but the scanner
// leaves the code text live, so lint renumbers the fake references inside.

describe("a fence inside a blockquote inside a definition continuation", () => {
    const lines = [
        "[^1]: para",
        "    > ```",
        "    > code[^9]",
        "    > ```",
        "",
        "use[^1]",
    ];

    it.fails("protects the quoted fence lines", () => {
        const scan = scanDocument(lines);
        expect(scan.isProtected).toEqual([
            false,
            true,
            true,
            true,
            false,
            false,
        ]);
    });

    it.fails("a reference-shaped string in the code does not reserve a number", () => {
        expect(
            computeNextFootnoteNumber(
                "[^1]: para\n    > ```\n    > code[^9]\n    > ```\n\nuse[^1]",
            ),
        ).toBe(2);
    });
});
