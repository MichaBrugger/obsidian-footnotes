import { describe, expect, it } from "vitest";

import { markerAtCursor } from "../../src/insert-or-navigate-footnotes";

// Offset-lens probes for markerAtCursor: marker at line start, huge ch,
// unicode names, and adjacent-marker boundaries.

const markers = (line: string) =>
    [...line.matchAll(/\[\^([^[\]]+)\](?!:)/g)].map((m) => ({
        footnote: m[0],
        startIndex: m.index ?? 0,
    }));

describe("markerAtCursor probes", () => {
    it("marker at the very start of the line: ch 1 is inside", () => {
        expect(markerAtCursor(markers("[^1] x"), 1)).toBe("[^1]");
    });

    it("marker at the very start of the line: ch 0 is outside", () => {
        expect(markerAtCursor(markers("[^1] x"), 0)).toBeNull();
    });

    it("ch far beyond the line length returns null", () => {
        expect(markerAtCursor(markers("a[^1]"), 999)).toBeNull();
    });

    it("emoji name: UTF-16 offsets stay consistent", () => {
        // a [ ^ 😀 ] b — marker spans 1-5 (emoji is two code units)
        const line = "a[^\u{1F600}]b";
        expect(markerAtCursor(markers(line), 4)).toBe("[^\u{1F600}]");
        // just after the closing bracket (6) is outside
        expect(markerAtCursor(markers(line), 6)).toBeNull();
    });

    it("marker ending exactly at end of line: last inside position", () => {
        //          0123456
        const line = "ab[^1]";
        expect(markerAtCursor(markers(line), 5)).toBe("[^1]");
        expect(markerAtCursor(markers(line), 6)).toBeNull();
    });

    it("combining-mark name does not shift neighboring offsets", () => {
        // [^é] with decomposed é: [ ^ e ́ ]  → marker spans 0-4
        const line = "[^é] x";
        expect(markerAtCursor(markers(line), 4)).toBe("[^é]");
        expect(markerAtCursor(markers(line), 5)).toBeNull();
    });
});
