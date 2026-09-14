import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";

import { planFootnoteRename } from "../../src/commands/rename-footnote";
import {
    orphanedFootnoteDefinitionNames,
    removeOrphanedFootnoteDefinitions,
} from "../../src/linting/rules/remove-orphaned-definitions";

// spec question: when a definition label sits inside a "%%" block comment,
// does that dead label still count as something pointing at a live footnote
// of the same name?
//
// Reading one, the ruling read strictly: it does not. The 2026-09-12 ruling
// (labelCountsAsLabel in src/commands/rename-footnote.ts, commit 0eaeb9a)
// says a label inside a block comment is a label, dead as a definition and
// not a lazy label either, so its own "[^x]" is not a reference at all. On
// that reading a real definition of the same name is an orphaned
// definition, and a name that only appears as such a label is free to take.
//
// Reading two, the cautious one: the commented label is a copy of a real
// definition the user parked, so treating it as holding the name is the
// friendlier behavior. Nothing is deleted, and no rename lands on a name
// that has a hidden twin. That is what the code does today, and both of the
// cases below therefore fail safe: the plugin destroys nothing and refuses
// instead of acting.
//
// Hunt: 2026-09-13
// Lenses: the two orphan rules, rename.
//
// Source of truth: the 2026-09-12 ruling as written in the
// labelCountsAsLabel comment in src/commands/rename-footnote.ts and in
// commit 0eaeb9a; the attack-surface "%% comments" row ("a definition
// inside a %% block is dead; nothing inside a block comment is moved,
// renamed, or fixed"); manual sheet 18 ("the commented [^o1]: line is
// untouched"); ADR-0002 for the never-silent policy.
//
// These two are filed as questions rather than as bugs because the strict
// reading has a cost the ruling did not weigh. The deletion case would turn
// a silent refusal into a real deletion of the user's definition, and the
// rename case would let a rename walk onto a name the user can see sitting
// in their note, just commented out. ADR-0002 does point the other way on
// the first one: an orphan that the rule passes over must at least be named
// in an alert, and here it is passed over in silence.
//
// Skeptic's note: whether Obsidian itself binds a commented label as a
// reference is not recorded anywhere, and it would settle the first
// question outright. A live check of that shape is listed separately in the
// report.

describe("a live definition whose only same-named twin is a commented label", () => {
    it.fails("SPEC QUESTION: is it an orphaned definition, to be named and deleted?", () => {
        // nothing live points at "[^dead]", so on the strict reading the
        // definition at the bottom is an orphaned definition: the alert
        // names it and, with the setting on, the rule takes it. Today the
        // commented label holds it alive, and no alert says so either.
        const doc =
            "prose with no references.\n\n%%\n[^dead]: commented label\n%%\n\n[^dead]: the real definition";
        expect(orphanedFootnoteDefinitionNames(doc)).toEqual(["dead"]);
        expect(removeOrphanedFootnoteDefinitions(doc)).toBe(
            "prose with no references.\n\n%%\n[^dead]: commented label\n%%",
        );
    });

    it.fails("SPEC QUESTION: the same with the commented copy written below the live one", () => {
        const doc = "prose\n\n[^9]: live\n\n%%\n[^9]: dead\n%%";
        expect(orphanedFootnoteDefinitionNames(doc)).toEqual(["9"]);
    });

    it("control: a definition whose only reference is hidden in a block survives, on either reading", () => {
        // a plain reference inside a comment is real, it binds and takes a
        // number, so this one is not in question
        const doc = "%%\nsee[^1] hidden\n%%\n\n[^1]: kept";
        expect(orphanedFootnoteDefinitionNames(doc)).toEqual([]);
        expect(removeOrphanedFootnoteDefinitions(doc)).toBe(doc);
    });

    it("control: a lazy label's own reference does keep a real definition alive", () => {
        // the shape the commented label is currently being confused with
        const doc = "prose line\n[^a]: lazy text\n\n[^a]: real definition";
        expect(orphanedFootnoteDefinitionNames(doc)).toEqual([]);
    });
});

describe("renaming onto a name that exists only as a commented label", () => {
    it.fails("SPEC QUESTION: is a dead commented label a collision?", () => {
        // on the strict reading the name "y" is dead here, so it is free to
        // take, and the caret resolver already refuses to offer that label
        // as a rename target precisely because it is not a footnote
        // (bug-rename-offers-commented-label). Today the rename is refused
        // as a collision instead.
        const lines = ["a[^x]", "", "%%", "[^y]: an old commented-out definition", "%%", "", "[^x]: d"];
        expect(planFootnoteRename(fakeEditor(lines, { wholeDoc: true }), "x", "y")).toMatchObject({
            kind: "renamed",
        });
    });

    it("control: a name that exists only as a lazy label is a collision", () => {
        // a lazy label's own "[^y]" is a live reference, so this one is a
        // real clash and the refusal is right
        const lines = ["a paragraph line", "[^y]: lazy label under prose", "", "a[^x]", "", "[^x]: d"];
        expect(planFootnoteRename(fakeEditor(lines, { wholeDoc: true }), "x", "y")).toEqual({
            kind: "collision",
        });
    });

    it("control: a name that exists only inside a fence is a fake, so no collision", () => {
        const lines = ["a[^x]", "```", "dead [^y] here", "```", "", "[^x]: d"];
        expect(planFootnoteRename(fakeEditor(lines, { wholeDoc: true }), "x", "y")).toMatchObject({
            kind: "renamed",
        });
    });
});
