import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import { listExistingFootnoteMarkersAndLocations } from "../../src/insert-or-navigate-footnotes";

// BUG: AllMarkers' (?!:) negative lookahead drops a real marker occurrence that
// happens to be followed by a colon mid-line. In Markdown/Obsidian a definition
// ("[^x]:") is recognised only at COLUMN 0 (DefinitionStart / DetailInLine are
// both ^-anchored); a mid-paragraph "as noted[^3]: more prose" renders as a
// live reference [^3] followed by literal ": more prose". But AllMarkers is not
// column-anchored, so its (?!:) throws the reference away everywhere the marker
// grammar is used (listing, jump, create-matching-detail, marker-at-cursor).
// A caret on that [^3] is therefore invisible to navigation and the cascade
// falls through to inserting a new marker on top of it.
// Hunt: 2026-07-17. Lens: grammar. Severity: wrong-output.

function fakeEditor(lines: string[]): Editor {
    return {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
    } as unknown as Editor;
}

describe("bug: mid-line marker followed by a colon is dropped", () => {
    it.fails("a mid-line [^3] before a literal colon is still a marker occurrence", () => {
        const doc = fakeEditor(["as noted[^3]: more prose", "[^3]: the detail"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^3]", lineNum: 0, startIndex: 8 },
        ]);
    });
});
