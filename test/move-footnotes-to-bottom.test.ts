import { describe, expect, it } from "vitest";

import { moveFootnoteDefinitionsToBottom } from "../src/linting/rules/move-footnotes-to-the-bottom";

// Linter's "move footnotes to the bottom", integrated with this plugin's
// section-heading setting. Policy pinned here:
//   - definition blocks (with their continuations) relocate to the end of
//     the note, keeping their relative order — ordering is reindex's job
//   - the layout matches what the plugin's own insert flow produces, so a
//     note the plugin built is already a fixed point: heading directly
//     after the body (dividers get a blank line first), blank line before
//     the first definition, definitions tightly grouped
//   - the heading is only added when missing, and only when there are
//     definitions to sit under it
//   - code blocks and frontmatter are invisible; trailing newlines survive

describe("moveFootnoteDefinitionsToBottom", () => {
    it("returns a document with no definitions unchanged", () => {
        const text = "plain[^1] prose\n\nno definitions here";
        expect(moveFootnoteDefinitionsToBottom(text)).toBe(text);
    });

    it("leaves definitions already at the bottom untouched", () => {
        const text = "body[^1] text[^2].\n\n[^1]: one\n[^2]: two";
        expect(moveFootnoteDefinitionsToBottom(text)).toBe(text);
    });

    it("moves a mid-document definition to the bottom", () => {
        const input = "para one[^1].\n\n[^1]: def\n\npara two";
        const expected = "para one[^1].\n\npara two\n\n[^1]: def";
        expect(moveFootnoteDefinitionsToBottom(input)).toBe(expected);
    });

    it("keeps the definitions' relative order", () => {
        const input = "a[^2].\n\n[^2]: two\n\nb[^1].\n\n[^1]: one";
        const expected = "a[^2].\n\nb[^1].\n\n[^2]: two\n[^1]: one";
        expect(moveFootnoteDefinitionsToBottom(input)).toBe(expected);
    });

    it("moves continuation lines with their definition", () => {
        const input = [
            "text[^1].",
            "",
            "[^1]: first line",
            "    continued",
            "",
            "    another paragraph",
            "",
            "closing thoughts",
        ].join("\n");
        const expected = [
            "text[^1].",
            "",
            "closing thoughts",
            "",
            "[^1]: first line",
            "    continued",
            "",
            "    another paragraph",
        ].join("\n");
        expect(moveFootnoteDefinitionsToBottom(input)).toBe(expected);
    });

    it("tightens blank lines between bottom definitions", () => {
        const input = "body[^1][^2].\n\n[^1]: one\n\n[^2]: two";
        const expected = "body[^1][^2].\n\n[^1]: one\n[^2]: two";
        expect(moveFootnoteDefinitionsToBottom(input)).toBe(expected);
    });

    it("adds the section heading when configured and missing", () => {
        const input = "body[^1].\n\n[^1]: def";
        // a blank line always separates the heading from the body above
        const expected = "body[^1].\n\n# Footnotes\n\n[^1]: def";
        expect(moveFootnoteDefinitionsToBottom(input, "# Footnotes")).toBe(
            expected,
        );
    });

    it("does not duplicate an existing section heading, normalizing its spacing", () => {
        const tight = "body[^1].\n# Footnotes\n\n[^1]: def";
        const spaced = "body[^1].\n\n# Footnotes\n\n[^1]: def";
        expect(moveFootnoteDefinitionsToBottom(tight, "# Footnotes")).toBe(
            spaced,
        );
        // the spaced layout is a fixed point
        expect(moveFootnoteDefinitionsToBottom(spaced, "# Footnotes")).toBe(
            spaced,
        );
    });

    it("keeps a blank line between the body and a divider heading", () => {
        // a divider directly below text would turn it into a setext heading
        const input = "body[^1].\n\n[^1]: def";
        const expected = "body[^1].\n\n---\n\n[^1]: def";
        expect(moveFootnoteDefinitionsToBottom(input, "---")).toBe(expected);
    });

    it("does not add the heading to a note without definitions", () => {
        const text = "no footnotes here";
        expect(moveFootnoteDefinitionsToBottom(text, "# Footnotes")).toBe(
            text,
        );
    });

    it("ignores definition-looking lines inside fenced code", () => {
        const text = "body[^1].\n\n```\n[^9]: fenced fake\n```\n\n[^1]: def";
        expect(moveFootnoteDefinitionsToBottom(text)).toBe(text);
    });

    it("preserves the document's trailing newline", () => {
        const input = "para[^1].\n\n[^1]: def\n\npara two\n";
        const expected = "para[^1].\n\npara two\n\n[^1]: def\n";
        expect(moveFootnoteDefinitionsToBottom(input)).toBe(expected);
    });

    it("handles a document that is only definitions", () => {
        const input = "[^1]: one\n[^2]: two";
        expect(moveFootnoteDefinitionsToBottom(input)).toBe(input);
    });

    it("is idempotent", () => {
        const messy =
            "a[^2].\n\n[^2]: two\n    more\n\nb[^1].\n\n[^1]: one\n\ntail\n";
        const once = moveFootnoteDefinitionsToBottom(messy, "# Footnotes");
        expect(moveFootnoteDefinitionsToBottom(once, "# Footnotes")).toBe(
            once,
        );
    });
});

describe("multi-line section headings (bug reported 2026-07-17)", () => {
    // repeated linting kept re-adding the heading: the present-check
    // compared single lines against the whole multi-line setting value
    const HEADING = "---\n## Footnotes";

    it("adds a multi-line heading once", () => {
        const input = "body[^1].\n\n[^1]: def";
        const expected = "body[^1].\n\n---\n## Footnotes\n\n[^1]: def";
        expect(moveFootnoteDefinitionsToBottom(input, HEADING)).toBe(expected);
    });

    it("does not duplicate an existing multi-line heading", () => {
        const once = moveFootnoteDefinitionsToBottom(
            "body[^1].\n\n[^1]: def",
            HEADING,
        );
        expect(moveFootnoteDefinitionsToBottom(once, HEADING)).toBe(once);
    });

    it("moves an existing multi-line heading along with the definitions", () => {
        const input =
            "body[^1].\n\n---\n## Footnotes\n\n[^1]: def\n\ntrailing prose";
        const expected =
            "body[^1].\n\ntrailing prose\n\n---\n## Footnotes\n\n[^1]: def";
        expect(moveFootnoteDefinitionsToBottom(input, HEADING)).toBe(expected);
    });
});
