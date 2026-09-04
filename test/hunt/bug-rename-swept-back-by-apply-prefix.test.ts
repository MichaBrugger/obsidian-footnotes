import { describe, expect, it } from "vitest";

import { fakeEditor as sharedFakeEditor, FakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";
import { planFootnoteRename } from "../../src/commands/rename-footnote";
import { lintFootnotes, lintOptionsFromSettings } from "../../src/linting/linter";

// BUG fixed 2026-08-25 (hunt, interactions lens): with footnote-prefix
// "p." active AND the Apply-footnote-prefix lint rule on, renaming
// [^p.1] to the bare "5" used to succeed silently - and the very next
// lint swept [^5] back into the namespace as the byte-identical
// original [^p.1], undoing the user's explicit rename with no notice.
// planFootnoteRename consulted no prefix state at all (unlike every
// creation path). The 2026-08-25 fix REFUSED an out-of-namespace name
// with an inline reason; Jason's ruling 2026-08-29 replaced the refusal
// with the friendlier invariant-keeper: the rename modal still passes
// the ARMED sweep prefix (feature on + lint rule on + valid note prefix)
// as options.sweepPrefix, and the plan now APPLIES it - the rename lands
// already prefixed, so there is nothing for the next lint to sweep, and
// the plan reports prefixAdded so the confirmation toast can say so.
// With the sweep unarmed (either toggle off), bare renames stay allowed
// and durable, exactly as before.

function docWithPrefix(): FakeEditor {
    return sharedFakeEditor(
        [
            "---",
            "footnote-prefix: p.",
            "---",
            "text with a ref[^p.1] here",
            "",
            "[^p.1]: body",
        ],
        { cursor: { line: 0, ch: 0 }, edits: true, wholeDoc: true },
    );
}

describe("rename under an ARMED apply-prefix sweep", () => {
    it("applies the prefix to an out-of-namespace name and says so", () => {
        const doc = docWithPrefix();
        const plan = planFootnoteRename(doc, "p.1", "5", undefined, {
            sweepPrefix: "p.",
        });
        expect(plan.kind).toBe("renamed");
        if (plan.kind !== "renamed") return;
        expect(plan.newName).toBe("p.5");
        expect(plan.prefixAdded).toBe(true);
        doc.transaction({ changes: plan.changes });
        expect(doc.lines[3]).toBe("text with a ref[^p.5] here");
        expect(doc.lines[5]).toBe("[^p.5]: body");
    });

    it("the prefixed rename is already what the next lint wants (nothing swept)", () => {
        const doc = docWithPrefix();
        const plan = planFootnoteRename(doc, "p.1", "5", undefined, {
            sweepPrefix: "p.",
        });
        if (plan.kind !== "renamed") throw new Error(plan.kind);
        doc.transaction({ changes: plan.changes });
        const plugin = fakePlugin(
            { enableFootnotePrefix: true, lintApplyPrefix: true, lintReindex: true },
            doc,
        );
        const before = doc.lines.join("\n");
        const after = lintFootnotes(before, lintOptionsFromSettings(plugin, "", before));
        expect(after).toContain("[^p.1]");
        expect(after).not.toContain("[^p.5]");
        expect(after).not.toContain("[^5]");
    });

    it("a name inside the namespace renames as typed, nothing added", () => {
        const doc = docWithPrefix();
        const plan = planFootnoteRename(doc, "p.1", "p.cite", undefined, {
            sweepPrefix: "p.",
        });
        expect(plan.kind).toBe("renamed");
        if (plan.kind !== "renamed") return;
        expect(plan.newName).toBe("p.cite");
        expect(plan.prefixAdded).toBe(false);
    });

    it("a prefix typed in another casing still counts as inside the namespace", () => {
        const doc = docWithPrefix();
        const plan = planFootnoteRename(doc, "p.1", "P.cite", undefined, {
            sweepPrefix: "p.",
        });
        expect(plan.kind).toBe("renamed");
        if (plan.kind !== "renamed") return;
        expect(plan.newName).toBe("P.cite");
        expect(plan.prefixAdded).toBe(false);
    });

    it("the added prefix still collides like any other name", () => {
        const doc = sharedFakeEditor(
            [
                "---",
                "footnote-prefix: p.",
                "---",
                "refs[^p.1] and[^p.5]",
                "",
                "[^p.1]: one",
                "[^p.5]: five",
            ],
            { cursor: { line: 0, ch: 0 }, edits: true, wholeDoc: true },
        );
        const plan = planFootnoteRename(doc, "p.1", "5", undefined, {
            sweepPrefix: "p.",
        });
        expect(plan.kind).toBe("collision");
    });
});

describe("rename with the sweep UNARMED (apply-prefix lint off)", () => {
    it("a bare rename is allowed and survives the next lint", () => {
        const doc = docWithPrefix();
        const plan = planFootnoteRename(doc, "p.1", "cite");
        expect(plan.kind).toBe("renamed");
        if (plan.kind !== "renamed") return;
        doc.transaction({ changes: plan.changes });

        const plugin = fakePlugin(
            {
                enableFootnotePrefix: true,
                lintApplyPrefix: false,
                lintReindex: true,
            },
            doc,
        );
        const before = doc.lines.join("\n");
        const after = lintFootnotes(
            before,
            lintOptionsFromSettings(plugin, "", before),
        );
        expect(after).toContain("[^cite]");
    });
});
