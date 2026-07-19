import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { buildDetailAppend } from "../src/insert-or-navigate-footnotes";

// Where a new footnote detail lands. Issue #55: when definitions already
// exist, the new detail belongs right after the LAST existing definition
// block — not at the end of the file, where it strands the footnotes away
// from the section (e.g. "#### Citations") the user keeps them under.
// Only the very first footnote starts a new section at the end of the note.

function fakeEditor(lines: string[]): Editor {
    return {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
    } as unknown as Editor;
}

function fakePlugin(overrides: Record<string, unknown> = {}): FootnotePlugin {
    return {
        settings: {
            enableRemoveBlankLastLines: true,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "# Footnotes",
            ...overrides,
        },
    } as unknown as FootnotePlugin;
}

describe("buildDetailAppend", () => {
    it("starts the first footnote's section at the end of the note", () => {
        const doc = fakeEditor(["Alpha"]);
        const { change, cursor } = buildDetailAppend(doc, "1", true, fakePlugin());
        expect(change).toEqual({
            from: { line: 0, ch: 5 },
            // with trimming enabled, `to` always spans to the note's end —
            // a no-op range here since there is nothing to trim
            to: { line: 0, ch: 5 },
            text: "\n\n[^1]: ",
        });
        expect(cursor).toEqual({ line: 2, ch: 6 });
    });

    it("trims trailing blank lines for the first footnote when enabled", () => {
        const doc = fakeEditor(["Alpha", "", ""]);
        const { change } = buildDetailAppend(doc, "1", true, fakePlugin());
        expect(change.from).toEqual({ line: 0, ch: 5 });
        expect(change.to).toEqual({ line: 2, ch: 0 });
    });

    it("adds the section heading for the first footnote when enabled", () => {
        const doc = fakeEditor(["Alpha"]);
        const { change } = buildDetailAppend(
            doc,
            "1",
            true,
            fakePlugin({ enableFootnoteSectionHeading: true }),
        );
        expect(change.text).toBe("\n# Footnotes\n\n[^1]: ");
    });

    it("appends after the last detail when definitions end the note", () => {
        const doc = fakeEditor(["Alpha[^1] bravo", "", "[^1]: one"]);
        const { change, cursor } = buildDetailAppend(doc, "2", false, fakePlugin());
        expect(change).toEqual({
            from: { line: 2, ch: "[^1]: one".length },
            text: "\n[^2]: ",
        });
        expect(cursor).toEqual({ line: 3, ch: 6 });
    });

    it("appends after a mid-document definition group, not at the end of the file (issue #55)", () => {
        const doc = fakeEditor([
            "Alpha[^1] bravo.",
            "",
            "#### Citations",
            "[^1]: one",
            "",
            "#### Images",
            "picture here",
        ]);
        const { change, cursor } = buildDetailAppend(doc, "2", false, fakePlugin());
        expect(change).toEqual({
            from: { line: 3, ch: "[^1]: one".length },
            text: "\n[^2]: ",
        });
        expect(cursor).toEqual({ line: 4, ch: 6 });
    });

    it("appends after the last definition's continuation lines", () => {
        const doc = fakeEditor([
            "Alpha[^1].",
            "",
            "[^1]: one",
            "    continued",
            "",
            "closing prose",
        ]);
        const { change } = buildDetailAppend(doc, "2", false, fakePlugin());
        expect(change.from).toEqual({ line: 3, ch: "    continued".length });
    });

    it("ignores definition-shaped lines inside fenced code when finding the last block", () => {
        const doc = fakeEditor([
            "Alpha[^1].",
            "",
            "[^1]: one",
            "",
            "```",
            "[^9]: fake",
            "```",
        ]);
        const { change } = buildDetailAppend(doc, "2", false, fakePlugin());
        expect(change.from).toEqual({ line: 2, ch: "[^1]: one".length });
    });
});

describe("slotting under an existing section heading (QOL follow-up to #55)", () => {
    const headingOn = () =>
        fakePlugin({ enableFootnoteSectionHeading: true });

    it("the first detail goes under an existing heading, not to EOF", () => {
        const doc = fakeEditor([
            "Intro[^1] text",
            "",
            "# Footnotes",
            "",
            "## Other section",
            "other stuff",
        ]);
        const { change, cursor } = buildDetailAppend(doc, "1", true, headingOn());
        // the blank line after the heading is reused, not doubled
        expect(change).toEqual({
            from: { line: 3, ch: 0 },
            text: "\n[^1]: ",
        });
        expect(cursor).toEqual({ line: 4, ch: 6 });
    });

    it("inserts its own blank line when none follows the heading", () => {
        const doc = fakeEditor(["Intro[^1]", "# Footnotes", "## Other"]);
        const { change, cursor } = buildDetailAppend(doc, "1", true, headingOn());
        expect(change).toEqual({
            from: { line: 1, ch: "# Footnotes".length },
            text: "\n\n[^1]: ",
        });
        expect(cursor).toEqual({ line: 3, ch: 6 });
    });

    it("matches a multi-line heading", () => {
        const doc = fakeEditor([
            "Intro[^1]",
            "",
            "---",
            "## Footnotes",
            "",
            "tail",
        ]);
        const plugin = fakePlugin({
            enableFootnoteSectionHeading: true,
            footnoteSectionHeading: "---\n## Footnotes",
        });
        const { change } = buildDetailAppend(doc, "1", true, plugin);
        expect(change).toEqual({ from: { line: 4, ch: 0 }, text: "\n[^1]: " });
    });

    it("with definitions present, the after-last-block rule still wins", () => {
        const doc = fakeEditor([
            "A[^1] b",
            "",
            "# Footnotes",
            "[^1]: one",
            "",
            "tail",
        ]);
        const { change } = buildDetailAppend(doc, "2", false, headingOn());
        expect(change.from).toEqual({ line: 3, ch: "[^1]: one".length });
    });

    it("a heading line inside a fence does not count", () => {
        const doc = fakeEditor(["A[^1] b", "```", "# Footnotes", "```"]);
        const { change } = buildDetailAppend(doc, "1", true, headingOn());
        // falls through to the EOF path, which adds the real heading
        expect(change.text).toBe("\n# Footnotes\n\n[^1]: ");
    });

    it("with the heading feature off, nothing slots", () => {
        const doc = fakeEditor(["A[^1] b", "", "# Footnotes", "", "tail"]);
        const { change } = buildDetailAppend(doc, "1", true, fakePlugin());
        expect(change.from.line).toBe(4); // EOF path
    });
});
