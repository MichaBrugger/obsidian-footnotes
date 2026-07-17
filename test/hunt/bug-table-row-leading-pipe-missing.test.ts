import { describe, expect, it } from "vitest";

import { tableRowCellSpans } from "../../src/table-cursor";

// BUG: tableRowCellSpans only records a cell when a "|" has already been seen
// before it (it pushes a span on each "|" and at end-of-line, but the FIRST
// cell of a row written without a leading pipe is never opened). Pipe-less rows
// like "A | B" are valid GFM that Obsidian renders as a table, so the first
// cell "A" is dropped and every later cellIndex resolves to the WRONG span —
// the table-cell cursor resolution then reads a position from the wrong cell.
// Scenario: a GFM table row with no leading pipe loses its first cell.
// pinned 2026-07-17, hunt-bugs consolidation.
// Provenance: iteration-1/eval-1/without_skill/run-1 (bug sweep, BUG 8).

describe("bug: table rows without a leading pipe lose their first cell", () => {
    it("returns both cells of 'A | B'", () => {
        expect(tableRowCellSpans("A | B")).toEqual([
            { from: 0, to: 2 },
            { from: 3, to: 5 },
        ]);
    });
});
