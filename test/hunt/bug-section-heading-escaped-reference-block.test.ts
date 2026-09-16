// Imported from the Kimi K3 cycle 4 hunt of 2026-09-16 (OpenCode worktree); 2 of 4 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { describe, expect, it } from "vitest";

import { lintFootnotes, sectionHeadingProblem } from "../../src/linting/linter";

// The lint cancels outright when the configured section heading's text
// holds a footnote reference: after a lint renumbers that reference, the
// copy in the note no longer matches the setting, and every lint appends
// one more heading (the 2026-09-16 cycle-1 fix). The check is a bare
// regex, /\[\^[^[\]]+\]/, over the setting's text.
//
// But the rules only ever rename LIVE references. An ESCAPED "\[^9]" is
// literal prose (footnoteReferenceMatches skips it, the bug-escaped-
// marker ruling), and a "[^9]" inside a CODE SPAN is dead text. Neither
// is renamed by reindex, apply-prefix, or anything else, so a heading
// holding one can never desync from its copy in the note - findLineRunEnd
// matches the line exactly on every later lint. The guard cancels lints
// that were perfectly safe.
//
// What the user sees: their heading is "# Footnotes \[^9]" (or with the
// name in backticks), the lint says "Linting canceled: the footnote
// section heading setting contains a footnote reference ("[^9]"), which
// the lint rules would renumber" - which is false - and no lint runs
// until they edit the setting.
//
// Source of truth: the guard's own reason ("which the lint rules would
// renumber") + the escaped-reference and code-span rules the rewriter
// already follows (src/linting/rewrite-footnote-names.ts renames only
// what referenceOccurrences finds).
//
// Settings involved: `Enable section heading` ON with such a heading text.

describe("a section heading holding a dead or escaped reference", () => {
    it("an escaped \\[^9] in the heading does not cancel the lint", () => {
        expect(sectionHeadingProblem("# Footnotes \\[^9]")).toBeNull();
    });

    it("a code-spanned `[^9]` in the heading does not cancel the lint", () => {
        expect(sectionHeadingProblem("# Footnotes `[^9]`")).toBeNull();
    });

    it("control: a LIVE reference in the heading still cancels", () => {
        expect(sectionHeadingProblem("# Footnotes [^9]")).not.toBeNull();
    });

    it("control: a live reference really would desync (the heading copy is renamed)", () => {
        // reindex renumbers the heading's own [^9], so the setting stops
        // matching - exactly what the guard exists for
        const doc = "x[^9]\n\n[^9]: def";
        expect(lintFootnotes(doc, { sectionHeading: "" })).not.toContain("[^9]");
    });
});
