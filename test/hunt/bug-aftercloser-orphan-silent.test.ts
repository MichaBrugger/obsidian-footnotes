// Imported from the Kimi K3 cycle 1 hunt of 2026-09-16 (OpenCode worktree); 2 of 4 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { beforeEach, describe, expect, it } from "vitest";

import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

import { noticeLintAlerts } from "../../src/linting/lint-alerts";
import { orphanedFootnoteDefinitionNames } from "../../src/linting/rules/remove-orphaned-definitions";

// A label right after a `%%` block comment's closer on the same line is a
// LIVE definition (Jason's verification 2026-09-15: "%% [^3]: def"
// renders). When nothing references it, that definition is an orphan -
// but the orphan finder drops it from the block list entirely, because
// its line holds the comment's closer and cutting the line would leave
// the comment open. That is the right call for DELETION. It is the wrong
// call for the ALERT: with deletion off the definition is neither
// reported nor removed, silently, on every lint - exactly what ADR-0002
// ("Lint is never silent about problems it won't fix") forbids.
//
// What the user sees: they have an orphaned definition they never learn
// about, while every other kind of orphan is named.
//
// Source of truth: ADR-0002 (docs/adr/0002-never-silent-lint.md: "every
// content-destroying fix is OFF by default and surfaced as a lint alert
// instead - lint never eats user text the user didn't explicitly opt
// into losing" - and what it won't fix, it names) + Jason's verification
// that the label is a real definition (sheet 18).
//
// Settings involved: `Delete orphaned definitions` OFF (the alert side).

describe("an orphaned definition whose line holds a %% comment closer", () => {
    beforeEach(resetNotices);

    it("is named by the orphaned-definition alert (ADR-0002: never silent)", () => {
        const doc = "%%\nhidden\n%% [^1]: def";
        expect(orphanedFootnoteDefinitionNames(doc)).toEqual(["1"]);
    });

    it("the lint alert fires for it", () => {
        const plugin = fakePlugin({ lintDeleteOrphanedDefinitions: false });
        noticeLintAlerts(plugin, "%%\nhidden\n%% [^1]: def");
        expect(messages().some((m) => m.includes("nothing references"))).toBe(true);
    });

    it("control: the label after the closer IS a live definition (its reference binds it)", () => {
        expect(orphanedFootnoteDefinitionNames("%%\nhidden\n%% [^1]: def\n\nuse[^1]")).toEqual([]);
    });

    it("control: an ordinary orphaned definition is named", () => {
        expect(orphanedFootnoteDefinitionNames("[^1]: def")).toEqual(["1"]);
    });
});
