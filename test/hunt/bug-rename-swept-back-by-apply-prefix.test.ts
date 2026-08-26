import { describe, expect, it } from "vitest";

import { fakeEditor as sharedFakeEditor, FakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";
import { planFootnoteRename } from "../../src/commands/rename-footnote";
import { lintFootnotes, lintOptionsFromSettings } from "../../src/linting/linter";

// BUG fixed 2026-08-25 (hunt, interactions lens): with footnote-prefix
// "p." active AND the Apply-footnote-prefix lint rule on, renaming
// [^p.1] to the bare "5" used to succeed silently — and the very next
// lint swept [^5] back into the namespace as the byte-identical
// original [^p.1], undoing the user's explicit rename with no notice.
// planFootnoteRename consulted no prefix state at all (unlike every
// creation path). NOW: the rename modal passes the ARMED sweep prefix
// (feature on + lint rule on + valid note prefix) as
// options.sweepPrefix, and the plan refuses an out-of-namespace name
// with an inline reason naming the prefix to type — no silent undo can
// follow. With the sweep unarmed (either toggle off), bare renames
// stay allowed and durable, exactly as before.

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
    it("refuses an out-of-namespace name, naming the prefix", () => {
        const doc = docWithPrefix();
        const plan = planFootnoteRename(doc, "p.1", "5", undefined, {
            sweepPrefix: "p.",
        });
        expect(plan.kind).toBe("invalid");
        if (plan.kind === "invalid") {
            expect(plan.reason).toContain('"p."');
        }
    });

    it("a name inside the namespace renames normally", () => {
        const doc = docWithPrefix();
        const plan = planFootnoteRename(doc, "p.1", "p.cite", undefined, {
            sweepPrefix: "p.",
        });
        expect(plan.kind).toBe("renamed");
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
