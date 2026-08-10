import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import {
    computeNextFootnoteNumber,
    listExistingFootnoteMarkersAndLocations,
} from "../../src/insert-or-navigate-footnotes";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// Scenario: a backslash-escaped marker "\[^9]" is literal text per CommonMark
// §2.4, yet it gets renumbered by reindex, listed by
// listExistingFootnoteMarkersAndLocations, and reserves autonumbers.
// Hunt: 2026-08-09. Lens: grammar.
// Root cause: the AllMarkers regex has no escape-awareness — it matches "[^…]"
// even when preceded by a backslash.

function fakeEditor(lines: string[]): Editor {
    return {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
    } as unknown as Editor;
}

describe("bug: backslash-escaped markers are treated as real footnotes", () => {
    it.fails("does not treat a backslash-escaped marker as a footnote during reindex", () => {
        const input = "literal \\[^9] real[^7]\n\n[^7]: real";
        expect(reindexFootnotes(input)).toBe("literal \\[^9] real[^1]\n\n[^1]: real");
    });

    it.fails("does not list a backslash-escaped marker as a footnote", () => {
        const doc = fakeEditor(["literal \\[^fake] real[^ok]"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^ok]", lineNum: 0, startIndex: 21 },
        ]);
    });

    it.fails("escaped numeric marker does not reserve the next autonumber", () => {
        expect(computeNextFootnoteNumber("literal \\[^99]")).toBe(1);
    });
});
