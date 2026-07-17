import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import { listExistingFootnoteDetails } from "../../src/insert-or-navigate-footnotes";

// BUG: listExistingFootnoteDetails leaks NUL bytes when a footnote name
// contains a backtick span. It reads the maskProtectedLines/maskInlineCode
// twin of each line (including the definition line itself) and captures the
// name group WITHOUT re-slicing back to the original text — so the masked NULs
// from the code span leak into the returned name ("a\0\0\0c"). Its sibling
// listExistingFootnoteMarkersAndLocations already re-slices the original for
// exactly this reason (see its comment); the details path was never given the
// same fix. If that name is later written back (buildDetailAppend composing a
// "[^name]:" line) the NULs land in the saved document.
// Hunt: 2026-07-17. Lens: grammar. Severity: wrong-output.

function fakeEditor(lines: string[]): Editor {
    return {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
    } as unknown as Editor;
}

describe("bug: detail name with an inline-code span leaks NUL characters", () => {
    it("keeps the real backtick characters of the footnote name", () => {
        const doc = fakeEditor(["see[^a`b`c]", "[^a`b`c]: hi"]);
        expect(listExistingFootnoteDetails(doc)).toEqual(["a`b`c"]);
    });
});
