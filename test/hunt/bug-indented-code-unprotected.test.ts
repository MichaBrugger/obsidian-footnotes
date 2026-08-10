import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";
import { applyFootnotePrefix } from "../../src/linting/rules/apply-footnote-prefix";
import { footnoteAfterPunctuation } from "../../src/linting/rules/footnote-after-punctuation";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// Scenario: unambiguous four-space-indented CommonMark code blocks at document
// start are treated as live footnote syntax and rewritten by lint transforms.
// Hunt: 2026-08-10. Lens: contexts.
// protectedLines deliberately does NOT detect indented code (documented:
// "indentation is how definition continuations work"), so the inert reference
// reserves a number (computeNextFootnoteNumber returns 91, not 3) and
// reindex / punctuation / apply-prefix rewrite inside the code block. A
// Protecting these blocks must remain context-aware because indentation is
// also valid for footnote-definition continuation lines.

describe("bug: indented code blocks are treated as live footnotes", () => {
    it.fails("autonumbering ignores standalone indented code", () => {
        expect(computeNextFootnoteNumber("    code[^90]\nreal[^2]")).toBe(3);
    });

    it.fails("reindex leaves indented code untouched", () => {
        const input = "    sample[^9]\nreal[^2]\n\n[^2]: real";
        const expected = "    sample[^9]\nreal[^1]\n\n[^1]: real";
        expect(reindexFootnotes(input)).toBe(expected);
    });

    it.fails("punctuation leaves indented code untouched", () => {
        const input = "    code[^9].\nreal[^1].";
        const expected = "    code[^9].\nreal.[^1]";
        expect(footnoteAfterPunctuation(input)).toBe(expected);
    });

    it.fails("apply-prefix leaves indented code untouched", () => {
        const input = "    code[^9]\nreal[^1]\n\n[^1]: real";
        const expected = "    code[^9]\nreal[^2.1]\n\n[^2.1]: real";
        expect(applyFootnotePrefix(input, "2.")).toBe(expected);
    });
});
