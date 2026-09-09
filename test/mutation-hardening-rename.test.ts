import { describe, expect, it } from "vitest";

import { fakeEditor as sharedFakeEditor, FakeEditor } from "./helpers/fake-editor";

import {
    planFootnoteRename,
    RenameTargetNotice,
    renameTargetAtCursor,
} from "../src/commands/rename-footnote";
import { simulateChanges } from "../src/editor/insertion-liveness";

// Mutation hardening for the rename planners (Stryker re-baseline
// 2026-08-12: rename-footnote 58%). Moved out of
// mutation-hardening-creation.test.ts on 2026-09-09 (review D10), where
// they sat under a "creation" filename; the cases are complementary to
// test/rename-footnote.test.ts (mutant-targeted here, behavioral there).
// Each test below is built to diverge from one specific surviving mutant.

function renameDoc(lines: string[]): FakeEditor {
    return sharedFakeEditor(lines, { wholeDoc: true });
}

describe("renameTargetAtCursor", () => {
    // L33 StringLiteral -> "": the existing suite compares the toast against
    // the exported constant, which a mutated constant satisfies.
    it("explains itself in exactly these words", () => {
        expect(RenameTargetNotice).toBe(
            "Place the cursor on a footnote reference or definition to rename it.",
        );
    });

    // L56 EqualityOperator, `cursorPosition.ch >= label.labelEnd` -> `>`: the
    // caret AT the end of the label's colon is already definition CONTENT.
    it("sees nothing with the caret exactly at the label's end", () => {
        expect(
            renameTargetAtCursor(renameDoc(["[^x]: d"]), { line: 0, ch: 5 }),
        ).toBeNull();
        // one column earlier is still the label
        expect(
            renameTargetAtCursor(renameDoc(["[^x]: d"]), { line: 0, ch: 4 }),
        ).toBe("x");
    });

    // L58 ConditionalExpression, `if (!maskedLabel) return null` -> false: a
    // label-shaped line inside a fence is plain text (#41).
    it("sees nothing in a code-fenced definition label", () => {
        expect(
            renameTargetAtCursor(renameDoc(["```", "[^x]: d", "```"]), {
                line: 1,
                ch: 3,
            }),
        ).toBeNull();
    });
});

describe("planFootnoteRename's refusals", () => {
    it('refuses a "#" name with the preview-and-sidebar reason (2026-09-05)', () => {
        expect(
            planFootnoteRename(renameDoc(["a[^x]", "", "[^x]: d"]), "x", "a#b"),
        ).toEqual({
            kind: "invalid",
            reason: 'Footnote names can\'t contain spaces, backticks, brackets, or "#".',
        });
    });

    // L83 / L89 StringLiteral -> "": the exact reasons.
    it("gives the exact reason for a bracketed name", () => {
        expect(
            planFootnoteRename(renameDoc(["a[^x]", "", "[^x]: d"]), "x", "a[b"),
        ).toEqual({
            kind: "invalid",
            reason: 'Footnote names can\'t contain spaces, backticks, brackets, or "#".',
        });
    });

    it("gives the exact reason for a spaced or backticked name", () => {
        expect(
            planFootnoteRename(renameDoc(["a[^x]", "", "[^x]: d"]), "x", "bad name"),
        ).toEqual({
            kind: "invalid",
            reason: 'Footnote names can\'t contain spaces, backticks, brackets, or "#".',
        });
        expect(
            planFootnoteRename(renameDoc(["a[^x]", "", "[^x]: d"]), "x", "tick`y"),
        ).toEqual({
            kind: "invalid",
            reason: 'Footnote names can\'t contain spaces, backticks, brackets, or "#".',
        });
    });

    // L101 (ArrowFunction, ConditionalExpression -> false, `toUpperCase`) and
    // L101 LogicalOperator (`||` -> `&&`): a DEFINITION-only collision - no
    // reference anywhere carries the new name, so only the block scan can see it.
    it("refuses a name taken by a definition with no reference", () => {
        expect(
            planFootnoteRename(
                renameDoc(["a[^x]", "", "[^x]: d", "[^z]: e"]),
                "x",
                "z",
            ),
        ).toEqual({ kind: "collision" });
    });

    // L102 MethodExpression (`some` -> `every`), L103 ArrowFunction, L104
    // ConditionalExpression -> false, L106 ArrowFunction, L107
    // (ConditionalExpression -> false, `toUpperCase`): a REFERENCE-only
    // collision - no definition carries the new name, so only the line scan
    // can see it.
    it("refuses a name taken by a reference with no definition", () => {
        expect(
            planFootnoteRename(
                renameDoc(["a[^x] b[^z]", "", "[^x]: d"]),
                "x",
                "z",
            ),
        ).toEqual({ kind: "collision" });
    });
});

