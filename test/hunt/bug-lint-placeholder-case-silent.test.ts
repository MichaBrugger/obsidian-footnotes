// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 4 tests were red there and carry it.fails.
import { beforeEach, describe, expect, it } from "vitest";

import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

import { noticeLintAlerts, countEmptyFootnoteReferences } from "../../src/linting/lint-alerts";
import { removeOrphanedFootnoteReferences } from "../../src/linting/rules/remove-orphaned-references";

// A user with a "p." prefix note types the in-progress placeholder as
// "[^P.]" (capital P). Obsidian folds footnote names case-insensitively,
// so that IS the bare-prefix placeholder - but the unnamed-footnote alert
// never speaks for it, on this lint and every later one: it is neither
// counted as a placeholder nor reported as an orphan, silently forever.
//
// Root cause: countEmptyFootnoteReferences finds the bare-prefix needle
// "[^p.]" with a case-SENSITIVE indexOf. Every other prefix comparison in
// the plugin folds case: computeNextFootnoteNumber's dynamic regex carries
// /i (bug-prefix-scan-case-sensitive), applyFootnotePrefix folds
// (prefixFolded), reindex folds, and the orphan-reference rule exempts the
// placeholder through orphanSafeFolded = prefix.toLowerCase(). The alert
// is the placeholder's designated reporter ("The unnamed-reference alert
// speaks for it", remove-orphaned-references.ts), so the case-variant
// placeholder falls between the two rules.

describe("the bare-prefix placeholder alert folds case", () => {
    beforeEach(resetNotices);

    it.fails("countEmptyFootnoteReferences counts a case-variant placeholder", () => {
        expect(countEmptyFootnoteReferences("x [^P.] y", "p.")).toBe(1);
    });

    it("control: the exact-case placeholder is counted", () => {
        expect(countEmptyFootnoteReferences("x [^p.] y", "p.")).toBe(1);
    });

    it("the orphan-reference rule already treats it as the placeholder (exempt, folded)", () => {
        // this PASSES today: the deletion side folds case. It is the alert
        // side that does not, which is what leaves the placeholder silent.
        expect(removeOrphanedFootnoteReferences("x [^P.] y", "p.")).toBe("x [^P.] y");
    });

    it.fails("the unnamed-reference alert speaks for the case-variant placeholder", () => {
        const plugin = fakePlugin({ enableFootnotePrefix: true });
        noticeLintAlerts(plugin, "---\nfootnote-prefix: p.\n---\n\nx [^P.] y");
        expect(messages().some((m) => m.includes("unnamed footnote reference"))).toBe(true);
    });
});
