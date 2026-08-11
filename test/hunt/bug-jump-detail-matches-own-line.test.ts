import { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { shouldJumpFromDefinitionToReference } from "../../src/navigation";

// BUG: jump-from-definition-to-reference matches the definition's own line. It scans
// `masked[i].indexOf("[^name]")` over ALL lines including the definition line
// itself; a definition line ("[^1]: definition") literally starts with "[^1]", so the
// first hit is the definition's own bracket. Consequences:
//  - when a definition sits ABOVE its reference (the layout buildDefinitionAppend
//    supports per #55), the hotkey lands on the definition instead of the
//    reference;
//  - an orphan definition (no reference anywhere) reports a bogus successful jump
//    onto itself instead of returning false.
// Note: AllReferences' own (?!:) lookahead would correctly exclude the definition
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

describe("bug: definition->reference jump matches the definition's own line", () => {
    it("does not jump to its own definition line when the definition sits above the reference", () => {
        const { doc, cursorMoves } = fakeEditor([
            "[^1]: definition",
            "text[^1] here",
        ]);
        shouldJumpFromDefinitionToReference(
            "[^1]: definition",
            { line: 0, ch: 3 },
            fakePlugin,
            doc,
        );
        // the real reference use is on line 1 (ch 8, just past "[^1]"); the
        // definition line is not a reference and must not be the target
        expect(cursorMoves).toEqual([{ line: 1, ch: 8 }]);
    });

    it("never jumps onto itself for an orphan definition with no reference", () => {
        // the bug's other symptom: a bogus "successful" jump onto the
        // definition's own line. Since the 2026-08-07 QOL sweep the orphan
        // press is HANDLED (true) with an explanatory notice — see
        // test/orphan-definition-press.test.ts — but it must still never move
        // the cursor anywhere, least of all onto its own line.
        const { doc, cursorMoves } = fakeEditor([
            "[^orphan]: text",
            "unrelated prose",
        ]);
        shouldJumpFromDefinitionToReference(
            "[^orphan]: text",
            { line: 0, ch: 3 },
            fakePlugin,
            doc,
        );
        expect(cursorMoves).toEqual([]);
    });
});
