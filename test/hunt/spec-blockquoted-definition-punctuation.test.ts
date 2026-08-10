import { describe, expect, it } from "vitest";

import { footnoteAfterPunctuation } from "../../src/linting/rules/footnote-after-punctuation";

// spec question: does Obsidian treat a blockquoted definition label
// ("> [^1]: def") as a live footnote definition?
// Hunt: 2026-08-09. Lens: contexts.
// DefinitionStart anchors at column 0, so the blockquoted label reads as a
// REFERENCE followed by a colon and the punctuation rule swaps the reference across
// its own colon: "> [^1]: def." currently becomes "> :[^1] def.". If Obsidian
// renders blockquoted definitions live (markdown-it-footnote does), this
// corrupts a definition label; if not, the swap is harmless.

describe("spec question: punctuation swap vs. blockquoted definition label", () => {
    it.fails("punctuation swap does not mangle a blockquoted definition label", () => {
        expect(footnoteAfterPunctuation("> [^1]: def.")).toBe("> [^1]: def.");
    });
});