describe("planFootnoteRename's change set", () => {
    // L122 ConditionalExpression (`occurrence.name !== oldFolded` -> false)
    // and L132 (`block.name !== oldFolded` -> false): only the TARGET
    // footnote's occurrences and label are rewritten.
    it("leaves every other footnote's references and label alone", () => {
        const lines = ["a[^x] b[^y]", "", "[^x]: d", "[^y]: e"];
        const plan = planFootnoteRename(renameDoc(lines), "x", "w");
        expect(plan).toMatchObject({ kind: "renamed", count: 2 });
        if (plan.kind !== "renamed") throw new Error("unreachable");
        expect(simulateChanges(lines, plan.changes)).toEqual([
            "a[^w] b[^y]",
            "",
            "[^w]: d",
            "[^y]: e",
        ]);
    });

    // L169 ConditionalExpression (`renamed` -> true), L171 ArithmeticOperator
    // (`occurrence.start - shift`), L174 (ConditionalExpression -> true /
    // false, AssignmentOperator `shift -=`): the survival check's shift model
    // needs a LENGTH-CHANGING rename with a non-target occurrence sandwiched
    // between two target ones - that is the only shape where every one of
    // those mutants predicts a different expected position.
    it("survives a lengthening rename with occurrences on both sides of another", () => {
        const lines = ["a[^x] b[^y] c[^x]", "", "[^x]: d", "[^y]: e"];
        const plan = planFootnoteRename(renameDoc(lines), "x", "xx");
        expect(plan).toMatchObject({ kind: "renamed", count: 3 });
        if (plan.kind !== "renamed") throw new Error("unreachable");
        expect(simulateChanges(lines, plan.changes)).toEqual([
            "a[^xx] b[^y] c[^xx]",
            "",
            "[^xx]: d",
            "[^y]: e",
        ]);
    });

    // L164 BlockStatement -> {} (the whole reference-survival loop emptied):
    // renaming to a comment opener kills the REFERENCE two lines down while
    // the definition blocks still line up perfectly - only the reference loop
    // can catch this one.
    it("refuses whole when only the references die", () => {
        expect(
            planFootnoteRename(
                renameDoc(["[^x]: d", "", "see [^x] here"]),
                "x",
                "a<!--",
            ),
        ).toEqual({ kind: "dead" });
    });

    // L196 ConditionalExpression, `blocksAfter.length !== blocksBefore.length`
    // -> false, and its BooleanLiteral sibling: two ORPHAN definitions (no
    // references at all, so the reference loop never runs) where the new name
    // opens a comment that swallows the second block - the block-count check
    // is the only thing that can catch this.
    it("refuses whole when a definition block disappears, with no references in play", () => {
        expect(
            planFootnoteRename(renameDoc(["[^x]: d", "[^y]: e"]), "x", "a<!--"),
        ).toEqual({ kind: "dead" });
    });

    // L197 ConditionalExpression / BlockStatement, L199 ConditionalExpression
    // (`blocksBefore[i].name === oldFolded` -> true), L203 (ConditionalExpression
    // -> false, LogicalOperator `||` -> `&&`): the block comparison must map
    // ONLY the target's name - a bystander definition keeps its own.
    it("keeps a bystander definition's name in the survival check", () => {
        const lines = ["a[^x] b[^y]", "", "[^x]: d", "[^y]: e"];
        const plan = planFootnoteRename(renameDoc(lines), "x", "w");
        expect(plan.kind).toBe("renamed");
    });
});
