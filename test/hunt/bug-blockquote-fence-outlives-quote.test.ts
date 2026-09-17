import { describe, expect, it } from "vitest";
// PROBED 2026-09-16 (GLM hunt cycle 11, Reading view): a PLAIN line directly under a quoted or list-item fence's content is swallowed by the fence (it renders inside the code block), while a blank line, an indented chunk, a heading, a list marker, or a bare fence ends the fence with its container. The fixtures below that put plain text directly under the fence gained the blank line Reading view needs; their purpose (the fence dies with its container) stands.

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
            "",
            "outside the quote[^7]",
        ].join("\n");

        expect(computeNextFootnoteNumber(markdown)).toBe(8);
    });

    it("keeps definitions outside an ended blockquote fence movable", () => {
        const input = [
            "> ```",
            "> sample[^99]",
            "",
            "body[^1]",
            "",
            "[^1]: one",
            "tail",
        ].join("\n");
        // "tail" sits directly under the definition, so it is the
        // definition's lazy continuation (Reading view renders one footnote
        // "one tail"; GLM hunt cycle 1, probed 2026-09-16) and moves with
        // it; the block is already at the bottom, so nothing changes
        expect(moveFootnoteDefinitionsToBottom(input)).toBe(input);
    });
});
