import { describe, expect, it } from "vitest";

import { inlineFootnoteExitCh } from "../src/insert-or-navigate-footnotes";

// Second-press navigation for the inline-footnote hotkey: when the cursor
// is inside a ^[...] the command moves it just past the closing bracket
// instead of inserting another footnote. This function is the pure core:
// the exit position, or null when the cursor isn't inside an inline
// footnote (including unclosed ones — nothing to exit past).

describe("inlineFootnoteExitCh", () => {
    //             0123456789012345
    const LINE = "word^[note] more"; // ^=4 [=5 content 6-9 ]=10

    it("exits from inside the content to just past the closing bracket", () => {
        expect(inlineFootnoteExitCh(LINE, 8)).toBe(11);
    });

    it("exits from right after the opening bracket", () => {
        expect(inlineFootnoteExitCh(LINE, 6)).toBe(11);
    });

    it("exits from directly before the closing bracket", () => {
        expect(inlineFootnoteExitCh(LINE, 10)).toBe(11);
    });

    it("exits from between the caret and the bracket", () => {
        expect(inlineFootnoteExitCh(LINE, 5)).toBe(11);
    });

    it("does nothing when the cursor is already past the footnote", () => {
        expect(inlineFootnoteExitCh(LINE, 11)).toBeNull();
    });

    it("does nothing when the cursor is on or before the caret", () => {
        expect(inlineFootnoteExitCh(LINE, 4)).toBeNull();
        expect(inlineFootnoteExitCh(LINE, 0)).toBeNull();
    });

    it("exits an empty just-inserted footnote", () => {
        // "a^[]b": the first press leaves the cursor at ch 3, between [ and ]
        expect(inlineFootnoteExitCh("a^[]b", 3)).toBe(4);
    });

    it("matches the footnote the cursor is actually in", () => {
        //           0123456789012
        const two = "a^[x] b^[y] c";
        expect(inlineFootnoteExitCh(two, 3)).toBe(5);
        expect(inlineFootnoteExitCh(two, 9)).toBe(11);
        expect(inlineFootnoteExitCh(two, 6)).toBeNull();
    });

    it("steps over nested balanced brackets like markdown links", () => {
        //            0         1
        //            0123456789012345678
        const link = "x^[see [a](b) end]!";
        expect(inlineFootnoteExitCh(link, 5)).toBe(18);
    });

    it("ignores escaped brackets inside the content", () => {
        //           0123456789
        const esc = "a^[b \\] c] d"; // the \] at 5-6 doesn't close it
        expect(inlineFootnoteExitCh(esc, 4)).toBe(10);
    });

    it("does nothing inside an unclosed inline footnote", () => {
        expect(inlineFootnoteExitCh("a^[unclosed", 5)).toBeNull();
    });

    it("does not treat a [^1] reference marker as an inline footnote", () => {
        expect(inlineFootnoteExitCh("a[^1]b", 3)).toBeNull();
    });
});
