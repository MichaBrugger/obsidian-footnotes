import { describe, expect, it } from "vitest";

import { moveFootnoteDefinitionsToBottom } from "../../src/linting/rules/move-footnotes-to-the-bottom";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";
import { removeOrphanedFootnoteDefinitions } from "../../src/linting/rules/remove-orphaned-definitions";

// BUG: a definition block is allowed to end while still owning a comment
// opener whose closer is further down the note, so every rule that moves
// whole definition blocks tears the commented-out region in half.
//
// What the user would see: a footnote definition whose continuation line
// opens a comment ("    %%" or "    <!--") to hide the notes underneath it.
// Running lint moves that definition, and the opener travels with it while
// the closer stays where it was. Text the user had hidden becomes visible,
// visible text becomes hidden, and in the worst of the six cases below the
// orphan rule deletes the hidden lines outright.
//
// Why it happens: findDefinitionBlocks walks a definition's continuation
// lines and absorbs the interior of a region that a continuation line
// opens, but it stops at the end of the indented run instead of at the
// region's closer. The block it hands back therefore contains an opener
// and no closer, and every mover trusts the block boundaries it is given.
// This is not a "%%" problem: the HTML-comment twins are protected text and
// misbehave in exactly the same way, which is why all six are pinned here.
//
// Hunt: 2026-09-13. Lens: comments.
// Source of truth: the spec pin "inside a definition continuation, an
// indented opener hides the rest of the body" in spec-obsidian-comments;
// the A1 precedent (2026-09-08) recorded in findDefinitionBlocks' doc
// comment, where move-to-bottom dragged a "-->" away and left the comment
// unclosed; attack-surface "%% comments" row ("nothing inside a block
// comment is moved, renamed, or fixed"); ADR-0002 (lint never eats text the
// user did not opt into losing) for the deletion case.

describe("bug: a definition block carries a comment opener away from its closer", () => {
    // The invariant every case asserts: the lines the user commented out,
    // from the opener down to the closer, come back exactly as they were
    // typed and still next to each other.

    it.fails("move-to-bottom keeps a %% opener in a continuation line with its closer", () => {
        const doc = "x[^1] y[^2]\n\n[^1]: one\n    %%\nhidden[^2] text\n%%\n\ntail";
        expect(moveFootnoteDefinitionsToBottom(doc)).toContain("    %%\nhidden[^2] text\n%%");
    });

    it.fails("move-to-bottom keeps an HTML opener in a continuation line with its closer", () => {
        // the same shape with "<!--" and "-->", where the commented lines
        // are protected text: the definition still drags the opener off and
        // leaves the bare "-->" behind
        const doc = "x[^1] y[^2]\n\n[^1]: one\n    <!--\nhidden[^2] text\n-->\n\ntail";
        expect(moveFootnoteDefinitionsToBottom(doc)).toContain("    <!--\nhidden[^2] text\n-->");
    });

    it.fails("reindex's reordering keeps a %% opener with its closer", () => {
        const doc = "b[^2] a[^1]\n\n[^1]: one\n    %%\nhidden\n%%\n[^2]: two";
        expect(reindexFootnotes(doc)).toContain("    %%\nhidden\n%%");
    });

    it.fails("reindex's reordering keeps an HTML opener with its closer", () => {
        const doc = "b[^2] a[^1]\n\n[^1]: one\n    <!--\nhidden\n-->\n[^2]: two";
        expect(reindexFootnotes(doc)).toContain("    <!--\nhidden\n-->");
    });

    it.fails("deleting an orphaned definition leaves the %% lines it was hiding alone", () => {
        // "[^9]" has no reference, so the orphan rule deletes its block.
        // The block wrongly includes the comment opener, so the deletion
        // takes the opener away and the commented-out definition below it
        // comes back to life.
        const doc = "a[^1]\n\n[^9]: orphan\n    %%\n[^1]: one\n%%";
        expect(removeOrphanedFootnoteDefinitions(doc)).toContain("    %%\n[^1]: one\n%%");
    });

    it.fails("deleting an orphaned definition leaves the HTML lines it was hiding alone", () => {
        // The worst of the six: here the commented-out "[^1]: one" line is
        // inside the deleted block, so it is not revealed but destroyed.
        // The note comes back as "a[^1]", a blank line, and a lone "-->".
        const doc = "a[^1]\n\n[^9]: orphan\n    <!--\n[^1]: one\n-->";
        expect(removeOrphanedFootnoteDefinitions(doc)).toContain("    <!--\n[^1]: one\n-->");
    });
});
