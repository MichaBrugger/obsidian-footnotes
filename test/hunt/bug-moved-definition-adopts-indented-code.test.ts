import { describe, expect, it } from "vitest";

import { lintFootnotes } from "../../src/linting/linter";
import { findDefinitionBlocks, scanDocument } from "../../src/parsing/markdown-scan";

// Found by the conservation property (2026-09-11) while an unrelated change
// was being checked; it predates that change. A note whose "# Footnotes"
// heading is followed by a standalone indented code chunk:
//
//     [^1]: sees [^1]
//
//     # Footnotes
//
//     <tab>code-shaped[^89]
//
// Move-to-bottom gathers the definition under the heading, which puts the
// code chunk directly after the definition's blank line. An indented line
// after a definition's blank gap CONTINUES that definition, so the code
// chunk stops being code and becomes footnote body - and the "[^89]" inside
// it, dead as code, wakes up as a live reference. The rule moved a
// definition onto a chunk it then swallowed.
//
// The fix is the move rule's: when the slot under the heading is followed
// by an indented chunk, keep a separating line that cannot continue the
// definition (or refuse the move), so the chunk stays code.

describe("move-to-bottom must not park a definition where indented code continues it", () => {
    const doc = "[^1]: sees [^1]\n\n# Footnotes\n\n\tcode-shaped[^89]";
    const options = { fixPunctuation: false, fixLazyDefinitions: false, reindex: false, sectionHeading: "# Footnotes" };

    it.fails("the code chunk stays standalone code after the move", () => {
        const out = lintFootnotes(doc, options);
        const lines = out.split("\n");
        const scan = scanDocument(lines);
        expect(scan.isProtected[lines.length - 1]).toBe(true);
        expect(findDefinitionBlocks(lines, scan).map((b) => b.end)).toEqual([2]);
    });
});
