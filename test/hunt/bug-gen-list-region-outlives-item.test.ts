// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 7 of 8 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/parsing/footnote-grammar";
import { protectedLines } from "../../src/parsing/markdown-scan";
import { fixLazyDefinitions } from "../../src/linting/rules/fix-lazy-definitions";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// What a user sees: a multi-line HTML comment or "$$" math block opened
// inside a list item ("- <!--" or "- $$") and never closed should die where
// the list item ends. Instead the region runs to the end of the note, and
// everything below is treated as hidden: autonumbering skips live
// references and "Delete orphaned definitions" leaves real orphans.
//
// Ground truth: micromark parses the text below as a live paragraph (the
// html/math block ends with its enclosing container). The plugin already
// applies this rule when the container is a BLOCKQUOTE (Sol bug #4,
// verified against metadataCache: "Comment and math regions live in the
// CONTAINER that opened them, just as fences do") - but regionDepth only
// records BLOCKQUOTE depth, so a region inside a list item outlives it.
// The list sibling of bug-blockquote-region-outlives-quote.

describe("an unclosed comment/math region inside a list item dies with the item", () => {
    it.fails("an unclosed comment in a list item: text after the item is live", () => {
        expect(protectedLines("- <!--\n  hidden\nplain[^1]".split("\n"))).toEqual([
            false,
            true,
            false,
        ]);
    });

    it.fails("a reference after the dead comment counts in autonumbering", () => {
        expect(computeNextFootnoteNumber("- <!--\n  hidden[^99]\nplain[^1]")).toBe(2);
    });

    it.fails("the next list item ends the comment", () => {
        expect(computeNextFootnoteNumber("- <!--\n  hidden[^99]\n- two[^1]")).toBe(2);
    });

    it.fails("an unclosed math block in a list item: text after the item is live", () => {
        expect(protectedLines("- $$\n  x = 1\nplain[^1]".split("\n"))).toEqual([
            false,
            true,
            false,
        ]);
    });

    it.fails("a reference after the dead math block counts in autonumbering", () => {
        expect(computeNextFootnoteNumber("- $$\n  x[^99]\nplain[^1]")).toBe(2);
    });

    it.fails("drop-orphans deletes a real orphan below a dead comment region", () => {
        const doc = "- <!--\n  hidden\nreal[^1]\n\n[^1]: def\n\n[^9]: stray";
        expect(reindexFootnotes(doc, { keepOrphanedDefinitions: false })).toBe(
            "- <!--\n  hidden\nreal[^1]\n\n[^1]: def",
        );
    });

    it.fails("a label under an orphaned '-->' line is lazy (the comment died with the item)", () => {
        // micromark: the in-item comment dies when the item ends, so the
        // document-level "-->" is live paragraph text and the label under
        // it is lazy paragraph text (the prose-label rule). The plugin
        // instead lets the bare "-->" CLOSE the comment, and a label under
        // a comment closer is a definition to it - so fix-lazy-definitions
        // wrongly leaves the hidden definition hidden.
        expect(fixLazyDefinitions("- <!--\n  hidden\n-->\n[^1]: def\nuse[^1]")).toBe(
            "- <!--\n  hidden\n-->\n\n[^1]: def\nuse[^1]",
        );
    });

    it("sanity: the blockquote arm already behaves this way", () => {
        // the verified Sol-#4 behavior in the mirror container: the quoted
        // comment dies with the quote, "-->" is live text, the label is lazy
        expect(fixLazyDefinitions("> <!--\n> hidden\n-->\n[^1]: def\nuse[^1]")).toBe(
            "> <!--\n> hidden\n-->\n\n[^1]: def\nuse[^1]",
        );
    });
});
