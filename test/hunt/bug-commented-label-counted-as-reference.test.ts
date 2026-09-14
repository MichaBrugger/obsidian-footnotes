import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

import { shouldJumpFromDefinitionToReference } from "../../src/commands/navigation";
import { planFootnoteRename } from "../../src/commands/rename-footnote";
import { simulateChanges } from "../../src/editor/insertion-liveness";
import { orphanedByUndo, stillOrphanedNames } from "../../src/editor/undo-orphan-notice";
import { noticeLintAlerts } from "../../src/linting/lint-alerts";
import { applyFootnotePrefix } from "../../src/linting/rules/apply-footnote-prefix";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";
import {
    orphanedFootnoteReferenceNames,
    removeOrphanedFootnoteReferences,
} from "../../src/linting/rules/remove-orphaned-references";

// Scenario: a definition label parked inside a "%%" block comment, like
// "%%\n[^k]: an old draft\n%%", is counted as a live reference by every
// reader except the rename target resolvers.
//
// What the user would see: text edited inside a comment they wrote to hide
// it. Lint cuts the brackets out of the commented line, so "[^k]: draft"
// loses its name for good. Reindex and the prefix rule rewrite the hidden
// line and spend a number on it, so a live footnote that should have been 1
// becomes 2. A rename touches the hidden copy as well as the real one. The
// lint alert tells the user to write a definition for a footnote they have
// already written and commented out. The undo toast says a reference was
// left stranded when none was. And jumping back from a definition parks the
// caret on the hidden label instead of on the visible reference.
//
// Hunt: 2026-09-13
// Lenses: lint properties, "%%" comments, the two orphan rules, rename,
// the undo notice, navigation.
//
// Source of truth: the 2026-09-12 ruling, written out in the
// labelCountsAsLabel comment in src/commands/rename-footnote.ts (a label
// inside a %% block comment is dead as a definition but is not a lazy label
// either, so its own "[^x]" is not a reference) and in commit 0eaeb9a; the
// attack-surface "%% comments" row ("a definition inside a %% block is
// dead; nothing inside a block comment is moved, renamed, or fixed");
// manual sheet 18 ("the commented [^o1]: line is untouched"). For the
// deletion case, additionally the lazy-label guard in
// src/linting/rules/remove-orphaned-references.ts, where a lazy label's own
// "[^x]" is never deleted so a label line is never mangled, and ADR-0002.
//
// The rename target resolvers alone get this right: they ask
// labelCountsAsLabel, which is definitionStarts[line] OR
// scan.inCommentBlock[line]. Every other reader passes the bare
// definitionStarts[i] into referenceOccurrences, and inside a comment block
// that flag is false, which is the encoding for a lazy label, whose own
// "[^x]" IS a live reference. So the readers disagree about the same three
// characters.
//
// Skeptic's note: whether Obsidian itself binds a commented label as a
// reference is not recorded anywhere. Sheet 18 and the ruling say what the
// plugin must do, not what Obsidian's renderer does with that exact shape.
// A live check of it is listed separately in the report.
//
// Scope: this is about the commented LABEL only. A plain hidden reference
// inside a block comment, like "%%\nhidden[^1]\n%%", is a real reference
// that Obsidian binds, and it is a legitimate rename and jump target. The
// two controls at the bottom hold that boundary.

const alertPlugin = () =>
    fakePlugin({
        lintDeleteOrphanedReferences: false,
        lintDeleteOrphanedDefinitions: false,
        lintMergeDuplicateDefinitions: false,
        enableFootnotePrefix: false,
    });

