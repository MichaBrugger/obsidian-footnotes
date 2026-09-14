// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 3 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { planFootnoteRename } from "../../src/commands/rename-footnote";

// What a user sees, three ways: (1) renaming [^a] to [^x] is refused with
// "name already used" when the only "x" in the note is a dead label inside
// a %% block comment; (2) renaming [^x] to [^y] silently rewrites that dead
// label inside the comment, although the plugin renames nothing inside a
// block comment; (3) when the dead label is the ONLY "x", the rename
// reports "Renamed in 1 place" and changes only comment text, so nothing
// live was renamed at all. planFootnoteRename passes the bare
// definitionStarts to referenceOccurrences; its own module's rule
// (labelCountsAsLabel) says a label inside a %% block comment is dead: its
// "[^x]" is not a reference.

describe("a label inside a %% block comment is dead to the rename plan", () => {
    it.fails("renaming onto a name that exists only as a dead %% label is no collision", () => {
        const doc = fakeEditor(["see [^a]", "", "[^a]: d", "%%", "[^x]: dead", "%%"], {
            wholeDoc: true,
        });
        expect(planFootnoteRename(doc, "a", "x").kind).toBe("renamed");
    });

    it.fails("renaming leaves a dead %% label of the SAME footnote untouched", () => {
        const doc = fakeEditor(["see [^x]", "", "[^x]: live", "%%", "[^x]: dead", "%%"], {
            edits: true,
            wholeDoc: true,
        });
        const plan = planFootnoteRename(doc, "x", "y");
        expect(plan.kind).toBe("renamed");
        if (plan.kind !== "renamed") return;
        doc.transaction({ changes: plan.changes });
        expect(doc.lines[2]).toBe("[^y]: live");
        expect(doc.lines[4]).toBe("[^x]: dead");
    });

    it.fails("a name that exists only as a dead %% label has nothing to rename", () => {
        const doc = fakeEditor(["prose", "%%", "[^x]: dead", "%%"], { wholeDoc: true });
        expect(planFootnoteRename(doc, "x", "y").kind).toBe("noop");
    });
});
