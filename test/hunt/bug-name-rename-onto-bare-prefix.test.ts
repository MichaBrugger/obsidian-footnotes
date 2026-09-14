// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { planFootnoteRename } from "../../src/commands/rename-footnote";

// What a user would see: in a note with footnote-prefix "p." (and the
// apply-prefix lint armed), they rename "[^p.1]" to "p." and the rename
// goes through, leaving "[^p.]" behind, which the plugin's own lint alert
// then flags as "an unnamed footnote reference ... a bare prefix with
// nothing after it". The rename created exactly the fragment the lint
// exists to complain about.
//
// The planner refuses empty names (noop) and names with bad characters
// (invalid), but a name equal to the bare prefix is, by the plugin's own
// definition (countEmptyFootnoteReferences: "footnotes the user started
// and never finished naming"), not a name at all.

function prefixedDoc(): ReturnType<typeof fakeEditor> {
    return fakeEditor(
        [
            "---",
            "footnote-prefix: p.",
            "---",
            "text[^p.1] here",
            "",
            "[^p.1]: body",
        ],
        { edits: true, wholeDoc: true },
    );
}

describe("rename onto the bare prefix", () => {
    it.fails("renaming to the bare prefix is refused, not applied", () => {
        const doc = prefixedDoc();
        const plan = planFootnoteRename(doc, "p.1", "p.", undefined, {
            sweepPrefix: "p.",
        });
        expect(plan.kind).not.toBe("renamed");
    });

    it.fails("renaming to the bare prefix in another casing is refused too", () => {
        const doc = prefixedDoc();
        const plan = planFootnoteRename(doc, "p.1", "P.", undefined, {
            sweepPrefix: "p.",
        });
        expect(plan.kind).not.toBe("renamed");
    });

    it("a real name behind the prefix still renames (contrast pin)", () => {
        const doc = prefixedDoc();
        const plan = planFootnoteRename(doc, "p.1", "p.2", undefined, {
            sweepPrefix: "p.",
        });
        expect(plan.kind).toBe("renamed");
    });
});
