import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import {
    computeNextFootnoteNumber,
    listExistingFootnoteDetails,
} from "../../src/insert-or-navigate-footnotes";
import { footnoteAfterPunctuation } from "../../src/linting/rules/footnote-after-punctuation";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// BUG: the opener/closer lines of a multi-line HTML comment are protected
// whole-line, so live text before "<!--" or after "-->" is invisible:
// computeNextFootnoteNumber misses markers there, and reindex renumbers the
// definitions but not those markers (pairing severed).
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: protectedLines marks the whole boundary line protected.

function fakeEditor(lines: string[]): Editor {
    return {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
    } as unknown as Editor;
}

describe("bug: multi-line comment boundary lines hide live text", () => {
    it.fails("a marker before an inline comment opener still counts", () => {
        expect(
            computeNextFootnoteNumber("a[^7] <!-- draft\n--> done[^6]"),
        ).toBe(8);
    });

    it.fails("a marker after an inline comment closer still counts", () => {
        expect(
            computeNextFootnoteNumber("a <!-- draft\n--> done[^7]"),
        ).toBe(8);
    });

    it.fails(
        "reindex renumbers markers and definitions consistently across comment boundary lines",
        () => {
            const input = "x[^9] <!-- hidden\n--> y[^8]\n\n[^8]: eight\n[^9]: nine";
            const expected =
                "x[^1] <!-- hidden\n--> y[^2]\n\n[^2]: eight\n[^1]: nine";
            expect(reindexFootnotes(input)).toBe(expected);
        },
    );

    it.fails("punctuation swap still applies before an inline comment opener", () => {
        expect(footnoteAfterPunctuation("a[^1]. <!-- draft\n--> b")).toBe(
            "a.[^1] <!-- draft\n--> b",
        );
    });

    it.fails("autonumbering sees a marker sitting before the comment opener", () => {
        const doc = "a [^5] <!-- draft\nstill comment\n--> done";
        expect(computeNextFootnoteNumber(doc)).toBe(6);
    });

    it.fails("a definition whose body opens a comment is still a definition", () => {
        const lines = ["text [^5]", "", "[^5]: body <!-- open", "cont -->"];
        expect(listExistingFootnoteDetails(fakeEditor(lines))).toEqual(["5"]);
    });
});
