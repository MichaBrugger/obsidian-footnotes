// Imported from the Kimi K3 cycle 2 hunt of 2026-09-16 (OpenCode worktree); 2 of 4 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { beforeEach, describe, expect, it } from "vitest";

import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

import { noticeLintAlerts } from "../../src/linting/lint-alerts";
import { duplicateFootnoteDefinitionNames } from "../../src/linting/rules/merge-duplicate-definitions";

// A label right after a `%%` block comment's closer on its line is a LIVE
// definition (Jason's verification 2026-09-15: "%% [^3]: def" renders).
// So a footnote defined once there and once elsewhere is DEFINED MORE
// THAN ONCE, and Obsidian renders only the last one (the duplicates rule,
// verified live 2026-08-12).
//
// The never-silent policy (ADR-0002, Jason's policy 2026-08-12): while
// `Merge duplicate definitions` is off, the lint REPORTS duplicates; they
// are never passed over in silence. And the orphan side of this exact
// label shape was already fixed that way: the cycle-1 hunt made the
// orphaned-definition alert name afterCloser labels even though the rule
// may not cut their lines (bug-aftercloser-orphan-silent: "that is the
// right call for DELETION. It is the wrong call for the ALERT").
//
// The DUPLICATE alert never got the same treatment:
// duplicateFootnoteDefinitionNames counts only findDefinitionBlocks'
// column-0 blocks, and the afterCloser label is not one (its line starts
// with "%%"). The duplicate is neither merged (fair enough - the line
// holds the comment's closer) nor reported.
//
// What the user sees: they have a duplicated footnote - Obsidian renders
// only one of its two definitions - and the lint never says a word about
// it, on any run, while every other kind of duplicate is named.
//
// Source of truth: ADR-0002 (docs/adr/0002-never-silent-lint.md) + the
// cycle-1 precedent for this exact label shape
// (test/hunt/bug-aftercloser-orphan-silent.test.ts).
//
// Settings involved: `Merge duplicate definitions` OFF (the alert side).

const doc = "use[^d] here\n\n%%\nhidden\n%% [^d]: after the closer\n\n[^d]: second";

describe("a duplicate pair where one label sits after a %% comment's closer", () => {
    beforeEach(resetNotices);

    it("is named by the duplicate-definitions alert (ADR-0002: never silent)", () => {
        expect(duplicateFootnoteDefinitionNames(doc)).toEqual(["d"]);
    });

    it("the lint alert fires for it", () => {
        const plugin = fakePlugin({ lintMergeDuplicateDefinitions: false });
        noticeLintAlerts(plugin, doc);
        expect(messages().some((m) => m.includes("more than once"))).toBe(true);
    });

    it("control: an ordinary duplicate pair is named", () => {
        expect(duplicateFootnoteDefinitionNames("use[^d]\n\n[^d]: one\n\n[^d]: two")).toEqual(["d"]);
    });

    it("control: the label after the closer alone is no duplicate", () => {
        expect(duplicateFootnoteDefinitionNames("use[^d]\n\n%%\nhidden\n%% [^d]: after the closer")).toEqual([]);
    });
});
