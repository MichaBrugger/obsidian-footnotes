import { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { listExistingFootnoteDefinitions, listExistingFootnoteReferencesAndLocations, shouldJumpFromDefinitionToReference, shouldJumpFromReferenceToDefinition } from "../src/insert-or-navigate-footnotes";
import { computeNextFootnoteNumber } from "../src/footnote-grammar";

// Issue #41: [^x]-shaped text inside code — fenced blocks, inline code, or
// frontmatter — must be invisible to every scan the insert/navigate
// commands make. Before the fix, a code sample containing "[^7]" skewed
// autonumbering, suppressed the section heading (a fenced "[^x]:" counted
// as an existing definition), and hijacked the hotkey on that line.

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
    it("skips numbered references inside fenced code blocks", () => {
        expect(
            computeNextFootnoteNumber("real[^1]\n```\nfake[^7]\n```"),
        ).toBe(2);
    });

    it("skips numbered references inside inline code", () => {
        expect(computeNextFootnoteNumber("real[^1] and `[^7]`")).toBe(2);
    });

    it("skips numbered definitions inside fenced code blocks", () => {
        expect(computeNextFootnoteNumber("```\n[^7]: fake\n```")).toBe(1);
    });

    it("skips frontmatter", () => {
        expect(
            computeNextFootnoteNumber("---\nkey: [^9]\n---\nreal[^1]"),
        ).toBe(2);
    });
});

describe("listExistingFootnoteDefinitions ignores code", () => {
    it("does not count a definition-shaped line inside a fence", () => {
        const { doc } = fakeEditor(["```", "[^1]: fake", "```", "[^2]: real"]);
        expect(listExistingFootnoteDefinitions(doc)).toEqual(["2"]);
    });
});

describe("listExistingFootnoteReferencesAndLocations ignores code", () => {
    it("skips references inside inline code but keeps real ones placed after", () => {
        const { doc } = fakeEditor(["use `[^1]` then real[^2]"]);
        expect(listExistingFootnoteReferencesAndLocations(doc)).toEqual([
            { footnote: "[^2]", lineNum: 0, startIndex: 20 },
        ]);
    });

    it("skips references inside fenced code blocks", () => {
        const { doc } = fakeEditor(["```", "x[^1]", "```", "y[^2]"]);
        expect(listExistingFootnoteReferencesAndLocations(doc)).toEqual([
            { footnote: "[^2]", lineNum: 3, startIndex: 1 },
        ]);
    });
});

describe("shouldJumpFromReferenceToDefinition ignores code", () => {
    it("does not navigate from a reference inside a fenced code block", () => {
        const { doc } = fakeEditor(["```", "fake[^1]", "```", "[^1]: real"]);
        // caret inside the fenced "[^1]" — plain text, so the press must
        // fall through to insertion instead of navigating
        const handled = shouldJumpFromReferenceToDefinition(
            "fake[^1]",
            { line: 1, ch: 6 },
            fakePlugin,
            doc,
        );
        expect(handled).toBeFalsy();
    });

    it("does not navigate from a reference inside inline code", () => {
        const { doc } = fakeEditor(["see `x[^1]` here", "", "[^1]: real"]);
        const handled = shouldJumpFromReferenceToDefinition(
            "see `x[^1]` here",
            { line: 0, ch: 8 },
            fakePlugin,
            doc,
        );
        expect(handled).toBeFalsy();
    });

    it("still navigates from a real reference on a line that also has code", () => {
        const { doc, cursorMoves } = fakeEditor([
            "`[^1]` real[^1]",
            "",
            "[^1]: definition",
        ]);
        const handled = shouldJumpFromReferenceToDefinition(
            "`[^1]` real[^1]",
            { line: 0, ch: 13 },
            fakePlugin,
            doc,
        );
        expect(handled).toBe(true);
        expect(cursorMoves).toEqual([{ line: 2, ch: "[^1]: definition".length }]);
    });
});

describe("shouldJumpFromDefinitionToReference ignores code", () => {
    it("a definition-shaped line inside a fence is not a definition", () => {
        const { doc } = fakeEditor(["```", "[^1]: fake", "```", "real[^1]"]);
        const handled = shouldJumpFromDefinitionToReference(
            "[^1]: fake",
            { line: 1, ch: 3 },
            fakePlugin,
            doc,
        );
        expect(handled).toBeFalsy();
    });

    it("the jump-target search skips references inside code", () => {
        const { doc, cursorMoves } = fakeEditor([
            "```",
            "x[^1]",
            "```",
            "real[^1]",
            "[^1]: definition",
        ]);
        const handled = shouldJumpFromDefinitionToReference(
            "[^1]: definition",
            { line: 4, ch: 3 },
            fakePlugin,
            doc,
        );
        expect(handled).toBe(true);
        // the first REAL occurrence is on line 3 — not the fenced line 1
        expect(cursorMoves).toEqual([{ line: 3, ch: 8 }]);
    });
});

// A fence lives in the CONTAINER that opened it (fixed 2026-08-10): a
// blockquoted delimiter is content to a document-level fence, a blockquoted
// fence dies when its quote ends, and a bare delimiter after that opens a
// NEW fence. List-item fences ("- ```") are still a known gap, deferred to
// the container-model spec decision (test/hunt/bug-list-item-fence).
describe("fence delimiters respect their container", () => {
    it("a blockquoted delimiter is content to a document-level fence", () => {
        expect(computeNextFootnoteNumber("```\ncode\n> ```\nstill code[^9]")).toBe(1);
    });

    it("a blockquoted fence ends when its quote ends", () => {
        expect(computeNextFootnoteNumber("> ```\n> code[^9]\nlive[^7]")).toBe(8);
    });

    it("a blank line ends the quote — and its fence", () => {
        expect(computeNextFootnoteNumber("> ```\n> code[^9]\n\nlive[^7]")).toBe(8);
    });

    it("a bare delimiter after an ended blockquoted fence opens a new fence", () => {
        expect(
            computeNextFootnoteNumber("> ```\n> code[^9]\n```\nnow code[^7]"),
        ).toBe(1);
    });

    it("a nested-deeper delimiter does not close a blockquoted fence", () => {
        expect(
            computeNextFootnoteNumber("> ```\n> > code[^9]\n> ```\n> live[^7]"),
        ).toBe(8);
    });
});
