import { describe, expect, it } from "vitest";

import { fakeEditor as sharedFakeEditor, FakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";
import { planFootnoteRename } from "../../src/commands/rename-footnote";
import { lintFootnotes, lintOptionsFromSettings } from "../../src/linting/linter";

// BUG (hunt 2026-08-25, interactions lens; skeptic-confirmed, upgraded
// from spec question): with footnote-prefix "p." active, renaming
// [^p.1] to the bare number "5" succeeds with no warning — and the very
// next lint with apply-footnote-prefix on sweeps [^5] straight back
// into the namespace as the byte-identical original [^p.1]. The user's
// explicit rename is silently undone. planFootnoteRename consults no
// plugin/settings at all (unlike every creation path, which
// auto-prefixes or refuses), and apply-prefix's bare-id heuristic
// cannot tell "legacy footnote never prefixed" from "user just escaped
// the namespace" — nor is it numeric-only: renaming to any unprefixed
// NAME gets swept too (renameFor prefixes named ids, per its own
// [^note] -> [^3.note] example), it just doesn't round-trip to the
// exact original id. Either fix satisfies this pin: the rename plan
// refuses/warns under an active prefix, or an applied rename survives
// the next lint.

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

describe("rename to a bare number under an active footnote-prefix", () => {
    it.fails("an applied rename survives the next apply-prefix lint (or the plan refuses)", () => {
        const doc = docWithPrefix();
        const plan = planFootnoteRename(doc, "p.1", "5");
        if (plan.kind !== "renamed") {
            // a future prefix-aware plan may refuse or warn here — that
            // satisfies the pin's invariant (no silent undo can follow)
            return;
        }
        doc.transaction({ changes: plan.changes });
        expect(doc.lines.join("\n")).toContain("[^5]");

        const plugin = fakePlugin(
            {
                enableFootnotePrefix: true,
                lintApplyPrefix: true,
                lintReindex: true,
            },
            doc,
        );
        const before = doc.lines.join("\n");
        const after = lintFootnotes(
            before,
            lintOptionsFromSettings(plugin, "", before),
        );
        expect(after).toContain("[^5]");
    });
});
