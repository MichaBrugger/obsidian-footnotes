import { describe, expect, it } from "vitest";

import {
    orphanedByUndo,
    stillOrphanedNames,
} from "../src/editor/undo-orphan-notice";

// Creating a footnote from a table cell takes TWO undo steps (the
// reference rides the cell sub-editor's dispatch, the definition the main
// editor's - CodeMirror can never group them), and the first undo strands
// an orphaned reference with no feedback (Jason's report 2026-08-27;
// notice always on, his call). orphanedByUndo is the pure decision: which
// names had a definition before the undo, lost it, and still have
// references afterwards.

describe("orphanedByUndo", () => {
    const table = "| a | b |\n| - | - |\n| word[^1] here | x |\n\ntail";

    it("reports the name when an undo removes the definition but not the reference", () => {
        expect(
            orphanedByUndo(`${table}\n\n[^1]: `, table),
        ).toEqual(["1"]);
    });

    it("stays silent on the SECOND undo (no definition existed before it)", () => {
        expect(
            orphanedByUndo(
                table,
                "| a | b |\n| - | - |\n| word here | x |\n\ntail",
            ),
        ).toEqual([]);
    });

    it("stays silent when an undo removes reference AND definition together", () => {
        // the normal single-transaction creation: one undo reverts both -
        // exactly the case that must never toast
        expect(
            orphanedByUndo(
                "word[^1] here\n\n[^1]: body",
                "word here",
            ),
        ).toEqual([]);
    });

    it("a definition-shaped decoy in a code span is not a definition", () => {
        expect(
            orphanedByUndo(
                "see[^1] and `[^1]: fake` decoy",
                "see[^1] decoy",
            ),
        ).toEqual([]);
    });

    it("matches names case-insensitively and reports the definition's casing", () => {
        expect(
            orphanedByUndo(
                "see[^note] here\n\n[^Note]: body",
                "see[^note] here",
            ),
        ).toEqual(["Note"]);
    });

    it("reports every name the one undo orphaned", () => {
        expect(
            orphanedByUndo(
                "a[^x] b[^y]\n\n[^x]: one\n[^y]: two",
                "a[^x] b[^y]",
            ),
        ).toEqual(["x", "y"]);
    });
});

describe("stillOrphanedNames (the notice's auto-dismiss check, 2026-08-29)", () => {
    // The standing notice hides itself when a later undo or redo resolves
    // the state it described: the reference gone, or the definition back.
    it("an empty result when the second undo removed the reference", () => {
        expect(stillOrphanedNames("word here", ["1"])).toEqual([]);
    });

    it("an empty result when a redo restored the definition", () => {
        expect(
            stillOrphanedNames("word[^1] here\n\n[^1]: body", ["1"]),
        ).toEqual([]);
    });

    it("keeps a name whose orphan state persists", () => {
        expect(stillOrphanedNames("word[^1] here", ["1"])).toEqual(["1"]);
    });

    it("a code-span decoy definition does not count as restored", () => {
        expect(
            stillOrphanedNames("word[^1] and `[^1]: fake` here", ["1"]),
        ).toEqual(["1"]);
    });

    it("matches case-insensitively", () => {
        expect(stillOrphanedNames("word[^note] here", ["Note"])).toEqual([
            "Note",
        ]);
    });

    it("resolves names independently", () => {
        expect(
            stillOrphanedNames("a[^x] here\n\n[^y]: restored", ["x", "y"]),
        ).toEqual(["x"]);
    });
});
