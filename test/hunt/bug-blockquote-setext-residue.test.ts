import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// BUG: deleting an orphan definition under "> closing words[^1]" followed by
// "> ---" leaves a pair that renders as a blockquoted H2.
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: the pinned setext fix's adjacency regex can't match "> ---".

describe("bug: orphan deletion leaves a setext heading inside a blockquote", () => {
    it.fails("does not create a setext heading inside a blockquote when deleting an orphan", () => {
        const input = [
            "> closing words[^1]",
            "[^9]: orphan",
            "> ---",
            "",
            "[^1]: used",
        ].join("\n");
        const output = reindexFootnotes(input, {
            keepOrphanedDefinitions: false,
        });

        expect(output).not.toContain("> closing words[^1]\n> ---");
    });
});
