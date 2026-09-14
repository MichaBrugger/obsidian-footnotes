import { describe, expect, it } from "vitest";

import { fixLazyDefinitions } from "../../src/linting/rules/fix-lazy-definitions";

// spec question: when a label line is part of a setext heading, should the
// fix-lazy rule leave it alone and alert instead, or promote it to a
// definition and accept that the heading is broken up?
//
// Reading one (leave it alone, alert): "para" / "[^1]: a" / "===" is ONE
// setext heading. CommonMark section 4.3 says a line of "=" under a
// paragraph turns that whole paragraph into a level 1 heading, so Obsidian
// renders a single big heading reading "para [^1]: a". The label is heading
// text the user typed, not prose one blank line short of a definition. The
// fix puts a blank line in the middle of the heading, which leaves three
// things behind: "para" as an ordinary paragraph, "[^1]: a" as a
// definition, and a stray "===" line with nothing above it. That is a
// silent rewrite of the note's heading structure. The precedent is
// test/hunt/bug-remove-def-creates-setext-heading.test.ts (2026-07-17):
// changing heading structure behind the user's back was ruled a defect
// there. ADR-0002 (lint is never silent about problems it will not fix)
// says the alternative is an alert naming the label, which the rule
// already has a place for: with the fix turned off, lint-alerts.ts names
// every lazy label.
//
// Reading two (promote it): almost nobody writes a footnote label inside a
// heading on purpose. Someone who types "[^1]: a" under a line of prose
// almost certainly meant a footnote definition and did not notice that the
// "===" below made the whole thing a heading. Promoting it gives them what
// they meant, and the leftover "===" is visible enough that they will see
// what happened.
//
// Hunt: 2026-09-13
// Lens: the fix-lazy-definitions rule.
//
// Source of truth for the shape (not for the verdict, which is the
// question): CommonMark 4.3, setext headings. Manual sheet 25 has no
// setext fixture, so nothing in the sheets settles this.
//
// The assertion below is written for reading one, so it is red today.

const HEADING = ["para", "[^1]: a", "===", "", "x[^1]"].join("\n");

describe("a label that is part of a setext heading", () => {
    it.fails("is left alone, so the heading stays one heading", () => {
        // today it comes back as "para" / blank / "[^1]: a" / "===" / blank
        // / "x[^1]": the heading is gone and the "===" is orphaned
        expect(fixLazyDefinitions(HEADING)).toBe(HEADING);
    });
});

describe("the boundary: the same label with no underline under it", () => {
    it("is a plain lazy label and gets its blank line", () => {
        const doc = ["para", "[^1]: a", "", "x[^1]"].join("\n");
        expect(fixLazyDefinitions(doc)).toBe("para\n\n[^1]: a\n\nx[^1]");
    });

    it("a label under an ATX heading is already a definition and is untouched", () => {
        // "# para" is a block of its own, so the label below it starts a
        // definition with no blank line needed
        const doc = ["# para", "[^1]: a", "", "x[^1]"].join("\n");
        expect(fixLazyDefinitions(doc)).toBe(doc);
    });
});
