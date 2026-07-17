import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// Spec questions surfaced by the hunt: the code is self-consistent, but the
// behavior is surprising/undocumented. Each is pinned as it.fails so it flips
// red if/when the behavior is deliberately changed. Jason decides bug vs
// intended. Hunt: 2026-07-17.

describe("spec questions (Jason decides: bug or intended?)", () => {
    // spec question: maskInlineCode masks per single line (documented), so an
    // inline code span whose backtick run opens on one line and closes on the
    // next (valid CommonMark) is NOT masked — the [^7] inside it reserves a
    // number. Lens: contexts. Currently returns 8.
    it.fails("an inline code span wrapping across lines masks its marker", () => {
        expect(
            computeNextFootnoteNumber("a `code\nspan[^7] more` b\nreal[^1]"),
        ).toBe(2);
    });

    // spec question: HTML comments are not a protected region. A marker inside
    // "<!-- ... -->" renders as nothing but still reserves a number. The plugin
    // only ever documented frontmatter + fenced/inline code as protected.
    // Lens: contexts. Currently returns 8.
    it.fails("a marker inside an HTML comment does not reserve a number", () => {
        expect(computeNextFootnoteNumber("<!-- old[^7] -->\nreal[^1]")).toBe(2);
    });

    // spec question: math ($...$ and $$...$$, an Obsidian/MathJax extension) is
    // not a protected region, so a marker-shaped token inside math reserves a
    // number. Lens: contexts. Currently returns 8 for both.
    it.fails("a marker inside inline math does not reserve a number", () => {
        expect(computeNextFootnoteNumber("cost $[^7]$ real[^1]")).toBe(2);
    });
    it.fails("a marker inside display math does not reserve a number", () => {
        expect(computeNextFootnoteNumber("$$\nx[^7]\n$$\nreal[^1]")).toBe(2);
    });

    // spec question: reindex/lint have no awareness of the footnote-prefix
    // property (issue #31). A chapter note using prefix "12" has markers like
    // [^121]/[^122]; because those names match /^\d+$/, reindex renumbers them
    // to [^1]/[^2], collapsing the namespace the prefix exists to preserve.
    // Lens: interactions. Currently the prefixed names do NOT survive.
    it.fails("reindex preserves a numeric footnote-prefix namespace", () => {
        const doc = "a[^121] b[^122].\n\n[^121]: one\n[^122]: two";
        expect(reindexFootnotes(doc)).toContain("[^121]");
    });
});
