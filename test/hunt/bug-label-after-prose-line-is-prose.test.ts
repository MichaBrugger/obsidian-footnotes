import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";

import { listExistingFootnoteDefinitions } from "../../src/editor/doc-context";
import { lintFootnotes } from "../../src/linting/linter";
import {
    orphanedFootnoteReferenceNames,
    removeOrphanedFootnoteReferences,
} from "../../src/linting/rules/remove-orphaned-references";
import { orphanedFootnoteDefinitionNames } from "../../src/linting/rules/remove-orphaned-definitions";
import { findDefinitionBlocks, scanDocument } from "../../src/parsing/markdown-scan";

// Obsidian, like CommonMark for link reference definitions, does not let a
// footnote definition interrupt a paragraph: a "[^x]:" line directly under
// a prose line (paragraph text, a list item, a quote line, a table row) is
// lazy paragraph text and renders as plain "[^x]: ..." with no footnote.
// Ground truth in Reading view, 2026-09-09 (manual sheet 25): ten shapes,
// definitions only after a blank line, the note start, a heading, a closed
// fence, or another definition. The plugin read a label as a definition
// wherever it sat, so it listed and navigated to "definitions" Obsidian
// showed as text, stayed quiet about the unresolved reference, and its
// lint promoted the line into a real footnote by inserting the blank line.
// Jason's decision (2026-09-09): match Obsidian; the orphan alert explains
// the situation and the user adds the blank line.

const blocksOf = (doc: string) => {
    const lines = doc.split("\n");
    const scan = scanDocument(lines);
    return findDefinitionBlocks(lines, scan.isProtected, scan).map((b) => `${b.name}@${b.start}`);
};

describe("a label directly under a prose line is prose, not a definition", () => {
    it("is not a definition block after a paragraph, list item, quote line, or table row", () => {
        expect(blocksOf("a[^1]\npara\n[^1]: mid")).toEqual([]);
        expect(blocksOf("para\n[^1]: mid\n\nuse[^1]")).toEqual([]);
        expect(blocksOf("a[^1]\npara\n  [^1]: mid")).toEqual([]);
        expect(blocksOf("a[^1]\n- item\n[^1]: mid")).toEqual([]);
        expect(blocksOf("a[^1]\n> quote\n[^1]: mid")).toEqual([]);
        expect(blocksOf("a[^1]\n| x | y |\n| - | - |\n| 1 | 2 |\n[^1]: mid")).toEqual([]);
        // two labels under a paragraph: the first is lazy prose, so the
        // second follows prose too
        expect(blocksOf("a[^1] b[^2]\n[^2]: first\n[^1]: mid")).toEqual([]);
        // a lazy continuation keeps the paragraph open
        expect(blocksOf("para\n    lazy\n[^1]: mid")).toEqual([]);
    });

    it("is a definition after a blank line, the note start, a heading, a closed fence, or a definition", () => {
        expect(blocksOf("a[^1]\npara\n\n[^1]: mid")).toEqual(["1@3"]);
        expect(blocksOf("[^1]: first line of the note")).toEqual(["1@0"]);
        expect(blocksOf("a[^1]\n# Heading\n[^1]: mid")).toEqual(["1@2"]);
        expect(blocksOf("a[^1]\n```\ncode\n```\n[^1]: mid")).toEqual(["1@4"]);
        expect(blocksOf("a[^1]\n---\n[^1]: mid")).toEqual(["1@2"]);
        expect(blocksOf("x\n\n[^1]: one\n[^2]: two")).toEqual(["1@2", "2@3"]);
        expect(blocksOf("x\n\n[^1]: one\n    more\n[^2]: two")).toEqual(["1@2", "2@4"]);
        expect(blocksOf("---\ntitle: t\n---\n[^1]: right after frontmatter")).toEqual(["1@3"]);
    });

    it("the same rule holds for blockquoted labels", () => {
        expect(orphanedFootnoteDefinitionNames("> para\n> [^q]: quoted under prose")).toEqual([]);
        expect(orphanedFootnoteDefinitionNames("> [^q]: quoted at the start")).toEqual(["q"]);
        expect(orphanedFootnoteDefinitionNames("> para\n>\n> [^q]: after a quote blank")).toEqual(["q"]);
    });

    it("the lint leaves the note alone and treats the reference as unresolved", () => {
        const doc = "a[^1]\npara\n[^1]: mid";
        expect(lintFootnotes(doc)).toBe(doc);
        expect(orphanedFootnoteReferenceNames(doc)).toEqual(["1"]);
        // deletion removes the live reference and leaves the prose line as it is
        expect(removeOrphanedFootnoteReferences(doc)).toBe("a\npara\n[^1]: mid");
    });

    it("the press-side definition list agrees", () => {
        const prose = fakeEditor(["a[^1]", "para", "[^1]: mid"], { cursor: { line: 0, ch: 0 }, wholeDoc: true });
        expect(listExistingFootnoteDefinitions(prose)).toEqual([]);
        const real = fakeEditor(["a[^1]", "", "[^1]: mid"], { cursor: { line: 0, ch: 0 }, wholeDoc: true });
        expect(listExistingFootnoteDefinitions(real)).toEqual(["1"]);
    });
});
