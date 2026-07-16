import { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import {
    computeNextFootnoteNumber,
    listExistingFootnoteDetails,
    listExistingFootnoteMarkersAndLocations,
    shouldJumpFromDetailToMarker,
    shouldJumpFromMarkerToDetail,
} from "../src/insert-or-navigate-footnotes";

// Issue #41: [^x]-shaped text inside code — fenced blocks, inline code, or
// frontmatter — must be invisible to every scan the insert/navigate
// commands make. Before the fix, a code sample containing "[^7]" skewed
// autonumbering, suppressed the section heading (a fenced "[^x]:" counted
// as an existing detail), and hijacked the hotkey on that line.

function fakeEditor(lines: string[]) {
    const cursorMoves: EditorPosition[] = [];
    const doc = {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
        setCursor: (pos: EditorPosition) => cursorMoves.push(pos),
        scrollIntoView: () => {},
    } as unknown as Editor;
    return { doc, cursorMoves };
}

const fakePlugin = {
    settings: { enablePopupEditor: false },
    app: { vault: {} },
} as unknown as FootnotePlugin;

describe("computeNextFootnoteNumber ignores code", () => {
    it("skips numbered markers inside fenced code blocks", () => {
        expect(
            computeNextFootnoteNumber("real[^1]\n```\nfake[^7]\n```"),
        ).toBe(2);
    });

    it("skips numbered markers inside inline code", () => {
        expect(computeNextFootnoteNumber("real[^1] and `[^7]`")).toBe(2);
    });

    it("skips numbered details inside fenced code blocks", () => {
        expect(computeNextFootnoteNumber("```\n[^7]: fake\n```")).toBe(1);
    });

    it("skips frontmatter", () => {
        expect(
            computeNextFootnoteNumber("---\nkey: [^9]\n---\nreal[^1]"),
        ).toBe(2);
    });
});

describe("listExistingFootnoteDetails ignores code", () => {
    it("does not count a detail-shaped line inside a fence", () => {
        const { doc } = fakeEditor(["```", "[^1]: fake", "```", "[^2]: real"]);
        expect(listExistingFootnoteDetails(doc)).toEqual(["2"]);
    });
});

describe("listExistingFootnoteMarkersAndLocations ignores code", () => {
    it("skips markers inside inline code but keeps real ones placed after", () => {
        const { doc } = fakeEditor(["use `[^1]` then real[^2]"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^2]", lineNum: 0, startIndex: 20 },
        ]);
    });

    it("skips markers inside fenced code blocks", () => {
        const { doc } = fakeEditor(["```", "x[^1]", "```", "y[^2]"]);
        expect(listExistingFootnoteMarkersAndLocations(doc)).toEqual([
            { footnote: "[^2]", lineNum: 3, startIndex: 1 },
        ]);
    });
});

describe("shouldJumpFromMarkerToDetail ignores code", () => {
    it("does not navigate from a marker inside a fenced code block", () => {
        const { doc } = fakeEditor(["```", "fake[^1]", "```", "[^1]: real"]);
        // caret inside the fenced "[^1]" — plain text, so the press must
        // fall through to insertion instead of navigating
        const handled = shouldJumpFromMarkerToDetail(
            "fake[^1]",
            { line: 1, ch: 6 },
            doc,
            fakePlugin,
        );
        expect(handled).toBeFalsy();
    });

    it("does not navigate from a marker inside inline code", () => {
        const { doc } = fakeEditor(["see `x[^1]` here", "", "[^1]: real"]);
        const handled = shouldJumpFromMarkerToDetail(
            "see `x[^1]` here",
            { line: 0, ch: 8 },
            doc,
            fakePlugin,
        );
        expect(handled).toBeFalsy();
    });

    it("still navigates from a real marker on a line that also has code", () => {
        const { doc, cursorMoves } = fakeEditor([
            "`[^1]` real[^1]",
            "",
            "[^1]: detail",
        ]);
        const handled = shouldJumpFromMarkerToDetail(
            "`[^1]` real[^1]",
            { line: 0, ch: 13 },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(true);
        expect(cursorMoves).toEqual([{ line: 2, ch: 12 }]);
    });
});

describe("shouldJumpFromDetailToMarker ignores code", () => {
    it("a detail-shaped line inside a fence is not a detail", () => {
        const { doc } = fakeEditor(["```", "[^1]: fake", "```", "real[^1]"]);
        const handled = shouldJumpFromDetailToMarker(
            "[^1]: fake",
            { line: 1, ch: 3 },
            doc,
            fakePlugin,
        );
        expect(handled).toBeFalsy();
    });

    it("the jump-target search skips markers inside code", () => {
        const { doc, cursorMoves } = fakeEditor([
            "```",
            "x[^1]",
            "```",
            "real[^1]",
            "[^1]: detail",
        ]);
        const handled = shouldJumpFromDetailToMarker(
            "[^1]: detail",
            { line: 4, ch: 3 },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(true);
        // the first REAL occurrence is on line 3 — not the fenced line 1
        expect(cursorMoves).toEqual([{ line: 3, ch: 8 }]);
    });
});
