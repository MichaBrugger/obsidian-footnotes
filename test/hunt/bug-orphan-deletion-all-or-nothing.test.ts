// Imported from the Kimi K3 cycle 4 hunt of 2026-09-16 (OpenCode worktree); 2 of 6 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { beforeEach, describe, expect, it } from "vitest";

import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

import { noticeLintAlerts } from "../../src/linting/lint-alerts";
import { removeOrphanedFootnoteDefinitions } from "../../src/linting/rules/remove-orphaned-definitions";
import { removeOrphanedFootnoteReferences } from "../../src/linting/rules/remove-orphaned-references";

// Both orphan rules build their WHOLE output first - every orphan deleted
// in one pass - and then refuse the lot when any part of it would change
// how a kept line is read (the reclassification guard: "a deletion that
// changes whether ANY other line counts as protected is refused
// outright"). One dangerous orphan therefore vetoes every SAFE deletion
// in the same note: the toggle the user turned on does nothing at all,
// and the alert that then fires names every orphan with the
// reclassification reason - including the ones whose deletion was
// perfectly safe, which flatters them into hand-deleting text the rule
// could have taken.
//
// Here: [^a] is an ordinary orphaned definition whose cut changes
// nothing. [^4]'s block owns the math region its body opens, so cutting
// it takes "$$ tail" along and lands "[^3]: y" directly under the "==="
// setext underline, reclassifying that lazy label into a real definition
// (the pinned guard case, bug-orphan-definition-delete-reclassifies).
// [^a] should still go. Instead nothing is deleted, and the alert says
// both were "left in place: deleting it would change how the lines around
// it are read" - false for [^a].
//
// What the user sees: with `Delete orphaned definitions` ON, their note
// keeps every orphaned definition as long as one of them sits somewhere
// dangerous, and the alert's reason names footnotes it does not apply to.
// The reference rule behaves the same way (second fixture: [^9] is safe,
// [^8]'s deletion would wake the indented chunk below the definition).
//
// Source of truth: the rules' own per-deletion promise ("The orphaned
// references stay" - the offending ones) + the alert wording, which
// speaks per orphan ("deleting IT would change how the lines around it
// are read").
//
// Settings involved: `Delete orphaned definitions` / `Delete orphaned
// references` ON.

describe("one refused orphan vetoing every safe deletion in the same note", () => {
    beforeEach(resetNotices);

    const defsDoc = "[^a]: safe orphan\n\npara\n===\n[^4]: x $$\n$$ tail\n[^3]: y";

    it("the safe orphaned definition is still deleted", () => {
        expect(removeOrphanedFootnoteDefinitions(defsDoc)).not.toContain("[^a]:");
    });

    it("the refused one stays (its cut reclassifies) - must hold before AND after a fix", () => {
        expect(removeOrphanedFootnoteDefinitions(defsDoc)).toContain("[^4]: x $$");
    });

    const refsDoc = "x[^9] here\n\n[^1]: d\n\n[^8]\n\n    indented\n\ntext[^2]\n\n[^2]: d2";

    it("the safe orphaned reference is still deleted", () => {
        expect(removeOrphanedFootnoteReferences(refsDoc)).not.toContain("[^9]");
    });

    it("the refused reference stays (deleting it would wake the indented chunk) - must hold before AND after a fix", () => {
        expect(removeOrphanedFootnoteReferences(refsDoc)).toContain("[^8]");
    });

    it("each orphan is judged on its own now: the safe one goes, the refused one stays (fixed 2026-09-16)", () => {
        expect(removeOrphanedFootnoteDefinitions(defsDoc)).toBe("para\n===\n[^4]: x $$\n$$ tail\n[^3]: y");
        expect(removeOrphanedFootnoteReferences(refsDoc)).toBe("x here\n\n[^1]: d\n\n[^8]\n\n    indented\n\ntext[^2]\n\n[^2]: d2");
    });

    it("the alert names only the orphan the rule refused, with the reason that is true of it", () => {
        // run on the pre-lint text, as a single-rule command would leave
        // it: the safe orphan is one the next lint deletes, so it is not
        // reported with the refusal reason
        noticeLintAlerts(fakePlugin({ lintDeleteOrphanedDefinitions: true }), defsDoc);
        expect(messages().some((m) => m.includes("[^4]"))).toBe(true);
        expect(messages().some((m) => m.includes("[^a]"))).toBe(false);
    });
});
