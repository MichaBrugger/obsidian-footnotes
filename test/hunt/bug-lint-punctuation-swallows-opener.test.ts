// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 4 of 6 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { footnoteAfterPunctuation } from "../../src/linting/rules/footnote-after-punctuation";

// A user lints "see the note[^1]*important* today" and gets back
// "see the note*[^1]important* today": the reference moved INTO an emphasis
// it never belonged to. Worse, in their note the emphasis itself is now
// destroyed - after the swap the opener no longer parses as emphasis
// (CommonMark left-flanking: the "*" now sits between a letter and a "[",
// which is not a flanking position), so "*[^1]important*" renders with the
// asterisks as literal text. Same for "**bold**", ==highlights==, and
// "quotes".
//
// The rule's stated convention (Chicago, adopted 2026-09-09 and pinned in
// bug-reference-before-closing-delimiter) moves a note on the last word of
// a phrase OUTSIDE the phrase's closing marks. It sanctions moving OUT of
// a phrase the reference terminates; it never sanctions moving INTO one
// the reference stands in front of. The culprit is referenceLandingAfter,
// which walks past every character in ClosingMarkChars without checking
// whether the mark CLOSES something before the reference or OPENS
// something after it.

describe("footnote-after-punctuation never moves a reference into a phrase it stands before", () => {
    it.fails("a reference before an emphasis OPENER stays put", () => {
        const doc = "see the note[^1]*important* today\n\n[^1]: x";
        expect(footnoteAfterPunctuation(doc)).toBe(doc);
    });

    it.fails("a reference before a strong-emphasis OPENER stays put", () => {
        const doc = "see the note[^1]**important** today\n\n[^1]: x";
        expect(footnoteAfterPunctuation(doc)).toBe(doc);
    });

    it.fails("a reference before a highlight OPENER stays put", () => {
        const doc = "see the note[^1]==marked== today\n\n[^1]: x";
        expect(footnoteAfterPunctuation(doc)).toBe(doc);
    });

    it.fails("a reference before a quote OPENER stays put", () => {
        const doc = 'see the note[^1]"quoted" today\n\n[^1]: x';
        expect(footnoteAfterPunctuation(doc)).toBe(doc);
    });

    it("control: a reference inside an emphasized phrase still lands outside it", () => {
        expect(footnoteAfterPunctuation("see **the note[^1]** today")).toBe(
            "see **the note**[^1] today",
        );
    });

    it("control: punctuation alone still swaps", () => {
        expect(footnoteAfterPunctuation("word[^1].")).toBe("word.[^1]");
    });
});
