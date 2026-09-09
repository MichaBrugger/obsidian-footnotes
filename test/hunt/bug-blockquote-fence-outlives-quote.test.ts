import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/parsing/footnote-grammar";
import { moveFootnoteDefinitionsToBottom } from "../../src/linting/rules/move-footnotes-to-the-bottom";

// BUG: an unclosed fence inside a blockquote ends when the blockquote ends
// (CommonMark ex. 100), but the plugin's fence runs to EOF, hiding live
// content.
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: protectedLines keeps the fence open past the end of its
// blockquote container.

describe("fixed 2026-08-10: a blockquoted fence dies with its blockquote", () => {
    it("stops a blockquoted fence when the blockquote itself ends", () => {
        const markdown = [
            "> ```",
            "> sample[^99]",
            "outside the quote[^7]",
        ].join("\n");

        expect(computeNextFootnoteNumber(markdown)).toBe(8);
    });

    it("keeps definitions outside an ended blockquote fence movable", () => {
        const input = [
            "> ```",
            "> sample[^99]",
            "body[^1]",
            "",
            "[^1]: one",
            "tail",
        ].join("\n");
        const expected = [
            "> ```",
            "> sample[^99]",
            "body[^1]",
            "",
            "tail",
            "",
            "[^1]: one",
        ].join("\n");

        expect(moveFootnoteDefinitionsToBottom(input)).toBe(expected);
    });
});
