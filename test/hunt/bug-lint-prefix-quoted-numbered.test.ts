// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 1 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { applyFootnotePrefix } from "../../src/linting/rules/apply-footnote-prefix";
import { lintFootnotes } from "../../src/linting/linter";

// The rule's contract: "Rename every footnote that does not yet carry
// `prefix` so that it does." A NUMBERED definition inside a blockquote
// ("> [^2]: ...", a real definition per C22) is never renamed: the
// collection walk records names from referenceOccurrences (which excludes
// a quoted label) and from `blocks` (column-0 only), so the quoted
// definition's number never enters `order`, and renameFor returns null
// for "a number the walk did not collect". Its named twin IS renamed,
// through the label pass. A user watching every other footnote adopt the
// note's prefix sees the quoted numbered one left behind on every lint.

describe("apply-footnote-prefix and a quoted numbered definition", () => {
    it("renames a quoted numbered definition's label too", () => {
        const doc = "x[^1]\n\n> [^2]: quoted orphan\n\n[^1]: a";
        const out = applyFootnotePrefix(doc, "p.");
        expect(out).toContain("[^p.2]:");
    });

    it("a quoted NAMED definition is renamed (asymmetry control)", () => {
        const doc = "x[^1]\n\n> [^note]: quoted orphan\n\n[^1]: a";
        const out = applyFootnotePrefix(doc, "p.");
        expect(out).toContain("[^p.note]:");
    });

    it("the full lint prefixes the quoted numbered definition as well", () => {
        const doc =
            "---\nfootnote-prefix: p.\n---\n\nx[^1]\n\n> [^2]: quoted orphan\n\n[^1]: a";
        const out = lintFootnotes(doc, { applyNotePrefix: true });
        expect(out).not.toContain("[^2]:");
    });
});
