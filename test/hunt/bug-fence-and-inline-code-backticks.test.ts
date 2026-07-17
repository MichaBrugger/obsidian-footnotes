import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";

// BUG: backtick handling in the protected-region scanner ignores CommonMark
// fine print, and the mistakes swallow real markers.
// (a) A line like "```[^7]``` inline" is NOT a fence opener — a backtick fence
//     info string may not contain backticks, so this is a paragraph with an
//     inline code span. protectedLines opens a fence anyway; with no bare
//     closing fence it runs unclosed to EOF and nulls out the rest of the
//     document, hiding the real real[^2] marker.
// (b) Escaped backticks "\`" are literal per CommonMark and cannot open a code
//     span, but maskInlineCode pairs them as a phantom span and masks the
//     [^3] between them (unlike inlineFootnoteExitCh / sanitizeInlineFootnoteContent
//     elsewhere, which are escape-aware).
// Hunt: 2026-07-17. Lens: contexts. Severity: wrong-output.

describe("bug: backtick fine print swallows real markers", () => {
    it.fails(
        "a backtick line whose info string contains backticks is inline code, not a fence",
        () => {
            expect(
                computeNextFootnoteNumber("```[^7]``` inline\nreal[^2]"),
            ).toBe(3);
        },
    );

    it.fails("escaped backticks do not open an inline code span", () => {
        expect(computeNextFootnoteNumber("a \\` b [^3] c \\` d")).toBe(4);
    });
});
