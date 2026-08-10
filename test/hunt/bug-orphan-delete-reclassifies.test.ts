import { describe, expect, it } from "vitest";

import { removeOrphanedFootnoteReferences } from "../../src/linting/rules/remove-orphaned-references";

// Found by the fast-check idempotence property (2026-08-10), ground truth
// verified against Obsidian's metadataCache: deleting the orphaned "[^42]"
// blanks the only paragraph between a definition and an indented chunk —
// and Obsidian continues a footnote definition across ANY run of blank
// lines, so the chunk flips from indented CODE to definition CONTINUATION.
// The next lint pass then saw "[^73]" as a live (orphaned) reference and
// deleted text the first pass had promised to protect. The rule now
// refuses any deletion that changes another line's protection
// classification; such orphans stay for the user to resolve.

describe("orphan-reference deletion never re-classifies other lines", () => {
    it("refuses the deletion that would demote indented code to a continuation", () => {
        const doc = "[^1]: alpha\n\n[^42]\n\n    indented code[^73]";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });

    it("still deletes orphans whose removal is classification-neutral", () => {
        const doc =
            "keep[^1] drop[^9] end\n\npara\n\n    indented code[^73]\n\n[^1]: one";
        // the indented chunk is shielded by the "para" paragraph in BOTH
        // the input and the output — [^9]'s deletion changes nothing
        expect(removeOrphanedFootnoteReferences(doc)).toBe(
            "keep[^1] drop end\n\npara\n\n    indented code[^73]\n\n[^1]: one",
        );
    });
});
