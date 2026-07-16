import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import {
    listExistingFootnoteDetails,
    listExistingFootnoteMarkersAndLocations,
} from "../src/insert-or-navigate-footnotes";

// The two document-scanning functions the navigation cascade is built on:
// details (definitions) and marker occurrences with positions. Includes the
// 2026-07-14 regression pin: details only count at the start of a line.

// Both functions only read lines, so the fake needs exactly two methods.
function fakeEditor(lines: string[]): Editor {
    return {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
    } as unknown as Editor;
}

describe("listExistingFootnoteDetails", () => {
    it("returns detail names in line order", () => {
        const doc = fakeEditor([
            "alpha[^1] bravo[^note]",
            "",
            "[^1]: one",
            "[^note]: a named one",
        ]);
        expect(listExistingFootnoteDetails(doc)).toEqual(["1", "note"]);
    });

    it("ignores markers without the detail colon", () => {
        expect(listExistingFootnoteDetails(fakeEditor(["alpha[^1] bravo"]))).toEqual([]);
    });

    it("returns an empty list for an empty document", () => {
        expect(listExistingFootnoteDetails(fakeEditor([""]))).toEqual([]);
    });

    it("takes only the first detail on a line", () => {
        // details normally sit one per line; two on one line is malformed
        // markdown, and the current behavior is to record just the first
        expect(
            listExistingFootnoteDetails(fakeEditor(["[^1]: one [^2]: two"])),
        ).toEqual(["1"]);
    });

    it("ignores a detail marker that is not at the start of the line", () => {
        // regression (reported 2026-07-14): mid-line "[^x]:" is not a real
        // footnote detail in markdown and must not be treated as one
        expect(
            listExistingFootnoteDetails(fakeEditor(["prose then [^x]: rest"])),
        ).toEqual([]);
    });
});

describe("listExistingFootnoteMarkersAndLocations", () => {
    it("records each marker with its line number and start index", () => {
        const doc = fakeEditor(["alpha[^1] bravo[^note]"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^1]", lineNum: 0, startIndex: 5 },
            { footnote: "[^note]", lineNum: 0, startIndex: 15 },
        ]);
    });

    it("excludes detail lines", () => {
        expect(
            listExistingFootnoteMarkersAndLocations(fakeEditor(["[^1]: one"])),
        ).toEqual([]);
    });

    it("tracks markers across multiple lines", () => {
        const doc = fakeEditor(["alpha[^1]", "bravo", "charlie[^2]"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^1]", lineNum: 0, startIndex: 5 },
            { footnote: "[^2]", lineNum: 2, startIndex: 7 },
        ]);
    });

    it("records the same marker each time it is used", () => {
        const doc = fakeEditor(["alpha[^1] bravo[^1]"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^1]", lineNum: 0, startIndex: 5 },
            { footnote: "[^1]", lineNum: 0, startIndex: 15 },
        ]);
    });
});
