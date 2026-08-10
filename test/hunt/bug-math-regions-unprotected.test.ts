import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";
import { lintFootnotes } from "../../src/linting/linter";
import { moveFootnoteDefinitionsToBottom } from "../../src/linting/rules/move-footnotes-to-the-bottom";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// Scenario: $...$ / $$...$$ regions are MathJax, but footnote scans treat
// reference-shaped math as Markdown footnotes and the transforms rewrite it.
// Hunt: 2026-08-10. Lenses: contexts and properties.
// The transforms don't just miscount math, they rewrite it:
// reindex renumbers $x[^9]$ to $x[^1]$, move-to-bottom rips a
// definition-shaped line out of a $$ block (leaving an empty $$\n$$ plus a
// phantom bottom definition), and the composed lint does all of it. Root
// cause: no math region anywhere in markdown-scan (IgnoreType.Math is
// declaration-only).

describe("bug: math regions are treated as Markdown footnotes", () => {
    it.fails("a reference inside inline math does not reserve a number", () => {
        expect(computeNextFootnoteNumber("cost $[^7]$ real[^1]")).toBe(2);
    });

    it.fails("a reference inside display math does not reserve a number", () => {
        expect(computeNextFootnoteNumber("$$\nx[^7]\n$$\nreal[^1]")).toBe(2);
    });

    it.fails("reindex leaves reference-shaped inline and display math unchanged", () => {
        const input = "$x[^9]$ real[^2]\n$$\ny[^8]\n$$\n\n[^2]: real";
        const out = reindexFootnotes(input);
        expect(out).toContain("$x[^9]$");
        expect(out).toContain("$$\ny[^8]\n$$");
    });

    it.fails("move-to-bottom does not extract a definition-shaped display-math line", () => {
        const input = [
            "$$",
            "[^9]: mathematical label",
            "$$",
            "prose[^2]",
            "",
            "[^2]: real",
            "tail",
        ].join("\n");
        const out = moveFootnoteDefinitionsToBottom(input);
        expect(out).toContain("$$\n[^9]: mathematical label\n$$");
    });

    it.fails("the composed lint preserves all math content", () => {
        const input =
            "---\nfootnote-prefix: 4.\n---\n$x[^9].$ real[^2].\n$$\n[^8]: mathematical label\ny[^7]\n$$\n\n[^2]: real";
        const out = lintFootnotes(input, {
            applyNotePrefix: true,
            prefixAware: true,
        });
        expect(out).toContain("$x[^9].$");
        expect(out).toContain("$$\n[^8]: mathematical label\ny[^7]\n$$");
    });
});
