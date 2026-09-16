// Imported from the Kimi K3 cycle 5 hunt of 2026-09-16 (OpenCode worktree); 4 of 6 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { describe, expect, it } from "vitest";

import { removeOrphanedFootnoteReferences } from "../../src/linting/rules/remove-orphaned-references";
import { lintFootnotes } from "../../src/linting/linter";

// The orphaned-reference rule's own contract: "a deletion that changes how
// Obsidian reads a line it did not touch is refused, and the orphan stays
// for the user to sort out" (remove-orphaned-references.ts). The cycle-4
// hunt added the blockKind check for a leftover marker that turns the CUT
// line into a heading, a rule, a bullet, an ordered item, or a fence
// (bug-orphan-delete-forms-block-start). It missed the marker that turns
// the line ABOVE the cut into a heading: a setext underline.
//
// "para" over "[^9]==" is two paragraph lines. Delete the orphaned "[^9]"
// and the line is "==" - a setext underline, one or more "=" signs being
// all CommonMark 4.3 asks for - and "para" becomes a level-1 heading. The
// reclassified line is the UNCHANGED line above the cut, which the guard
// never compares, and "==" (like "--" or a lone "=") is shorter than the
// three characters blockKind's rule needs, so nothing else catches it.
// The plugin's own scanner reads the result as a heading (blockEnder's
// paragraphOpen branch, and the cycle-3 probe that pinned "one line above
// the underline makes a heading"), so the lint flatly contradicts its own
// reading of the note.
//
// What the user sees: with `Delete orphaned references` ON, a stray
// reference they typed in front of some dashes or equals signs gets
// deleted, and their plain paragraph line silently turns into a giant
// heading. No alert fires - the deletion "succeeded".
//
// Source of truth: the rule's refusal contract + CommonMark 4.3 (setext
// heading underline is one or more = or -) + the plugin's own blockEnder
// in markdown-scan.ts, which reads "para\n==" as a heading. Verified with
// the micromark oracle: "para\n==" parses as a heading.
//
// Settings involved: `Delete orphaned references` ON.

const options = {
    fixPunctuation: false,
    moveDefinitionsToBottom: false,
    reindex: false,
    removeOrphanedReferences: true,
    removeOrphanedDefinitions: false,
};

describe("orphan-reference deletion leaving a setext underline under a paragraph", () => {
    it("a lone '=': 'para' over '[^9]=' must not become a heading", () => {
        const doc = "para\n[^9]=\n\ntext[^1]\n\n[^1]: d";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });

    it("'==': 'para' over '[^9]==' must not become a heading", () => {
        const doc = "para\n[^9]==\n\ntext[^1]\n\n[^1]: d";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });

    it("'--': 'para' over '[^9]--' must not become a heading", () => {
        const doc = "para\n[^9]--\n\ntext[^1]\n\n[^1]: d";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });

    it("the full lint refuses it too (the same guard, one pipeline down)", () => {
        const doc = "para\n[^9]==\n\ntext[^1]\n\n[^1]: d";
        expect(lintFootnotes(doc, options)).toBe(doc);
    });

    it("control: three dashes ARE refused today (blockKind knows a rule)", () => {
        const doc = "para\n[^9]---\n\ntext[^1]\n\n[^1]: d";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });

    it("control: an ordinary orphan deletion goes through untouched", () => {
        expect(removeOrphanedFootnoteReferences("keep[^1] drop[^9] end\n\n[^1]: one")).toBe(
            "keep[^1] drop end\n\n[^1]: one",
        );
    });
});
