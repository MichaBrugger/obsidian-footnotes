import { describe, expect, it } from "vitest";

import { lintFootnotes } from "../../src/linting/linter";
import { removeOrphanedFootnoteDefinitions } from "../../src/linting/rules/remove-orphaned-definitions";

// Scenario: an orphaned definition inside a blockquote, with an indented
// body line under its label, and that body line cites another footnote. The
// orphaned-definition rule cuts the label line only, and the body line left
// behind changes meaning: it stops being part of a definition and becomes
// quoted indented code. Its reference dies with it, so the footnote it was
// keeping alive is an orphan on the next pass and is deleted too.
//
// What the user would see: they turn "Delete orphaned definitions" on and
// lint. A stray quoted definition goes, which is what they asked for. They
// lint again without changing anything, and a second footnote definition
// they never touched, "[^b]: bee", is gone as well. Undo puts it back one
// lint at a time, so a user who does not notice until later has lost it.
//
// Hunt: 2026-09-13
// Lens: the two orphan rules (attack-surface row 10).
//
// Source of truth: the GFM reference parser vendored in this repo
// (mdast-util-gfm-footnote). Before the cut, the indented quote line parses
// as a paragraph inside footnoteDefinition "9", holding a live
// footnoteReference "b"; after the cut, the same line parses as "code". So
// the deletion really does change how the line below it is read. Also
// ADR-0002 (lint never eats text the user did not opt into losing), the
// reclassification guard already pinned in
// test/hunt/bug-orphan-delete-reclassifies.test.ts, and the scanner's own
// quote.inDefinition, which says a quoted definition has continuation
// lines. The rule disagrees with the scanner: it pushes a quoted label as a
// one-line block, so the body under it is never carried away with it.
//
// This is the same class as bug-orphan-delete-reclassifies, which added a
// reclassification guard to the REFERENCE rule only. The definition rule
// has no such guard.
//
// Settings: "Delete orphaned definitions" on. The loss shows up on the
// second lint, whether the rest of the pipeline is off or at its defaults.

const QUOTED = "para.\n\n> [^9]: stray\n>\n>     body cites[^b]\n\n[^b]: bee";
const QUOTED_NO_BARE_MARKER = "para.\n\n> [^9]: stray\n>     body cites[^b]\n\n[^b]: bee";

const rulesOff = {
    fixPunctuation: false,
    moveDefinitionsToBottom: false,
    reindex: false,
    fixLazyDefinitions: false,
};

describe("deleting a quoted orphaned definition strands its body", () => {
    it.fails("the second run does not delete a definition the first run kept", () => {
        const once = removeOrphanedFootnoteDefinitions(QUOTED);
        expect(once).toContain("[^b]: bee");
        expect(removeOrphanedFootnoteDefinitions(once)).toBe(once);
    });

    it.fails("the same loss without the bare quote marker between the two lines", () => {
        const once = removeOrphanedFootnoteDefinitions(QUOTED_NO_BARE_MARKER);
        expect(once).toContain("[^b]: bee");
        expect(removeOrphanedFootnoteDefinitions(once)).toBe(once);
    });

    it.fails("linting twice with only this rule on loses it too", () => {
        const options = { ...rulesOff, removeOrphanedDefinitions: true };
        const once = lintFootnotes(QUOTED, options);
        expect(lintFootnotes(once, options)).toBe(once);
    });

    it.fails("and so does linting twice with the default rules on", () => {
        const options = { removeOrphanedDefinitions: true };
        const once = lintFootnotes(QUOTED, options);
        expect(once).toContain("[^b]: bee");
        expect(lintFootnotes(once, options)).toBe(once);
    });
});

describe("the boundary: deletions that change nothing around them", () => {
    it("an unquoted orphaned definition goes and nothing else follows it", () => {
        const doc = "text[^1]\n\n[^9]: stray\n\n[^1]: used";
        const once = removeOrphanedFootnoteDefinitions(doc);
        expect(once).toBe("text[^1]\n\n[^1]: used");
        expect(removeOrphanedFootnoteDefinitions(once)).toBe(once);
    });

    it("a quoted orphaned definition with no body goes whole", () => {
        expect(removeOrphanedFootnoteDefinitions("para.\n\n> [^9]: stray")).toBe("para.\n");
    });
});
