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
        // a blank line always separates the heading from the content above
        expect(change.text).toBe("\n\n# Footnotes\n\n[^1]: ");
    });

    it("a blank insertion line already supplies the heading's blank line", () => {
        // trimming off, note ends with an empty line: inserting there must
        // not stack a second blank above the heading
        const doc = fakeEditor(["Alpha", ""]);
        const { change } = buildDetailAppend(
            doc,
            "1",
            true,
            fakePlugin({
                enableFootnoteSectionHeading: true,
                enableRemoveBlankLastLines: false,
            }),
        );
        expect(change).toEqual({
            from: { line: 1, ch: 0 },
            text: "\n# Footnotes\n\n[^1]: ",
        });
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

// Bug (A4, reported 2026-07-20): a detail inserted directly above prose gets
// that prose pulled INTO the footnote — Obsidian lazily continues a
// definition into the next non-blank line. Every insertion point that can
// have content below it must keep a blank line between the detail and it.
describe("blank line between the new detail and following content", () => {
    it("separates the detail from prose right below the heading slot (A4)", () => {
        const doc = fakeEditor([
            "Intro[^1] text",
            "",
            "# Footnotes",
            "prose right after",
        ]);
        const { change, cursor } = buildDetailAppend(
            doc,
            "1",
            true,
            fakePlugin({ enableFootnoteSectionHeading: true }),
        );
        expect(change).toEqual({
            from: { line: 2, ch: "# Footnotes".length },
            text: "\n\n[^1]: \n",
        });
        // the cursor still lands at the end of the detail line itself
        expect(cursor).toEqual({ line: 4, ch: 6 });
    });

    it("separates the detail from prose below a reused blank line", () => {
        const doc = fakeEditor(["Intro[^1]", "", "# Footnotes", "", "prose"]);
        const { change, cursor } = buildDetailAppend(
            doc,
            "1",
            true,
            fakePlugin({ enableFootnoteSectionHeading: true }),
        );
        expect(change).toEqual({ from: { line: 3, ch: 0 }, text: "\n[^1]: \n" });
        expect(cursor).toEqual({ line: 4, ch: 6 });
    });

    it("separates a detail appended after the last block from prose below", () => {
        const doc = fakeEditor([
            "Alpha[^1] bravo.",
            "",
            "#### Citations",
            "[^1]: one",
            "#### Images",
        ]);
        const { change, cursor } = buildDetailAppend(doc, "2", false, fakePlugin());
        expect(change).toEqual({
            from: { line: 3, ch: "[^1]: one".length },
            text: "\n[^2]: \n",
        });
        expect(cursor).toEqual({ line: 4, ch: 6 });
    });

    it("adds no separator when a blank line already follows", () => {
        const doc = fakeEditor([
            "Alpha[^1] bravo.",
            "",
            "[^1]: one",
            "",
            "tail prose",
        ]);
        const { change } = buildDetailAppend(doc, "2", false, fakePlugin());
        expect(change.text).toBe("\n[^2]: ");
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
        // the blank line after the heading is reused, not doubled; the
        // trailing "\n" keeps "## Other section" out of the footnote
        expect(change).toEqual({
            from: { line: 3, ch: 0 },
            text: "\n[^1]: \n",
        });
        expect(cursor).toEqual({ line: 4, ch: 6 });
    });

    it("inserts its own blank line when none follows the heading", () => {
        const doc = fakeEditor(["Intro[^1]", "# Footnotes", "## Other"]);
        const { change, cursor } = buildDetailAppend(doc, "1", true, headingOn());
        expect(change).toEqual({
            from: { line: 1, ch: "# Footnotes".length },
            text: "\n\n[^1]: \n",
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
        expect(change).toEqual({ from: { line: 4, ch: 0 }, text: "\n[^1]: \n" });
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
        expect(change.text).toBe("\n\n# Footnotes\n\n[^1]: ");
    });

    it("with the heading feature off, nothing slots", () => {
        const doc = fakeEditor(["A[^1] b", "", "# Footnotes", "", "tail"]);
        const { change } = buildDetailAppend(doc, "1", true, fakePlugin());
        expect(change.from.line).toBe(4); // EOF path
    });
});
