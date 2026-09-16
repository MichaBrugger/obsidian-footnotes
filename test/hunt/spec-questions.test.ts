import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/parsing/footnote-grammar";

// Spec questions surfaced by the hunt: the code is self-consistent, but the
// behavior is surprising/undocumented. Each is pinned as it.fails so it flips
// red if/when the behavior is deliberately changed. Jason decides bug vs
// intended. Hunt: 2026-07-17.

describe("spec questions (Jason decides: bug or intended?)", () => {
    // RESOLVED 2026-09-16 (B30, Jason's check in Obsidian): Reading view
    // renders a backtick run that opens on one line and closes on the next
    // as ONE code span, with the "[^7]" shown literally inside it, and the
    // footnote never renders even with a definition. Live Preview reads
    // it line by line, the way the plugin used to; the plugin matches
    // Reading view, as everywhere else. The scan now carries an unclosed
    // run forward to its closer within the paragraph.
    it("an inline code span wrapping across lines masks its reference", () => {
        expect(
            computeNextFootnoteNumber("a `code\nspan[^7] more` b\nreal[^1]"),
        ).toBe(2);
    });

    // RESOLVED 2026-07-17: single-line HTML comments are protected now
    // (maskCommentSpans in markdown-scan; multi-line comments were already
    // whole-line protected) - a commented-out reference is invisible.
    it("a reference inside an HTML comment does not reserve a number", () => {
        expect(computeNextFootnoteNumber("<!-- old[^7] -->\nreal[^1]")).toBe(2);
    });

    // RESOLVED 2026-08-07: the prefix work answered the old "reindex
    // collapses a numeric footnote-prefix namespace" question by design -
    // digit-ending prefixes like "12" are invalid (footnotePrefixProblem
    // blocks them before any [^121]-style ambiguity can exist), and valid
    // prefixes get namespace-aware reindexing via the prefix option
    // (spec: prefix-aware-reindex tests).
});
