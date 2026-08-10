import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";
import { moveFootnoteDefinitionsToBottom } from "../../src/linting/rules/move-footnotes-to-the-bottom";
import { lintFootnotes } from "../../src/linting/linter";
import { protectedLines } from "../../src/markdown-scan";

// Cutting a definition at line 0 strands a "---" at DOCUMENT START, and a leading --- plus a later --- line manufactures a YAML frontmatter block that swallows live prose; reindex drop-orphans then DELETES the still-referenced definition.
// Hunt: 2026-08-09. Lens: properties.
// Root cause: removeLineRanges' setext guard only fires mid-document (out.length > 0), so a cut at line 0 can leave "---" at document start where it parses as frontmatter.

describe("fixed 2026-08-10: a cut stranding '---' at document start manufactures frontmatter", () => {
    it("move-to-bottom does not turn live prose into a frontmatter block", () => {
        const doc = "[^1]: def\n---\ntext[^1]\n---\nmore";
        const out = moveFootnoteDefinitionsToBottom(doc);
        const lines = out.split("\n");
        const proseLine = lines.findIndex((l) => l.startsWith("text[^"));
        expect(protectedLines(lines)[proseLine]).toBe(false);
    });

    it("reindex drop-orphans keeps the definition whose reference sits after a stranded '---'", () => {
        const doc = "[^9]: orphan\n---\ntext[^1]\n---\n\n[^1]: def";
        const out = reindexFootnotes(doc, {
            keepOrphanedDefinitions: false,
        });
        expect(out).toContain("[^1]: def");
    });

    it("the composed lint does not manufacture frontmatter either", () => {
        const doc = "[^1]: def\n---\ntext[^1]\n---\nmore";
        const out = lintFootnotes(doc);
        const lines = out.split("\n");
        const proseLine = lines.findIndex((l) => l.startsWith("text[^"));
        expect(protectedLines(lines)[proseLine]).toBe(false);
        expect(out).toContain("[^1]: def");
    });
});
