import { describe, expect, it } from "vitest";

import { endOfWordOffset } from "../../src/insert-or-navigate-footnotes";

// BUG: the "insert footnote at end of word" setting is described (settings.ts)
// as placing the marker after trailing punctuation, and the lint transform's
// punctuation class is .,;:!?. But endOfWordOffset only skips past ". , : ;" —
// not "!" or "?". So inserting at "Hello!" yields "Hello[^1]!", which the
// "footnote after punctuation" lint then reorders to "Hello![^1]": the two
// features disagree on what counts as punctuation and fight each other.
// (This is a distinct root cause from the unicode-grapheme endOfWordOffset bug
// already pinned in bug-end-of-word-offset-unicode.test.ts — that one is about
// \w not matching accents; this one is about the trailing-punctuation set.)
// Scenario: end-of-word insertion leaves the marker before a trailing "!" or "?".
// pinned 2026-07-17, hunt-bugs consolidation.
// Provenance: iteration-1/eval-1/without_skill/run-1 (bug sweep, BUG 3).

describe("bug: end-of-word insertion skips . , : ; but not ! ?", () => {
    it("skips past a terminal exclamation mark", () => {
        expect(endOfWordOffset("Hello!", 2)).toBe(6);
    });

    it("skips past a terminal question mark", () => {
        expect(endOfWordOffset("Really?", 2)).toBe(7);
    });
});
