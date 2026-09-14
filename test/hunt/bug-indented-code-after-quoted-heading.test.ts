// Imported from the GLM sweep of 2026-09-13 (T3 Code worktree); 9 of 11 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { maskProtectedLines, protectedLines, scanDocument } from "../../src/parsing/markdown-scan";
import { referenceOccurrences } from "../../src/parsing/footnote-grammar";
import { footnoteAfterPunctuation } from "../../src/linting/rules/footnote-after-punctuation";
import { removeOrphanedFootnoteReferences } from "../../src/linting/rules/remove-orphaned-references";

// WHAT A USER SEES. A code block indented under a quoted heading or a
// quoted thematic break ("> # Notes" then ">     code here"), or under a
// setext heading ("Title" then "===" then "    code here"), is treated as
// live prose by the plugin. Reference-shaped text inside it is counted as
// a real footnote, so:
//
//   - "Delete orphaned references" DELETES "[^1]" from inside the code
//     block (code text destroyed);
//   - the punctuation rule rewrites the code line ("see [^1]." becomes
//     "see .[^1]");
//   - reindex hands the fake reference's number to the note's real
//     footnotes, renumbering them wrong.
//
// Ground truth (micromark/mdast, the differential-oracle convention, run
// 2026-09-13): all six shapes below parse with the indented chunk as a
// CODE block, both inside the quote and at the document level:
//
//   "> ---"      + ">     code"  => quote[thematicBreak, CODE]
//   "> # H"      + ">     code"  => quote[heading, CODE]
//   "> ---"      + "    code"    => quote[thematicBreak] | CODE
//   "> # H"      + "    code"    => quote[heading] | CODE
//   "H\n==="     + "    code"    => heading | CODE
//   "> H\n> ===" + ">     code"  => quote[heading, CODE]
//
// The document-level heading and thematic-break cases ARE handled
// (blockBoundary in scanDocument); the quoted variants never set
// quote.boundary, the quoted lines never set the document-level
// blockBoundary either, and scanDocument never considers a setext heading
// at all. The lazy-paragraph control ("para" then quoted indented text)
// must stay live: lazy continuation applies to paragraphs, and it does.

function liveFlags(lines: string[]): boolean[] {
    return protectedLines(lines).map((p) => !p);
}

describe("indented code after a quoted heading or thematic break is misread as live text", () => {
    it("document-level heading and thematic break set the boundary (control)", () => {
        expect(liveFlags(["# H", "    code[^1]"])).toEqual([true, false]);
        expect(liveFlags(["---", "    code[^1]"])).toEqual([true, false]);
    });

    it("quoted paragraph keeps its lazy continuation live (control)", () => {
        expect(liveFlags(["> para", ">     lazy live[^1]"])).toEqual([true, true]);
    });

    it.fails("quoted thematic break, code inside the quote", () => {
        expect(liveFlags(["> ---", ">     code[^1]"])).toEqual([true, false]);
    });

    it.fails("quoted heading, code inside the quote", () => {
        expect(liveFlags(["> # H", ">     code[^1]"])).toEqual([true, false]);
    });

    it.fails("quoted thematic break, code below the quote", () => {
        expect(liveFlags(["> ---", "    code[^1]"])).toEqual([true, false]);
    });

    it.fails("quoted heading, code below the quote", () => {
        expect(liveFlags(["> # H", "    code[^1]"])).toEqual([true, false]);
    });

    it.fails("setext heading, code below it", () => {
        expect(liveFlags(["H", "===", "    code[^1]"])).toEqual([true, true, false]);
    });

    it.fails("quoted setext heading, code inside the quote", () => {
        expect(liveFlags(["> H", "> ===", ">     code[^1]"])).toEqual([true, true, false]);
    });

    it.fails("the reference-shaped text in that region is a fake, not an occurrence", () => {
        const lines = ["> # Notes", ">     see [^1] in code"];
        const scan = scanDocument(lines);
        const masked = maskProtectedLines(lines, scan);
        expect(referenceOccurrences(lines[1], masked[1])).toEqual([]);
    });
});

describe("what the misreading does through the lint", () => {
    it.fails("punctuation rule rewrites the code line", () => {
        const doc = "> ---\n>     see [^1]. end";
        expect(footnoteAfterPunctuation(doc)).toBe(doc);
    });

    it.fails("delete orphaned references deletes text inside the code block", () => {
        const doc = "> # Notes\n>     see [^1] in code";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });
});
