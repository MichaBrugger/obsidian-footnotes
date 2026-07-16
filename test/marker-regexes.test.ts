import { describe, expect, it } from "vitest";

import { AllMarkers, ExtractNameFromFootnote } from "../src/insert-or-navigate-footnotes";

// AllMarkers is a /g regex: matchAll (used everywhere in src) is stateless,
// but .test()/.exec() would advance lastIndex between calls — these tests
// stick to matchAll on purpose.
function markerNames(text: string): string[] {
    return [...text.matchAll(AllMarkers)].map((m) => m[1]);
}

describe("AllMarkers", () => {
    it("matches numbered and named markers", () => {
        expect(markerNames("alpha[^1] bravo[^note]")).toEqual(["1", "note"]);
    });

    it("does not match detail lines (marker followed by a colon)", () => {
        expect(markerNames("[^1]: the detail")).toEqual([]);
    });

    it("does not match an empty marker", () => {
        // [^] is the just-inserted named-footnote shell awaiting a name
        expect(markerNames("alpha[^] bravo")).toEqual([]);
    });

    it("does not match names containing brackets", () => {
        expect(markerNames("alpha[^a[b] bravo")).toEqual([]);
    });

    it("still matches an invalid spaced name so the plugin can warn about it", () => {
        // spaced names don't render as footnotes; the regex stays permissive
        // so the invalid-name warning can find them (see invalid-footnote-name
        // tests), rather than silently treating them as plain text
        expect(markerNames("alpha[^my note!] bravo")).toEqual(["my note!"]);
    });

    it("matches a marker at the very start and end of a line", () => {
        expect(markerNames("[^a] middle [^b]")).toEqual(["a", "b"]);
    });
});

describe("ExtractNameFromFootnote", () => {
    it("extracts the name from a marker", () => {
        const match = "[^note]".match(ExtractNameFromFootnote);
        expect(match?.[2]).toBe("note");
    });

    it("extracts a numeric name", () => {
        const match = "[^12]".match(ExtractNameFromFootnote);
        expect(match?.[2]).toBe("12");
    });

    it("does not match an empty marker", () => {
        expect("[^]".match(ExtractNameFromFootnote)).toBeNull();
    });
});
