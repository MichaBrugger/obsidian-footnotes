import { describe, expect, it } from "vitest";

import { protectedLines, scanDocument } from "../../src/parsing/markdown-scan";

// Sol re-review bug #4 (2026-08-10), ground truth verified against
// Obsidian's metadataCache ("blockquote:0-1, paragraph:3-3"): an unclosed
// "$$" or "<!--" opened INSIDE a blockquote dies with its quote — but the
// scanner's comment/math state had no container tracking (fences got it
// in f84e96b), so everything after the quote was protected to EOF and
// invisible to every scan. Comment/math regions now record the blockquote
// depth they opened at and end when a line's depth drops below it.

describe("unclosed comment/math regions die with their blockquote", () => {
    it("a quoted unclosed $$ ends at the quote's end", () => {
        const doc = "> $$\n> x = 1\n\nafter[^1]\n\n[^1]: def";
        expect(protectedLines(doc.split("\n"))).toEqual([
            false,
            true,
            false,
            false,
            false,
            false,
        ]);
    });

    it("a quoted unclosed <!-- ends at the quote's end", () => {
        const doc = "> <!--\n> draft\n\nafter[^1]";
        expect(protectedLines(doc.split("\n"))).toEqual([
            false,
            true,
            false,
            false,
        ]);
    });

    it("an unquoted lazy line also ends the quoted region", () => {
        // CommonMark: lazy continuation is for paragraphs only — an
        // unprefixed line ends the quote, and the region with it
        const doc = "> $$\nlazy[^1]";
        expect(protectedLines(doc.split("\n"))).toEqual([false, false]);
    });

    it("a document-level unclosed region still protects to EOF", () => {
        const doc = "$$\nx\n\nswallowed[^1]";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.isProtected).toEqual([false, true, true, true]);
        expect(scan.endsProtected).toBe(true);
    });

    it("a quoted unclosed region does not protect an EOF append", () => {
        const scan = scanDocument("> $$\n> x".split("\n"));
        expect(scan.endsProtected).toBe(false);
    });
});
