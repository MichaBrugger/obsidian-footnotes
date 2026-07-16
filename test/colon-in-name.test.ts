import { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import {
    listExistingFootnoteDetails,
    shouldJumpFromDetailToMarker,
    shouldJumpFromMarkerToDetail,
} from "../src/insert-or-navigate-footnotes";

// Issue #50: jumping between the marker and detail of a named footnote
// whose name contains ":" (e.g. [^arXiv:1234.5678]) used to fail — the
// plugin created a new footnote instead. The fixture below is the exact
// document from the report.

const REPORT = [
    "# Test",
    "",
    "- Normal named footnote: [^named-footnote.1]",
    "- Named footnote with `:`: [^arXiv:1234.5678]",
    "",
    "[^named-footnote.1]: Content 1",
    "[^arXiv:1234.5678]: Content 2",
];

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

describe("footnote names containing ':' (issue #50)", () => {
    it("the detail listing includes the colon name", () => {
        const { doc } = fakeEditor(REPORT);
        expect(listExistingFootnoteDetails(doc)).toEqual([
            "named-footnote.1",
            "arXiv:1234.5678",
        ]);
    });

    it("jumps from the colon marker to its detail", () => {
        const { doc, cursorMoves } = fakeEditor(REPORT);
        const line = REPORT[3];
        const ch = line.indexOf("[^arXiv") + 4; // caret inside the marker
        const handled = shouldJumpFromMarkerToDetail(
            line,
            { line: 3, ch },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(true);
        // lands at the end of "[^arXiv:1234.5678]: Content 2"
        expect(cursorMoves).toEqual([{ line: 6, ch: REPORT[6].length }]);
    });

    it("jumps from the colon detail back to the marker", () => {
        const { doc, cursorMoves } = fakeEditor(REPORT);
        const handled = shouldJumpFromDetailToMarker(
            REPORT[6],
            { line: 6, ch: 5 },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(true);
        const markerStart = REPORT[3].indexOf("[^arXiv");
        expect(cursorMoves).toEqual([
            { line: 3, ch: markerStart + "[^arXiv:1234.5678]".length },
        ]);
    });
});
