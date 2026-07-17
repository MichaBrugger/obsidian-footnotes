import { describe, expect, it } from "vitest";

import { tableRowCellSpans } from "../src/table-cursor";

// The escape-aware cell geometry that resolveTableCellCursor uses to map a
// cell-local caret back to a document position. Only this slicing is
// unit-testable; finding the live cell sub-editor (findFromDOM) is a
// contract with Obsidian and lives in the smoke suite's table test.

describe("tableRowCellSpans", () => {
    it("returns one span per cell of a simple row", () => {
        // spans cover the raw cell text INCLUDING the padding spaces;
        // callers trim, this function only locates
        expect(tableRowCellSpans("| a | b |")).toEqual([
            { from: 1, to: 4 },
            { from: 5, to: 8 },
        ]);
    });

    it("treats text after the last pipe as an unclosed trailing cell", () => {
        expect(tableRowCellSpans("| a | b")).toEqual([
            { from: 1, to: 4 },
            { from: 5, to: 7 },
        ]);
    });

    it("does not split a cell on an escaped pipe", () => {
        expect(tableRowCellSpans("| a \\| b |")).toEqual([
            { from: 1, to: 9 },
        ]);
    });

    // spec changed 2026-07-17: the leading pipe is optional in GFM, so text
    // before the first pipe IS the first cell (was a characterization test
    // pinning the old dropped-cell behavior — see
    // test/hunt/bug-table-row-leading-pipe-missing.test.ts)
    it("treats text before the first pipe as the first cell", () => {
        expect(tableRowCellSpans("x | y |")).toEqual([
            { from: 0, to: 2 },
            { from: 3, to: 6 },
        ]);
    });

    it("yields a zero-width span for an empty cell", () => {
        expect(tableRowCellSpans("||")).toEqual([{ from: 1, to: 1 }]);
    });

    it("returns no spans for an empty line", () => {
        expect(tableRowCellSpans("")).toEqual([]);
    });

    it("returns no spans for a line without pipes", () => {
        expect(tableRowCellSpans("plain prose, no table here")).toEqual([]);
    });
});
