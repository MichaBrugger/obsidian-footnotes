// Imported from the Kimi K3 cycle 1 hunt of 2026-09-16 (OpenCode worktree); 2 of 3 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// A reference-shaped name holding whitespace ("[^my note]") is prose to
// Obsidian - it never renders (established, see the plugin's own refusal
// list) - and the rewrite half of reindex knows it: rewriteFootnoteNames
// deliberately skips names with whitespace, "a name holding whitespace is
// prose to Obsidian, not a footnote, so it is never renamed into one".
// But the ORDER half (referenceAppearanceOrder) still counts such a name
// as a footnote, so with `Renumber named footnotes` ON it is dealt a
// renumbering slot that is then never applied: the real footnotes after
// it shift up one number and the slot itself goes unused.
//
// What the user sees: a note containing prose like "[^my note]" and one
// real footnote "[^1]" lints to "[^my note]" untouched plus "[^2]" - the
// numbering starts at 2 for no reason, contradicting reindex's contract
// ("renumber 1, 2, 3 in occurrence order").
//
// Source of truth: the rule's own description (re-index-footnotes.ts
// catalogue entry) and the rewrite pass's own whitespace skip - the two
// halves of the rule disagree about whether the name is a footnote.
//
// Settings involved: `Reindex` ON + `Renumber named footnotes` ON.

describe("reindex and a reference-shaped name holding whitespace", () => {
    it("no slot is consumed for prose, so the real footnote keeps number 1", () => {
        const doc = "a[^my note] b[^1]\n\n[^1]: one";
        expect(reindexFootnotes(doc, { renumberNamedFootnotes: true })).toBe(
            "a[^my note] b[^1]\n\n[^1]: one",
        );
    });

    it("the next real footnote is not shifted past the unused slot", () => {
        const doc = "a[^my note] b[^1] c[^2]\n\n[^1]: one\n[^2]: two";
        expect(reindexFootnotes(doc, { renumberNamedFootnotes: true })).toBe(
            "a[^my note] b[^1] c[^2]\n\n[^1]: one\n[^2]: two",
        );
    });

    it("control: named footnotes renumber cleanly when no whitespace name is present", () => {
        const doc = "a[^note] b[^1]\n\n[^1]: one\n[^note]: two";
        expect(reindexFootnotes(doc, { renumberNamedFootnotes: true })).toBe(
            "a[^1] b[^2]\n\n[^1]: two\n[^2]: one",
        );
    });
});