describe("a definition label inside a %% block comment is counted as a live reference", () => {
    it.fails("the orphaned-reference scan reports the commented label's name", () => {
        const doc = "x[^1]\n\n%%\n[^9]: dead\n%%\n\n[^1]: one";
        expect(orphanedFootnoteReferenceNames(doc)).toEqual([]);
    });

    it.fails("deleting orphaned references cuts the brackets out of the commented line", () => {
        // the visible "[^k]" is a genuine orphaned reference, because a
        // definition inside a block comment is dead, so removing that one is
        // right. The commented line is hidden text the user parked, and
        // nothing inside a block comment is moved, renamed, or fixed.
        const doc = "see[^k] here\n\n%%\n[^k]: commented\n%%";
        expect(removeOrphanedFootnoteReferences(doc)).toBe("see here\n\n%%\n[^k]: commented\n%%");
    });

    it.fails("deleting orphaned references touches a commented label no live text mentions", () => {
        const doc = "x[^1]\n\n%%\n[^9]: dead\n%%\n\n[^1]: one";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });

    it.fails("the missing-definition alert names the commented label", () => {
        // the user is told to write a definition for a footnote they have
        // written already and then commented out
        const after = "text\n\n%%\n[^1]: hidden draft\n%%";
        resetNotices();
        noticeLintAlerts(alertPlugin(), after);
        expect(messages().some((m) => m.includes("no definition") && m.includes("[^1]"))).toBe(false);
    });

    it.fails("reindex renames the commented label", () => {
        const doc = "a[^7] b[^8]\n\n%%\n[^9]: dead\n%%\n\n[^7]: A\n[^8]: B";
        expect(reindexFootnotes(doc)).toBe("a[^1] b[^2]\n\n%%\n[^9]: dead\n%%\n\n[^1]: A\n[^2]: B");
    });

    it.fails("a commented label above the first live reference steals number 1", () => {
        const doc = "%%\n[^9]: dead\n%%\n\na[^7]\n\n[^7]: A";
        expect(reindexFootnotes(doc)).toBe("%%\n[^9]: dead\n%%\n\na[^1]\n\n[^1]: A");
    });

    it.fails("apply-prefix renames the commented label into the note's namespace", () => {
        const doc = "a[^p.1]\n\n%%\n[^9]: dead\n%%\n\n[^p.1]: A";
        expect(applyFootnotePrefix(doc, "p.")).toBe(doc);
    });

    it.fails("a rename rewrites the commented label as well as the live pair", () => {
        const lines = [
            "live ref[^x] here",
            "",
            "%%",
            "[^x]: an old commented-out definition",
            "%%",
            "",
            "[^x]: the real definition",
        ];
        const plan = planFootnoteRename(fakeEditor(lines, { wholeDoc: true }), "x", "y");
        // two occurrences to rewrite, the visible reference and the real
        // label, not the third one inside the comment
        expect(plan).toMatchObject({ kind: "renamed", count: 2 });
        if (plan.kind !== "renamed") throw new Error("unreachable");
        expect(simulateChanges(lines, plan.changes)).toEqual([
            "live ref[^y] here",
            "",
            "%%",
            "[^x]: an old commented-out definition",
            "%%",
            "",
            "[^y]: the real definition",
        ]);
    });

    it.fails("the undo notice reports the commented label as a stranded reference", () => {
        // the undo took the real definition away. Nothing live points at
        // "1" any more, so there is nothing to tell the user about.
        expect(
            orphanedByUndo(
                "prose\n\n[^1]: real definition\n\n%%\n[^1]: commented copy\n%%",
                "prose\n\n%%\n[^1]: commented copy\n%%",
            ),
        ).toEqual([]);
    });

    it.fails("a commented copy of the definition keeps the undo toast on screen", () => {
        // sheet 08: the second undo takes the reference and the notice
        // dismisses itself, with no lingering toast
        expect(stillOrphanedNames("| a |\n| - |\n| word |\n\n%%\n[^1]: old copy\n%%", ["1"])).toEqual([]);
    });

    it.fails("jumping back from a definition lands on the commented label", () => {
        // the caret should land on the reference the user can actually see,
        // at line 6, not inside the comment at line 1
        const lines = ["%%", "[^1]: dead", "%%", "", "[^1]: live", "", "text[^1] here"];
        const doc = fakeEditor(lines);
        const handled = shouldJumpFromDefinitionToReference(
            lines[4],
            { line: 4, ch: 3 },
            fakePlugin({ enablePopupEditor: false }),
            doc,
        );
        expect(handled).toBe(true);
        expect(doc.moves).toEqual([{ line: 6, ch: "text[^1]".length }]);
    });
});

describe("the boundary: a plain hidden reference inside a block comment is real", () => {
    it("reindex renumbers a hidden reference, in appearance order", () => {
        expect(reindexFootnotes("%%\nx[^9]\n%%\nthen[^8]\n\n[^8]: A\n[^9]: B")).toBe(
            "%%\nx[^1]\n%%\nthen[^2]\n\n[^1]: B\n[^2]: A",
        );
    });

    it("a hidden reference is where a jump back from its definition lands", () => {
        const lines = ["%%", "hidden[^1] reference", "%%", "", "[^1]: live"];
        const doc = fakeEditor(lines);
        const handled = shouldJumpFromDefinitionToReference(
            lines[4],
            { line: 4, ch: 3 },
            fakePlugin({ enablePopupEditor: false }),
            doc,
        );
        expect(handled).toBe(true);
        expect(doc.moves).toEqual([{ line: 1, ch: "hidden[^1]".length }]);
    });
});
