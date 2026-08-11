import { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { shouldJumpFromDefinitionToReference } from "../src/navigation";
import { tableRowCellSpans } from "../src/table-cursor";
import { removeOrphanedFootnoteReferences } from "../src/linting/rules/remove-orphaned-references";

// Promoted from a parallel review's scratch probes (2026-08-10).

function fakeEditor(lines: string[]) {
    const cursorMoves: EditorPosition[] = [];
    const doc = {
        getLine: (n: number) => lines[n] ?? "",
        getValue: () => lines.join("\n"),
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

describe("navigation twin — blockquoted duplicate label as phantom jump target", () => {
    it("caret on a column-0 definition whose only twin is a blockquoted duplicate label: should report, not jump", () => {
        // No references anywhere; two definitions of "1", one blockquoted.
        // Mirrors the pinned lone-callout case ("reports instead of jumping
        // to itself") — a definition label is not a reference.
        const lines = ["[^1]: first", "> [^1]: second"];
        const { doc, cursorMoves } = fakeEditor(lines);
        shouldJumpFromDefinitionToReference(lines[0], { line: 0, ch: 2 }, fakePlugin, doc);
        expect(cursorMoves).toEqual([]);
    });

    it("control: column-0 duplicates correctly report (labels excluded at column 0)", () => {
        const lines = ["[^1]: first", "[^1]: second"];
        const { doc, cursorMoves } = fakeEditor(lines);
        shouldJumpFromDefinitionToReference(lines[0], { line: 0, ch: 2 }, fakePlugin, doc);
        expect(cursorMoves).toEqual([]);
    });
});

describe("tableRowCellSpans escape edges", () => {
    it("escaped pipe at cell edges and multiple escapes", () => {
        expect(tableRowCellSpans("| \\| |")).toEqual([{ from: 1, to: 5 }]);
        expect(tableRowCellSpans("| \\| \\| |")).toEqual([{ from: 1, to: 8 }]);
        expect(tableRowCellSpans("| a\\| | b |")).toEqual([
            { from: 1, to: 6 },
            { from: 7, to: 10 },
        ]);
    });

    it("escaped backslash before a pipe still splits", () => {
        // "a \\| b": the pipe after an escaped backslash is a delimiter
        const spans = tableRowCellSpans("| a \\\\| b |");
        expect(spans.length).toBe(2);
    });

    it("no unescaped pipe is not a row", () => {
        expect(tableRowCellSpans("a \\| b")).toEqual([]);
    });
});

describe("orphan-reference deletion — harder negative cases", () => {
    it("a reference whose definition sits inside a single-line HTML comment is an orphan (commented-out defs are inert)", () => {
        // "<!-- [^1]: old -->" is commented out; the live [^1] reference IS an orphan.
        const doc = "live[^1] here\n\n<!-- [^1]: old -->";
        expect(removeOrphanedFootnoteReferences(doc)).toBe("live here\n\n<!-- [^1]: old -->");
    });

    it("deleting an orphan reference from a table row keeps the row intact", () => {
        const doc = "| a[^9] | b |\n| --- | --- |\n| c[^1] | d |\n\n[^1]: one";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(
            "| a | b |\n| --- | --- |\n| c[^1] | d |\n\n[^1]: one",
        );
    });

    it("an orphan reference inside a blockquote is deleted, its blockquoted definition's label is not", () => {
        const doc = "> see[^9]\n> [^1]: def";
        expect(removeOrphanedFootnoteReferences(doc)).toBe("> see\n> [^1]: def");
    });
});
