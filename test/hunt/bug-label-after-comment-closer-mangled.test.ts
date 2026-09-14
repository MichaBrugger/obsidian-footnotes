import { describe, expect, it } from "vitest";

import { lintFootnotes } from "../../src/linting/linter";
import { footnoteAfterPunctuation } from "../../src/linting/rules/footnote-after-punctuation";
import { removeOrphanedFootnoteReferences } from "../../src/linting/rules/remove-orphaned-references";

// BUG: a definition label written after a comment closer on the same line
// ("<!-- draft note --> [^1]: Smith 2020") has its own colon swapped in
// front of its brackets by the punctuation rule, and its brackets cut out
// by orphaned-reference deletion.
//
// What the user would see: on default settings, the first lint turns the
// line into "<!-- draft note --> :[^1] Smith 2020". The footnote stops
// being a footnote, with no notice, and linting again does not put it
// back: the mangled line is where the rule comes to rest, so the damage is
// permanent. With "Delete orphaned references" also on, the brackets go
// too and the line is left as "<!-- draft note --> : Smith 2020".
//
// Hunt: 2026-09-13. Lens: regressions.
//
// Source of truth:
//   - bug-indented-definition-label: the identical ":[^1]" rewrite plus
//     the double deletion on a label no reader could see was ruled a bug
//     (2026-09-08).
//   - footnoteAfterPunctuation's own contract: "A definition's own label is
//     never touched".
//   - spec-blockquoted-definition-punctuation, and ADR-0002.
//   - CommonMark 0.31.2 section 4.6 for the two HTML shapes: the whole
//     "-->" line is one HTML block, so the rule is editing inside an HTML
//     block, which it has no business doing either way.
//
// One thing the HTML shapes do NOT show: under section 4.6 the closer line
// is literal HTML, so nothing in those notes defines footnote 1 and the
// top "x[^1]" really is an orphaned reference. Deleting it is exactly what
// the opt-in setting authorises (sheet 18, the oscar[^o1] rule), so these
// tests only ask that the closer line itself comes through untouched.
//
// How a person reaches this: pressing Backspace at the start of a label
// line joins it onto the closer line above it. Or the note is written that
// way in the first place, as a note to self left beside the definition it
// belongs to ("<!-- source unverified --> [^1]: Smith 2020").

// A label after the closer of a multi-line HTML comment.
const HTML_MULTI = "x[^1]\n\n<!--\nhidden\n--> [^1]: freed label";
// The most ordinary shape: a complete one-line HTML comment, then a label.
const HTML_ONE = "x[^1]\n\n<!-- draft note --> [^1]: def";
// The same two shapes in Obsidian's own comment syntax.
const PERCENT = "x[^1]\n\n%%\nhidden\n%% [^1]: freed label";
const PERCENT_QUOTED = "x[^1]\n\n> %%\n> hidden\n> %% [^1]: freed";

const lineOf = (doc: string, index: number) => doc.split("\n")[index];

describe("the punctuation rule rewrites a label that follows a comment closer", () => {
    it.fails("a label after a multi-line HTML closer keeps its own colon", () => {
        expect(footnoteAfterPunctuation(HTML_MULTI)).toBe(HTML_MULTI);
    });

    it.fails("a label after a complete one-line HTML comment keeps its own colon", () => {
        expect(footnoteAfterPunctuation(HTML_ONE)).toBe(HTML_ONE);
    });

    it.fails("a label after a %% closer keeps its own colon, lint included", () => {
        expect(footnoteAfterPunctuation(PERCENT)).toBe(PERCENT);
        // lintFootnotes with no options is the default settings: the
        // punctuation rule is on for everyone out of the box
        expect(lintFootnotes(PERCENT)).toContain("[^1]:");
    });

    it.fails("a quoted label after a quoted %% closer keeps its own colon", () => {
        expect(footnoteAfterPunctuation(PERCENT_QUOTED)).toBe(PERCENT_QUOTED);
    });

    it("the damage is permanent: a second pass leaves the mangled line as it is", () => {
        // there is no self-repair to wait for. Once the colon has moved,
        // the rule sees nothing left to do, so the footnote stays broken
        for (const doc of [HTML_MULTI, HTML_ONE, PERCENT, PERCENT_QUOTED]) {
            const mangled = footnoteAfterPunctuation(doc);
            expect(mangled).not.toBe(doc);
            expect(mangled).toContain(":[^1]");
            expect(footnoteAfterPunctuation(mangled)).toBe(mangled);
        }
    });
});

describe("orphaned-reference deletion cuts the label's own brackets", () => {
    it.fails("the %% shape is left alone completely", () => {
        expect(removeOrphanedFootnoteReferences(PERCENT)).toBe(PERCENT);
    });

    it.fails("the quoted %% shape is left alone completely", () => {
        expect(removeOrphanedFootnoteReferences(PERCENT_QUOTED)).toBe(
            PERCENT_QUOTED,
        );
    });

    it.fails("the multi-line HTML closer line keeps its brackets", () => {
        expect(lineOf(removeOrphanedFootnoteReferences(HTML_MULTI), 4)).toBe(
            "--> [^1]: freed label",
        );
    });

    it.fails("the one-line HTML comment line keeps its brackets", () => {
        expect(lineOf(removeOrphanedFootnoteReferences(HTML_ONE), 2)).toBe(
            "<!-- draft note --> [^1]: def",
        );
    });

    it("deleting the top reference in the two HTML shapes is correct, not part of the bug", () => {
        // the closer line is literal HTML (CommonMark section 4.6), so
        // nothing in these notes defines footnote 1 and the top "x[^1]" is
        // a true orphaned reference. Cutting it is what the opt-in setting
        // is for
        expect(lineOf(removeOrphanedFootnoteReferences(HTML_MULTI), 0)).toBe("x");
        expect(lineOf(removeOrphanedFootnoteReferences(HTML_ONE), 0)).toBe("x");
    });
});
