import { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { shouldJumpFromDetailToMarker } from "../src/insert-or-navigate-footnotes";

// Bug (reported 2026-07-17, manual testing): jumping TO a multi-line detail
// lands the caret on the LAST continuation line by design, but jumping BACK
// only recognized the "[^x]:" line itself, so the hotkey on a continuation
// line fell through the cascade and inserted a brand-new footnote.

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

const NOTE = [
    "jump from me[^multiline] here",
    "",
    "[^multiline]: this detail has continuation lines",
    "    the caret should land at the end",
    "    of this very last line",
];

describe("jumping back from a multi-line detail", () => {
    it("works from the definition's own line (existing behavior)", () => {
        const { doc, cursorMoves } = fakeEditor(NOTE);
        const handled = shouldJumpFromDetailToMarker(
            NOTE[2],
            { line: 2, ch: 5 },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(true);
        expect(cursorMoves).toEqual([{ line: 0, ch: 12 + "[^multiline]".length }]);
    });

    it("works from a continuation line (where jump-to-detail parks the caret)", () => {
        const { doc, cursorMoves } = fakeEditor(NOTE);
        const handled = shouldJumpFromDetailToMarker(
            NOTE[4],
            { line: 4, ch: NOTE[4].length },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(true);
        expect(cursorMoves).toEqual([{ line: 0, ch: 12 + "[^multiline]".length }]);
    });

    it("works from a blank-separated second paragraph of the detail", () => {
        const lines = [
            "marker[^m] up here",
            "",
            "[^m]: first paragraph",
            "",
            "    second paragraph, still the same footnote",
        ];
        const { doc, cursorMoves } = fakeEditor(lines);
        const handled = shouldJumpFromDetailToMarker(
            lines[4],
            { line: 4, ch: 10 },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(true);
        expect(cursorMoves).toEqual([{ line: 0, ch: 6 + "[^m]".length }]);
    });

    it("an indented line that belongs to no definition still falls through", () => {
        const lines = ["- list", "    indented item", "", "[^x]: detail"];
        const { doc } = fakeEditor(lines);
        const handled = shouldJumpFromDetailToMarker(
            lines[1],
            { line: 1, ch: 6 },
            doc,
            fakePlugin,
        );
        expect(handled).toBeFalsy();
    });

    it("a continuation line inside a fence is not a detail", () => {
        const lines = ["```", "[^f]: fake", "    fake continuation", "```"];
        const { doc } = fakeEditor(lines);
        const handled = shouldJumpFromDetailToMarker(
            lines[2],
            { line: 2, ch: 6 },
            doc,
            fakePlugin,
        );
        expect(handled).toBeFalsy();
    });
});
