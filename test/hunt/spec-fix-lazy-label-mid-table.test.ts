import { describe, expect, it } from "vitest";

import { lintFootnotes } from "../../src/linting/linter";
import { fixLazyDefinitions } from "../../src/linting/rules/fix-lazy-definitions";

// spec question: when a lazy label sits under a table row that is not the
// last one, should the fix-lazy rule insert its blank line there anyway, or
// do something that keeps the table whole?
//
// The shape: a table, and somewhere in the middle of it the user has typed
// "[^1]: x" on its own line, with more rows under it. The label is lazy (a
// label directly under a table row is paragraph text, not a definition), so
// the rule gives it a blank line above. GFM's table section says "The table
// is broken at the first empty line, or beginning of another block-level
// structure", so that blank line ends the table right there. Every row
// below it stops being a row and renders as literal text with pipes in it.
// Sitting directly under the promoted label, the leftover row is also read
// as that footnote's body.
//
// Reading one (fix it anyway, as today): the rule's job is to make lazy
// labels into definitions, and it does. The user typed a label in the
// middle of a table, which is already a strange thing to have; the blank
// line is the documented fix everywhere else.
//
// Reading two (keep the table whole): the note's table is content the user
// cares about and the plugin has no business cutting it in half. ADR-0002
// says a fix that destroys content is alerted rather than applied. Three
// remedies are on the table for Jason to pick between:
//   1. Alert instead of fixing whenever the lazy label sits above a row
//      that is not the table's last. The user moves the label themselves.
//   2. Relocate the label out of the table: cut the label line from where
//      it sits and put it below the table, then give it the blank line.
//   3. Fix it, then let move-to-bottom carry the label away as it already
//      does, and drop the blank line it leaves behind so the rows close
//      back up.
// Remedy 3 is the smallest change but only helps when move-to-bottom is
// on; remedies 1 and 2 hold with every rule combination.
//
// Hunt: 2026-09-13
// Lens: the fix-lazy-definitions rule (its interaction with tables and with
// move-to-bottom).
//
// Source of truth: the GFM spec, "Tables (extension)", for the break on a
// blank line; manual sheet 25, whose only table fixture puts the label
// under the LAST row of the table, where the inserted blank line falls
// after the table and costs nothing. Nothing in the sheets covers a label
// above a row.
//
// Worth one confirmation in Obsidian's Reading view: GFM's break-on-blank
// rule is quoted from the spec, and Obsidian's renderer has not been
// checked on this exact shape. If Obsidian keeps the rows below the blank
// line as a table, the whole question goes away.
//
// The assertions below are written for reading two, so they are red today.

const MIDDLE_ROW = ["| a | b |", "| - | - |", "| c | d |", "[^1]: x", "| e | f |", "", "ref[^1]"].join("\n");
const DELIMITER_ROW = ["| a | b |", "| - | - |", "[^1]: x", "| c | d |", "", "ref[^1]"].join("\n");

describe("a lazy label under a table row that is not the last", () => {
    it.fails("the fix does not cut the table in half (label under a middle body row)", () => {
        const lines = fixLazyDefinitions(MIDDLE_ROW).split("\n");
        const lastRow = lines.indexOf("| e | f |");
        // no blank line anywhere between the header row and the last body
        // row, which is what would end the table early
        expect(lines.slice(0, lastRow + 1).filter((l) => l.trim() === "")).toEqual([]);
    });

    it.fails("nor when the label sits directly under the delimiter row", () => {
        const lines = fixLazyDefinitions(DELIMITER_ROW).split("\n");
        const lastRow = lines.indexOf("| c | d |");
        expect(lines.slice(0, lastRow + 1).filter((l) => l.trim() === "")).toEqual([]);
    });

    it.fails("the default lint leaves the whole table standing", () => {
        // move-to-bottom carries the label away afterwards, but it never
        // takes the unindented row with it and it does not close the gap,
        // so the severed row stays severed
        expect(lintFootnotes(MIDDLE_ROW)).toContain("| c | d |\n| e | f |");
    });

    it("the severed table is at least stable: a second lint changes nothing", () => {
        const once = lintFootnotes(MIDDLE_ROW);
        expect(lintFootnotes(once)).toBe(once);
    });
});

describe("the boundary: sheet 25's fixture, the label under the LAST row", () => {
    const LAST_ROW = ["| a | b |", "| - | - |", "| c | d |", "[^1]: x", "", "ref[^1]"].join("\n");

    it("the blank line lands after the table and the table is untouched", () => {
        expect(fixLazyDefinitions(LAST_ROW)).toBe(
            "| a | b |\n| - | - |\n| c | d |\n\n[^1]: x\n\nref[^1]",
        );
    });

    it("and the default lint keeps every row together", () => {
        expect(lintFootnotes(LAST_ROW)).toBe(
            "| a | b |\n| - | - |\n| c | d |\n\nref[^1]\n\n[^1]: x",
        );
    });
});
