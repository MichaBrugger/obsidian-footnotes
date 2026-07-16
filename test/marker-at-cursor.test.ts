import { describe, expect, it } from "vitest";

import { markerAtCursor } from "../src/insert-or-navigate-footnotes";

// The "inside a marker" rule shared by both navigation checks, aligned
// with the inline-footnote definition (issue #49): the caret counts as on
// a marker only strictly INSIDE its brackets. A caret immediately after
// the closing bracket — or immediately before the opening one — is
// outside, so the hotkey inserts a consecutive footnote there instead of
// jumping to the existing footnote's detail.

const markers = (line: string) =>
    [...line.matchAll(/\[\^([^[\]]+)\](?!:)/g)].map((m) => ({
        footnote: m[0],
        startIndex: m.index ?? 0,
    }));

describe("markerAtCursor", () => {
    //             012345678901234
    const LINE = "bravo[^1] rest"; // marker at 5-8

    it("finds the marker when the caret is inside the brackets", () => {
        expect(markerAtCursor(markers(LINE), 7)).toBe("[^1]");
    });

    it("finds the marker with the caret just inside the opening bracket", () => {
        expect(markerAtCursor(markers(LINE), 6)).toBe("[^1]");
    });

    it("finds the marker with the caret just before the closing bracket", () => {
        expect(markerAtCursor(markers(LINE), 8)).toBe("[^1]");
    });

    it("regression #49: caret right AFTER the closing bracket is outside", () => {
        expect(markerAtCursor(markers(LINE), 9)).toBeNull();
    });

    it("caret right before the opening bracket is outside", () => {
        expect(markerAtCursor(markers(LINE), 5)).toBeNull();
    });

    it("between two adjacent markers counts as outside of both", () => {
        //              0123456789
        const two = "a[^1][^2]b"; // markers at 1-4 and 5-8
        expect(markerAtCursor(markers(two), 5)).toBeNull();
    });

    it("picks the marker the caret is actually inside among several", () => {
        const two = "a[^1][^2]b";
        expect(markerAtCursor(markers(two), 3)).toBe("[^1]");
        expect(markerAtCursor(markers(two), 7)).toBe("[^2]");
    });

    it("returns null on a line with no markers", () => {
        expect(markerAtCursor(markers("plain text"), 3)).toBeNull();
    });
});
