import { describe, expect, it } from "vitest";

import {
    AllMarkers,
    ExtractNameFromFootnote,
    footnoteMarkerMatches,
} from "../src/insert-or-navigate-footnotes";

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

    it("matches the marker shape even before a colon (definitions are excluded positionally, not by the colon)", () => {
        // grammar change 2026-07-17: the old (?!:) lookahead also dropped a
        // genuine mid-line reference sitting before a literal colon
        // ("noted[^3]: prose"). AllMarkers now matches the raw marker shape;
        // a definition's column-0 "[^id]:" label is excluded by
        // footnoteMarkerMatches (see below), not by the regex.
        expect(markerNames("[^1]: the detail")).toEqual(["1"]);
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

describe("footnoteMarkerMatches", () => {
    const names = (line: string) =>
        footnoteMarkerMatches(line).map((m) => m[1]);

    it("excludes a definition's own column-0 label", () => {
        expect(names("[^1]: the detail")).toEqual([]);
    });

    it("keeps a mid-line marker that happens to precede a colon", () => {
        // "noted[^3]: prose" renders as a live reference plus a literal
        // colon; only a column-0 "[^id]:" is a definition
        expect(names("as noted[^3]: more prose")).toEqual(["3"]);
    });

    it("keeps markers in a definition body after the label", () => {
        expect(names("[^1]: see also[^2]")).toEqual(["2"]);
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
