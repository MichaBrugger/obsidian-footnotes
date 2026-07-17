import { describe, expect, it } from "vitest";

import { tableRowCellSpans } from "../../src/table-cursor";

// Offset-lens probes for tableRowCellSpans: escapes exactly at span
// boundaries, trailing backslashes, double-backslash-then-pipe, tabs,
// unicode cell content.

describe("tableRowCellSpans probes", () => {
    it("escaped pipe as the last character keeps the trailing cell open", () => {
        // "| a \|" — the escaped pipe is content, not a boundary
        const line = "| a \\|";
        expect(tableRowCellSpans(line)).toEqual([{ from: 1, to: 6 }]);
    });

    it("escaped backslash then pipe IS a boundary (GFM: \\\\| splits)", () => {
        // "| a \\| b |" in source: the \\ is a literal backslash, the pipe splits
        const line = "| a \\\\| b |"; // | a \ \ | b |
        expect(tableRowCellSpans(line)).toEqual([
            { from: 1, to: 6 },
            { from: 7, to: 10 },
        ]);
    });

    it("escaped pipe immediately after the opening pipe", () => {
        const line = "|\\| a |"; // | \| a |
        expect(tableRowCellSpans(line)).toEqual([{ from: 1, to: 6 }]);
    });

    it("escaped pipe immediately before a closing pipe", () => {
        const line = "| a\\||"; // cell content "a\|", then boundary
        expect(tableRowCellSpans(line)).toEqual([{ from: 1, to: 5 }]);
    });

    it("lone backslash at end of line does not run off the string", () => {
        const line = "| a\\";
        expect(tableRowCellSpans(line)).toEqual([{ from: 1, to: 4 }]);
    });

    it("tab padding inside cells is part of the span", () => {
        const line = "|\ta\t|\tb\t|";
        expect(tableRowCellSpans(line)).toEqual([
            { from: 1, to: 4 },
            { from: 5, to: 8 },
        ]);
    });

    it("surrogate-pair content: spans measured in UTF-16 units", () => {
        const line = "| \u{1F600} | b |"; // emoji is 2 units: cell 0 is 1..5
        expect(tableRowCellSpans(line)).toEqual([
            { from: 1, to: 5 },
            { from: 6, to: 9 },
        ]);
    });

    it("a single pipe yields no cells", () => {
        expect(tableRowCellSpans("|")).toEqual([]);
    });

    it("zero-width trailing cell before EOL is not emitted", () => {
        // "| a |" — nothing after the last pipe
        expect(tableRowCellSpans("| a |")).toEqual([{ from: 1, to: 4 }]);
    });

    it("delimiter row splits like any other row", () => {
        expect(tableRowCellSpans("|---|:-:|")).toEqual([
            { from: 1, to: 4 },
            { from: 5, to: 8 },
        ]);
    });
});
