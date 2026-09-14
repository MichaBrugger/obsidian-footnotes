// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 3 tests were red there and carry it.fails.
import { beforeEach, describe, expect, it } from "vitest";

import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

import { noticeLintAlerts } from "../../src/linting/lint-alerts";
import { lintFootnotes } from "../../src/linting/linter";
import {
    orphanedFootnoteReferenceNames,
    removeOrphanedFootnoteReferences,
} from "../../src/linting/rules/remove-orphaned-references";

// A user with "Delete orphaned references" ON lints a note whose orphan
// deletion the reclassification guard REFUSES (the
// bug-orphan-delete-reclassifies family). The orphan stays in the text,
// and because the delete toggle is on, noticeOrphanedReferences returns
// early - the surviving orphan is neither deleted nor reported, on this
// save and every later one. The never-silent policy ("an orphan is never
// passed over in silence"; "Every kind of orphan is either deleted or
// reported") leaves no room for that, and the rule's own comment says the
// refused orphans "stay, for the user to sort out" - which the user can
// only do if they are told.

const REFUSED = "[^1]: alpha\n\n[^42]\n\n    indented code[^73]";

describe("a refused orphan-reference deletion is still reported", () => {
    beforeEach(resetNotices);

    it("the standalone deletion is refused (guard precondition)", () => {
        expect(removeOrphanedFootnoteReferences(REFUSED)).toBe(REFUSED);
    });

    it.fails("alert speaks for the survivor after a no-move lint", () => {
        const plugin = fakePlugin({ lintDeleteOrphanedReferences: true });
        const after = lintFootnotes(REFUSED, {
            moveDefinitionsToBottom: false,
            removeOrphanedReferences: true,
        });
        // the orphan survives the pipeline: the guard refuses to delete it,
        // here and on every later pass
        const survivors = orphanedFootnoteReferenceNames(after);
        expect(survivors.length).toBeGreaterThan(0);
        noticeLintAlerts(plugin, after);
        expect(
            messages().some((m) => survivors.every((n) => m.includes(`[^${n}]`))),
            `expected an alert naming ${JSON.stringify(survivors)}, got: ${JSON.stringify(messages())}`,
        ).toBe(true);
    });

    it.fails("alert speaks for the survivor under default move-to-bottom (anchored heading)", () => {
        const plugin = fakePlugin({ lintDeleteOrphanedReferences: true });
        const anchored = "## Footnotes\n\n[^1]: alpha\n\n[^42]\n\n    indented code[^73]";
        const after = lintFootnotes(anchored, {
            sectionHeading: "## Footnotes",
            removeOrphanedReferences: true,
        });
        const survivors = orphanedFootnoteReferenceNames(after);
        expect(survivors.length).toBeGreaterThan(0);
        noticeLintAlerts(plugin, after);
        expect(
            messages().some((m) => survivors.every((n) => m.includes(`[^${n}]`))),
            `expected an alert naming ${JSON.stringify(survivors)}, got: ${JSON.stringify(messages())}`,
        ).toBe(true);
    });
});
