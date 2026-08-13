import { describe, expect, it } from "vitest";

import { referenceAtCursor } from "../src/parsing/footnote-grammar";

// The "inside a reference" rule shared by both navigation checks, aligned
// with the inline-footnote definition (issue #49): the caret counts as on
// a reference only strictly INSIDE its brackets. A caret immediately after
// the closing bracket — or immediately before the opening one — is
// outside, so the hotkey inserts a consecutive footnote there instead of
// jumping to the existing footnote's definition.

const references = (line: string) =>
    [...line.matchAll(/\[\^([^[\]]+)\](?!:)/g)].map((m) => ({
        footnote: m[0],
        startIndex: m.index ?? 0,
    }));

describe("referenceAtCursor", () => {
    //             012345678901234
    const LINE = "bravo[^1] rest"; // reference at 5-8

    it("finds the reference when the caret is inside the brackets", () => {
        expect(referenceAtCursor(references(LINE), 7)).toBe("[^1]");
    });

    it("finds the reference with the caret just inside the opening bracket", () => {
        expect(referenceAtCursor(references(LINE), 6)).toBe("[^1]");
    });

    it("finds the reference with the caret just before the closing bracket", () => {
        expect(referenceAtCursor(references(LINE), 8)).toBe("[^1]");
    });

    it("regression #49: caret right AFTER the closing bracket is outside", () => {
        expect(referenceAtCursor(references(LINE), 9)).toBeNull();
    });

    it("caret right before the opening bracket is outside", () => {
        expect(referenceAtCursor(references(LINE), 5)).toBeNull();
    });

    it("between two adjacent references counts as outside of both", () => {
        //              0123456789
        const two = "a[^1][^2]b"; // references at 1-4 and 5-8
        expect(referenceAtCursor(references(two), 5)).toBeNull();
    });

    it("picks the reference the caret is actually inside among several", () => {
        const two = "a[^1][^2]b";
        expect(referenceAtCursor(references(two), 3)).toBe("[^1]");
        expect(referenceAtCursor(references(two), 7)).toBe("[^2]");
    });

    it("returns null on a line with no references", () => {
        expect(referenceAtCursor(references("plain text"), 3)).toBeNull();
    });
});
