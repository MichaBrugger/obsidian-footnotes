// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 5 of 6 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { planFootnoteRename } from "../../src/commands/rename-footnote";

// What a user sees: renaming "[^a]" to a longer or shorter name is refused
// with "wouldn't survive as a footnote where it's used" whenever the
// footnote's own definition line also references the footnote in its body
// ("[^a]: see [^a]"). The rename is perfectly safe; the refusal is wrong.

describe("rename with a self-reference on the definition label line", () => {
    it("renaming to a LONGER name survives", () => {
        const doc = fakeEditor(["see [^a] then", "", "[^a]: body with [^a] inside"], {
            wholeDoc: true,
        });
        const plan = planFootnoteRename(doc, "a", "longname");
        expect(plan.kind).toBe("renamed");
    });

    it("renaming to a SHORTER name survives", () => {
        const doc = fakeEditor(["see [^abc] then", "", "[^abc]: body with [^abc] inside"], {
            wholeDoc: true,
        });
        const plan = planFootnoteRename(doc, "abc", "z");
        expect(plan.kind).toBe("renamed");
    });

    it("the label line alone (self-reference, no other reference) renames", () => {
        const doc = fakeEditor(["[^a]: body with [^a] inside"], { wholeDoc: true });
        const plan = planFootnoteRename(doc, "a", "bb");
        expect(plan.kind).toBe("renamed");
    });

    it("control: a same-length rename on the same shape is accepted", () => {
        const doc = fakeEditor(["see [^a] then", "", "[^a]: body with [^a] inside"], {
            wholeDoc: true,
        });
        const plan = planFootnoteRename(doc, "a", "b");
        expect(plan.kind).toBe("renamed");
    });

    it("a blockquoted label with a self-reference renames to a longer name", () => {
        const doc = fakeEditor(["see [^a]", "", "> [^a]: body with [^a] inside"], {
            wholeDoc: true,
        });
        const plan = planFootnoteRename(doc, "a", "bb");
        expect(plan.kind).toBe("renamed");
    });

    it("a label line referencing the footnote twice renames to a longer name", () => {
        const doc = fakeEditor(["see [^a]", "", "[^a]: [^a] and [^a] again"], {
            wholeDoc: true,
        });
        const plan = planFootnoteRename(doc, "a", "bb");
        expect(plan.kind).toBe("renamed");
    });
});
