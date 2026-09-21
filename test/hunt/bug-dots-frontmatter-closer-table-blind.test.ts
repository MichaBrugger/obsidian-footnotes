// Imported from the opus-cycle-1 hunt of 2026-09-21 (Claude Code subagent worktree); rewritten to the probed reading 2026-09-21.
// PROBED 2026-09-21: Obsidian does not close frontmatter on YAML's "..." marker. The head block then never closes, so "---" is a thematic break and every line after it is prose: the label directly under that prose is lazy text and the pipe run under the lazy label is no table. The hunter's claim that the table reader was frontmatter-blind rested on the scan closing the block on "...", which was the bug; the scan and both prefix readers now close on "---" alone, and the three readers agree.
import { describe, expect, it } from "vitest";

import { lintFootnotes, LintOptions } from "../../src/linting/linter";
import { lazyDefinitionLabelNames } from "../../src/linting/rules/remove-orphaned-references";
import {
    definitionStartLines,
    findDefinitionBlocks,
    maskProtectedLines,
    scanDocument,
    tableRowLinesOf,
} from "../../src/parsing/markdown-scan";

const DOC = "---\nt: v\n...\n[^1]: body\n| a | b |\n| --- | --- |\n\nprose[^1]";
const CONTROL = "---\nt: v\n---\n[^1]: body\n| a | b |\n| --- | --- |\n\nprose[^1]";

const options: LintOptions = {
    fixPunctuation: true,
    fixLazyDefinitions: true,
    moveDefinitionsToBottom: true,
    reindex: true,
    removeOrphanedReferences: false,
    removeOrphanedDefinitions: false,
    mergeDuplicateDefinitions: false,
};

describe("a head block closed with YAML's \"...\" is not frontmatter", () => {
    it("the scan protects nothing and the label under the prose is lazy", () => {
        const lines = DOC.split("\n");
        const scan = scanDocument(lines);
        expect(scan.isProtected).toEqual([false, false, false, false, false, false, false, false]);
        const masked = maskProtectedLines(lines, scan);
        const starts = definitionStartLines(lines, scan, (i) => masked[i]);
        expect(starts[3]).toBe(false);
        expect(lazyDefinitionLabelNames(lines, scan, masked, starts)).toEqual(["1"]);
    });

    it("the pipe run under the lazy label is no table, to the table reader and the block walker alike", () => {
        const lines = DOC.split("\n");
        expect(tableRowLinesOf(lines)).toEqual([false, false, false, false, false, false, false, false]);
        expect(findDefinitionBlocks(lines)).toEqual([]);
    });

    it("the lint settles in one pass: the blank line it adds makes the label a definition, the run a table, and the move gathers the definition below", () => {
        const once = lintFootnotes(DOC, options);
        expect(once).toBe("---\nt: v\n...\n\n| a | b |\n| --- | --- |\n\nprose[^1]\n\n[^1]: body");
        expect(lintFootnotes(once, options)).toBe(once);
    });

    it("control: with a \"---\" closer the head block is protected and the note is stable", () => {
        expect(scanDocument(CONTROL.split("\n")).isProtected.slice(0, 4)).toEqual([true, true, true, false]);
        const once = lintFootnotes(CONTROL, options);
        expect(lintFootnotes(once, options)).toBe(once);
    });
});
