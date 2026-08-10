import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";
import { applyFootnotePrefix } from "../../src/linting/rules/apply-footnote-prefix";

// Scenario: a case-variant prefixed footnote ([^P.1] under prefix "p.") doesn't
// reserve its number, so the next autonumber / applyFootnotePrefix rename mints
// an id that already exists case-folded — silently merging two footnotes.
// Hunt: 2026-08-09. Lens: grammar.
// Root cause: computeNextFootnoteNumber's dynamic prefix regex
// (src/insert-or-navigate-footnotes.ts:683) lacks the /i flag, though Obsidian
// footnote ids are case-insensitive (pinned premise:
// test/hunt/bug-case-insensitive-footnote-ids.test.ts).

describe("bug: prefix-namespace number scanning is case-sensitive while ids are not", () => {
    it.fails("a case-variant prefixed marker reserves its number", () => {
        // [^P.1] IS footnote "p.1" (Obsidian folds ids) — the next number
        // under prefix "p." must be 2, not a colliding 1
        expect(computeNextFootnoteNumber("text[^P.1]", "p.")).toBe(2);
    });

    it.fails("reservation works in both casing directions", () => {
        expect(computeNextFootnoteNumber("text[^p.3]", "P.")).toBe(4);
    });

    it.fails("counts a prefixed DETAIL whose casing differs", () => {
        // "[^CH-7]:" IS namespace "ch-" in Obsidian's eyes
        expect(computeNextFootnoteNumber("[^CH-7]: orphan", "ch-")).toBe(8);
    });

    it.fails("applyFootnotePrefix never renames a plain footnote onto an existing case-variant id", () => {
        const input = "a[^1] b[^P.1]\n\n[^1]: one\n[^P.1]: pone";
        // "1" must become "p.2": "p.1" is already taken by [^P.1] folded
        expect(applyFootnotePrefix(input, "p.")).toBe(
            "a[^p.2] b[^P.1]\n\n[^p.2]: one\n[^P.1]: pone",
        );
    });

    it.fails("applyFootnotePrefix folds the other casing direction too", () => {
        // [^1] must slot at 2 because [^ch-1] already occupies "ch-1" folded
        const input = "a[^1] b[^ch-1] end\n\n[^1]: one\n[^ch-1]: pre";
        expect(applyFootnotePrefix(input, "Ch-")).toBe(
            "a[^Ch-2] b[^ch-1] end\n\n[^Ch-2]: one\n[^ch-1]: pre",
        );
    });
});
