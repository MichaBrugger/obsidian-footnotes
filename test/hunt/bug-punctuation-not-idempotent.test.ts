import { describe, expect, it } from "vitest";

import { footnoteAfterPunctuation } from "../../src/linting/rules/footnote-after-punctuation";

// BUG: footnoteAfterPunctuation is not idempotent on an interleaved
// marker-punctuation-marker-punctuation chain. On "word[^1].[^2],", the first
// pass swaps each marker with its adjacent punctuation → "word.[^1],[^2]" (which
// reads correctly). But [^1] is now immediately followed by the comma that
// belongs to [^2], so the regex — which has no notion of ownership — swaps
// again on the next run → "word.,[^1][^2]", drifting the punctuation away from
// its text. The transform holds an idempotence contract elsewhere
// (test/footnote-after-punctuation.test.ts); running the cleanup command twice
// must not keep changing the document.
// Hunt: 2026-07-17. Lens: properties. Severity: wrong-output.

describe("bug: footnoteAfterPunctuation not idempotent on a punctuation chain", () => {
    const doc = "word[^1].[^2],\n\n[^1]: one\n[^2]: two";

    it("f(f(doc)) === f(doc) on an interleaved marker/punct chain", () => {
        const once = footnoteAfterPunctuation(doc);
        expect(footnoteAfterPunctuation(once)).toBe(once);
    });
});
