import { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { shouldJumpFromDetailToMarker } from "../../src/insert-or-navigate-footnotes";

// BUG: jump-from-detail-to-marker matches the definition's own line. It scans
// `masked[i].indexOf("[^name]")` over ALL lines including the detail line
// itself; a detail line ("[^1]: detail") literally starts with "[^1]", so the
// first hit is the definition's own bracket. Consequences:
//  - when a definition sits ABOVE its marker (the layout buildDetailAppend
//    supports per #55), the hotkey lands on the definition instead of the
//    marker;
//  - an orphan detail (no marker anywhere) reports a bogus successful jump
//    onto itself instead of returning false.
// Note: AllMarkers' own (?!:) lookahead would correctly exclude the detail
// line, but indexOf doesn't use it.
// Hunt: 2026-07-17. Lens: contexts / regressions. Severity: wrong-output.

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

describe("bug: detail->marker jump matches the definition's own line", () => {
    it("does not jump to its own detail line when the definition sits above the marker", () => {
        const { doc, cursorMoves } = fakeEditor([
            "[^1]: detail",
            "text[^1] here",
        ]);
        shouldJumpFromDetailToMarker(
            "[^1]: detail",
            { line: 0, ch: 3 },
            doc,
            fakePlugin,
        );
        // the real marker use is on line 1 (ch 8, just past "[^1]"); the
        // detail line is not a marker and must not be the target
        expect(cursorMoves).toEqual([{ line: 1, ch: 8 }]);
    });

    it("returns false for an orphan detail with no marker to jump to", () => {
        const { doc } = fakeEditor(["[^orphan]: text", "unrelated prose"]);
        const handled = shouldJumpFromDetailToMarker(
            "[^orphan]: text",
            { line: 0, ch: 3 },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(false);
    });
});
