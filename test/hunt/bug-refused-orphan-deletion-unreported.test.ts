import { describe, expect, it } from "vitest";

import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

import { lintFootnotes } from "../../src/linting/linter";
import { noticeLintAlerts } from "../../src/linting/lint-alerts";

// Scenario: the orphaned-reference rule refuses a deletion because taking
// the reference out would change how a nearby line is read, and the alert
// half of the same feature has already returned early because the setting
// is on. The orphan survives and nothing anywhere tells the user about it.
//
// What the user would see: they have "Delete orphaned references" turned
// on, so they expect stray references to be cleaned up. They lint. The
// notice says the note was linted, no alert appears, and the stray "[^42]"
// is still sitting in the text. Nothing has told them it is there or why it
// was left, so the only way to find it is to read the note.
//
// Hunt: 2026-09-13
// Lens: the two orphan rules, alert half.
//
// Source of truth: ADR-0002, whose title is "Lint is never silent about
// problems it won't fix" and whose consequences say "Every alert names the
// footnotes involved and the reason, so the user can fix by hand or opt
// into the destructive rule"; and lint-alerts.ts's own comment on
// noticeOrphanedReferences, "While that toggle is off, the lint reports
// orphaned references instead of deleting them: an orphan is never passed
// over in silence". The refusal itself is correct and is pinned as correct
// in test/hunt/bug-orphan-delete-reclassifies.test.ts, so the fix belongs
// in the alert, not in the rule.
//
// Why it happens: noticeOrphanedReferences starts with "if
// (plugin.settings.lintDeleteOrphanedReferences) return;". It assumes that
// with the setting on, every orphaned reference has already been deleted.
// The reclassification guard breaks that assumption.
//
// Header note on reach: the guard is all or nothing for the whole note, so
// one refused reference suppresses the deletion of every other orphaned
// reference in the same note, and none of them is reported either. The
// second test below shows that. Reach is narrow, though: the guard only
// triggers around four-space indented code, which is rare in Obsidian
// because the editor gives you fenced code.
//
// Settings: "Delete orphaned references" ON, everything else off here so
// the fixture stays readable.

const pipeline = {
    fixPunctuation: false,
    moveDefinitionsToBottom: false,
    reindex: false,
};

const pluginWithDeletionOn = () =>
    fakePlugin({
        lintDeleteOrphanedReferences: true,
        lintDeleteOrphanedDefinitions: false,
        lintMergeDuplicateDefinitions: false,
        enableFootnotePrefix: false,
    });

describe("an orphaned reference the rule refused to delete is reported nowhere", () => {
    it.fails("the refused reference is named in an alert", () => {
        const doc = "[^1]: alpha\n\n[^42]\n\n    indented code[^73]";
        const after = lintFootnotes(doc, { ...pipeline, removeOrphanedReferences: true });
        // the guard is right to keep it: deleting it would turn the
        // indented chunk below into part of the definition above
        expect(after).toContain("[^42]");
        resetNotices();
        noticeLintAlerts(pluginWithDeletionOn(), after);
        expect(messages().some((m) => m.includes("[^42]"))).toBe(true);
    });

    it.fails("a second orphan the guard also held back is reported as well", () => {
        // "[^99]" sits in ordinary prose and could have been deleted on its
        // own. The guard works on the whole note at once, so the refusal
        // over "[^42]" keeps "[^99]" too, and neither is mentioned.
        const doc = "[^1]: alpha\n\n[^42]\n\n    indented code[^73]\n\nother[^99] here";
        const after = lintFootnotes(doc, { ...pipeline, removeOrphanedReferences: true });
        expect(after).toContain("other[^99] here");
        resetNotices();
        noticeLintAlerts(pluginWithDeletionOn(), after);
        expect(messages().some((m) => m.includes("[^99]"))).toBe(true);
    });
});

describe("the boundary: with the setting off, the alert does its job", () => {
    it("names the same reference the guard would have refused", () => {
        const after = "[^1]: alpha\n\n[^42]\n\n    indented code[^73]";
        resetNotices();
        noticeLintAlerts(
            fakePlugin({
                lintDeleteOrphanedReferences: false,
                lintDeleteOrphanedDefinitions: false,
                lintMergeDuplicateDefinitions: false,
                enableFootnotePrefix: false,
            }),
            after,
        );
        expect(messages().some((m) => m.includes("[^42]"))).toBe(true);
    });

    it("with the setting on and nothing refused, there is genuinely nothing to say", () => {
        const doc = "stray[^9] here\n\n[^1]: alpha\n\nx[^1]";
        const after = lintFootnotes(doc, { ...pipeline, removeOrphanedReferences: true });
        expect(after).not.toContain("[^9]");
        resetNotices();
        noticeLintAlerts(pluginWithDeletionOn(), after);
        expect(messages().some((m) => m.includes("[^9]"))).toBe(false);
    });
});
