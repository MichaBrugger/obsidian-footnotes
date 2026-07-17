import { describe, expect, it } from "vitest";

import { moveFootnoteDefinitionsToBottom } from "../../src/linting/rules/move-footnotes-to-the-bottom";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// BUG (turns body prose into an h2): "prose\n---" is a setext H2. Removing or
// moving the definition line(s) that sat between a paragraph line and a "---"
// (or "___" / "***") line drops the paragraph directly onto the divider,
// silently rewriting it into a heading. Both removeLineRanges (used by reindex's
// orphan cut and by move-to-bottom) and move-to-bottom's re-layout only collapse
// doubled blank lines; neither checks what its cut leaves adjacent.
// Scenario: cutting/moving a definition strands a paragraph atop a "---" -> setext heading.
// fixed 2026-07-17: removeLineRanges reinstates a blank line when a cut would
// drop a paragraph directly onto a "---"/"===" setext underline.
// Provenance: iteration-1/eval-0/without_skill/run-1 (transform bug hunt, Bug 2).

describe("bug: removing definition lines can silently create a setext heading", () => {
    it("reindex drop-orphans does not strand a paragraph above a thematic break", () => {
        const input = "closing words[^1]\n[^9]: orphan\n---\n\n[^1]: def";
        const out = reindexFootnotes(input, { keepOrphanedDefinitions: false });
        // cutting the orphan must not leave the paragraph sitting directly above
        // the "---" — that turns it into an H2 heading
        expect(out).not.toContain("closing words[^1]\n---");
    });

    it("move-to-bottom does not strand a paragraph above a thematic break", () => {
        const input = "para one[^1] here\n[^1]: def\n---\npara two";
        const out = moveFootnoteDefinitionsToBottom(input);
        expect(out).not.toContain("para one[^1] here\n---");
    });
});
