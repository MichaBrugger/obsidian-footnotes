import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import { listExistingFootnoteDefinitions, listExistingFootnoteReferencesAndLocations } from "../src/doc-context";

// The two document-scanning functions the navigation cascade is built on:
// definitions (definitions) and reference occurrences with positions. Includes the
// 2026-07-14 regression pin: definitions only count at the start of a line.

// Both functions only read lines, so the fake needs exactly two methods.
function fakeEditor(lines: string[]): Editor {
    return {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
    } as unknown as Editor;
}

describe("listExistingFootnoteDefinitions", () => {
    it("returns definition names in line order", () => {
        const doc = fakeEditor([
            "alpha[^1] bravo[^note]",
            "",
            "[^1]: one",
            "[^note]: a named one",
        ]);
        expect(listExistingFootnoteDefinitions(doc)).toEqual(["1", "note"]);
    });

    it("ignores references without the definition colon", () => {
        expect(listExistingFootnoteDefinitions(fakeEditor(["alpha[^1] bravo"]))).toEqual([]);
    });

    it("returns an empty list for an empty document", () => {
        expect(listExistingFootnoteDefinitions(fakeEditor([""]))).toEqual([]);
    });

    it("takes only the first definition on a line", () => {
        // definitions normally sit one per line; two on one line is malformed
        // markdown, and the current behavior is to record just the first
        expect(
            listExistingFootnoteDefinitions(fakeEditor(["[^1]: one [^2]: two"])),
        ).toEqual(["1"]);
    });

    it("ignores a definition reference that is not at the start of the line", () => {
        // regression (reported 2026-07-14): mid-line "[^x]:" is not a real
        // footnote definition in markdown and must not be treated as one
        expect(
            listExistingFootnoteDefinitions(fakeEditor(["prose then [^x]: rest"])),
        ).toEqual([]);
    });
});

describe("listExistingFootnoteReferencesAndLocations", () => {
    it("records each reference with its line number and start index", () => {
        const doc = fakeEditor(["alpha[^1] bravo[^note]"]);
        expect(listExistingFootnoteReferencesAndLocations(doc)).toEqual([
            { footnote: "[^1]", lineNum: 0, startIndex: 5 },
            { footnote: "[^note]", lineNum: 0, startIndex: 15 },
        ]);
    });

    it("excludes definition lines", () => {
        expect(
            listExistingFootnoteReferencesAndLocations(fakeEditor(["[^1]: one"])),
        ).toEqual([]);
    });

    it("tracks references across multiple lines", () => {
        const doc = fakeEditor(["alpha[^1]", "bravo", "charlie[^2]"]);
        expect(listExistingFootnoteReferencesAndLocations(doc)).toEqual([
            { footnote: "[^1]", lineNum: 0, startIndex: 5 },
            { footnote: "[^2]", lineNum: 2, startIndex: 7 },
        ]);
    });

    it("records the same reference each time it is used", () => {
        const doc = fakeEditor(["alpha[^1] bravo[^1]"]);
        expect(listExistingFootnoteReferencesAndLocations(doc)).toEqual([
            { footnote: "[^1]", lineNum: 0, startIndex: 5 },
            { footnote: "[^1]", lineNum: 0, startIndex: 15 },
        ]);
    });

    it("keeps a mid-line reference followed by a literal colon", () => {
        // hunt 2026-07-17: only a column-0 "[^id]:" is a definition; a
        // mid-paragraph "noted[^3]: prose" is a live reference the old
        // (?!:) lookahead used to drop (grammar spec: reference-regexes tests)
        const doc = fakeEditor(["as noted[^3]: more prose", "[^3]: the definition"]);
        expect(listExistingFootnoteReferencesAndLocations(doc)).toEqual([
            { footnote: "[^3]", lineNum: 0, startIndex: 8 },
        ]);
    });
});
