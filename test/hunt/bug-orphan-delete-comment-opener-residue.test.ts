// Imported from the Kimi K3 cycle 5 hunt of 2026-09-16 (OpenCode worktree); 4 of 6 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { describe, expect, it } from "vitest";

import { removeOrphanedFootnoteReferences } from "../../src/linting/rules/remove-orphaned-references";
import { lintFootnotes } from "../../src/linting/linter";

// The same refusal contract as bug-orphan-delete-setext-residue: the
// orphaned-reference rule may not delete when the cut changes how Obsidian
// reads a line it did not touch.
//
// "para" over "[^9]%%" is two paragraph lines (a "%%" mid-line never opens
// anything, sheet 11). Delete the orphaned "[^9]" and the line is a lone
// "%%" at the start of a line - the opener of an Obsidian "%%" block
// comment, which hides every line up to the next "%%" (sheet 11, ground
// truth 2026-09-09). The rest of the note disappears from Reading view.
//
// The guard misses it on every axis it checks: a "%%" block's lines are
// NOT protected (references inside them still bind, so isProtected never
// flips), no definition start appears or vanishes unless a definition
// happens to sit below and dies inside the new comment (only then does
// the definition-start check fire - the control below), and blockKind has
// no case for a comment opener.
//
// What the user sees: with `Delete orphaned references` ON, deleting one
// stray reference hides the rest of their note inside a comment block
// Obsidian renders as blank space. No alert fires.
//
// Source of truth: the rule's refusal contract + manual sheet 11 ("a %%
// at the start of a line with no second %% on that line opens a block
// comment through the next %% anywhere"; Obsidian hides the block).
//
// Settings involved: `Delete orphaned references` ON.

describe("orphan-reference deletion leaving a lone %% that opens a block comment", () => {
    it("the cut must be refused when nothing below dies to trip the starts check", () => {
        const doc = "para\n[^9]%%\nmore text\nand more";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });

    it("same when every definition sits ABOVE the cut, so the starts check has nothing to catch", () => {
        // the %% block opens under "para" and hides "more text" to the end
        // of the note; no definition sits below it, so no definition start
        // vanishes and the guard sees no difference at all
        const doc = "[^1]: d\n\ntext[^1]\n\npara\n[^9]%%\nmore text";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });

    it("control: when the opener kills a definition below, the starts check does refuse", () => {
        // "[^1]: d" ends up inside the new %% block, so a definition start
        // vanishes and the guard fires - the one case it happens to catch
        const doc = "para\n[^9]%%\nmore text\n\ntext[^1]\n\n[^1]: d";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });

    it("lint twice is not lint once: the opener kills a lazy label, minting a NEW orphan the next pass deletes", () => {
        // found by the property soak (removeOrphanedFootnoteReferences
        // idempotence, FC 3000 runs): the lazy label ">    > [^87]:" makes
        // [^87] exempt from deletion in pass one; the %% opener the cut
        // forms hides that label, the exemption lapses, and pass two eats
        // "[^87]" out of the user's label line, leaving ">    > : ..."
        const doc = "para\n[^119]%%\nmore text\n\n>    > nested[^87]\n>    > [^87]: wide-gap definition";
        const once = removeOrphanedFootnoteReferences(doc);
        expect(removeOrphanedFootnoteReferences(once)).toBe(once);
    });

    it("the same through the full lint (fix-lazy off)", () => {
        const doc = "para\n[^119]%%\nmore text\n\n>    > nested[^87]\n>    > [^87]: wide-gap definition";
        const options = {
            fixPunctuation: false,
            fixLazyDefinitions: false,
            moveDefinitionsToBottom: false,
            reindex: false,
            removeOrphanedReferences: true,
            removeOrphanedDefinitions: false,
            mergeDuplicateDefinitions: false,
            orphanSafePrefix: "",
            applyNotePrefix: false,
            sectionHeading: "",
        };
        const once = lintFootnotes(doc, options);
        expect(lintFootnotes(once, options)).toBe(once);
    });

    it("control: an ordinary orphan deletion goes through untouched", () => {
        expect(removeOrphanedFootnoteReferences("keep[^1] drop[^9] end\n\n[^1]: one")).toBe(
            "keep[^1] drop end\n\n[^1]: one",
        );
    });
});
