import { describe, expect, it } from "vitest";

import { orphanedByUndo } from "../src/editor/undo-orphan-notice";

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
