import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import {
    listExistingFootnoteDetails,
    listExistingFootnoteMarkersAndLocations,
} from "../../src/insert-or-navigate-footnotes";

// Grammar probes: name alphabets and marker/detail boundary cases in the
// two document-scanning functions.

function fakeEditor(lines: string[]): Editor {
    return {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
    } as unknown as Editor;
}

describe("name alphabets (should all pass — Obsidian renders these names)", () => {
    it("emoji names", () => {
        const doc = fakeEditor(["alpha[^📝] bravo", "[^📝]: note"]);
        expect(listExistingFootnoteDetails(doc)).toEqual(["📝"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^📝]", lineNum: 0, startIndex: 5 },
        ]);
    });

    it("CJK names", () => {
        const doc = fakeEditor(["alpha[^注釈] bravo", "[^注釈]: note"]);
        expect(listExistingFootnoteDetails(doc)).toEqual(["注釈"]);
    });

    it("dots, underscores, leading/trailing hyphens", () => {
        const doc = fakeEditor([
            "a[^a.b] b[^a_b] c[^-x] d[^x-]",
            "[^a.b]: 1",
            "[^a_b]: 2",
            "[^-x]: 3",
            "[^x-]: 4",
        ]);
        expect(listExistingFootnoteDetails(doc)).toEqual([
            "a.b",
            "a_b",
            "-x",
            "x-",
        ]);
    });

    it("a name that is a prefix of another name stays distinct", () => {
        const doc = fakeEditor(["a[^n] b[^n2]", "[^n]: one", "[^n2]: two"]);
        expect(listExistingFootnoteDetails(doc)).toEqual(["n", "n2"]);
        expect(
            listExistingFootnoteMarkersAndLocations(doc).map((m) => m.footnote),
        ).toEqual(["[^n]", "[^n2]"]);
    });

    it("very long names", () => {
        const name = "x".repeat(2000);
        const doc = fakeEditor([`a[^${name}]`, `[^${name}]: long`]);
        expect(listExistingFootnoteDetails(doc)).toEqual([name]);
    });

    it("empty name [^] is neither marker nor detail", () => {
        const doc = fakeEditor(["a[^] b", "[^]: nope"]);
        expect(listExistingFootnoteDetails(doc)).toEqual([]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([]);
    });
});

describe("marker/detail boundary grammar", () => {
    it("[^1] : with a space before the colon is a marker, not a detail", () => {
        // markdown requires "[^1]:" with no gap for a definition; with the
        // gap the bracket run renders as a reference followed by " : text"
        const doc = fakeEditor(["[^1] : not a detail"]);
        expect(listExistingFootnoteDetails(doc)).toEqual([]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^1]", lineNum: 0, startIndex: 0 },
        ]);
    });

    it("a marker straddled by bold is still found", () => {
        const doc = fakeEditor(["text **[^1]** more"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^1]", lineNum: 0, startIndex: 7 },
        ]);
    });

    it("a mid-line marker followed by a colon is still a marker occurrence", () => {
        // "as noted[^3]: more" mid-paragraph renders as reference [^3]
        // followed by the literal text ": more" — only a COLUMN-0 "[^x]:"
        // is a definition. AllMarkers' (?!:) drops this real reference.
        const doc = fakeEditor(["as noted[^3]: more prose", "[^3]: the detail"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^3]", lineNum: 0, startIndex: 8 },
        ]);
    });

    it("a detail name containing an inline-code span keeps its real characters", () => {
        // brackets of a footnote label don't parse inline code, so the
        // backticks are literal name characters. The masked twin blots the
        // span out with NULs — markers slice the original line back, but
        // the details list keeps the masked text, leaking "\0" names.
        const doc = fakeEditor(["see[^a`b`c]", "[^a`b`c]: hi"]);
        expect(
            listExistingFootnoteMarkersAndLocations(doc).map((m) => m.footnote),
        ).toEqual(["[^a`b`c]"]); // markers side: passes (slices original)
        expect(listExistingFootnoteDetails(doc)).toEqual(["a`b`c"]);
    });
});
