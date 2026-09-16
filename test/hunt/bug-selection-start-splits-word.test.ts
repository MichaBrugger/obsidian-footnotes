// Imported from the Kimi K3 cycle 5 hunt of 2026-09-16 (OpenCode worktree); 3 of 6 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { describe, expect, it } from "vitest";

import { endOfWordOffset, startOfWordOffset } from "../../src/editor/cursor-motion";

// The plugin's own word model, used by the end-of-word walk every insert
// takes: an apostrophe (straight or curly) or a dot between two word
// characters belongs to the word, so "don't", "U.S.", and "example.com"
// are ONE word (wordEndOffset in cursor-motion.ts; Jason's landing
// rulings 2026-09-15). The README promises the selection twin: "A
// selection that starts or ends mid-word grows to whole words first."
//
// startOfWordOffset never learned that rule. It walks back over word
// characters only, so a selection that starts right after the apostrophe
// or the dot - the middle of the word by the plugin's own model - does
// not grow back across it. The end walk crosses the same mark going
// forward, so the two ends of one selection disagree about what the word
// even is.
//
// What the user sees: they drag-select from just after the apostrophe in
// "don't" (or the dot in "example.com") and press a footnote key: the
// footnote's body holds only "t" (or "com"), and "don'" (or "example.")
// stays in the sentence - the word is split in two, exactly what the
// whole-word expansion exists to prevent.
//
// Source of truth: README.md ("grows to whole words first") + the
// plugin's own wordEndOffset, which crosses these marks: one word model,
// two walks, they must agree.
//
// Settings involved: `Expand selections to whole words` ON (the default).

describe("startOfWordOffset crosses an apostrophe or dot between word characters", () => {
    it("a selection starting after the apostrophe in \"don't\" grows to the word's start", () => {
        expect(startOfWordOffset("don't", 4)).toBe(0);
    });

    it("a selection starting after the dot in \"example.com\" grows to the word's start", () => {
        expect(startOfWordOffset("example.com", 8)).toBe(0);
    });

    // OPEN 2026-09-16: offset 3 is the word's TRAILING dot (nothing but a
    // space after it), which the word model does not count as part of the
    // word; the end walk reaches it only through the landing convention
    // (punctuation after the word). Whether a selection that starts at a
    // trailing dot should grow back over the word is a ruling for Jason.
    it.fails("a selection starting after the dot in \"U.S.\" grows to the word's start", () => {
        expect(startOfWordOffset("U.S. Senate", 3)).toBe(0);
    });

    it("control: the end walk crosses the same marks (the word model the start must match)", () => {
        expect(endOfWordOffset("don't", 4)).toBe(5);
        expect(endOfWordOffset("example.com", 7)).toBe(11);
        expect(endOfWordOffset("U.S. Senate", 2)).toBe(4);
    });

    it("control: a selection starting mid-word with no mark walks back fine", () => {
        expect(startOfWordOffset("hello", 3)).toBe(0);
        expect(startOfWordOffset("hello world", 8)).toBe(6);
    });

    it("control: a selection starting at a word's first character stays", () => {
        expect(startOfWordOffset("don't", 0)).toBe(0);
        expect(startOfWordOffset("hello world", 6)).toBe(6);
    });
});
