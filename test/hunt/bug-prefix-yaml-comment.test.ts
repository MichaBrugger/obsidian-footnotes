import { describe, expect, it } from "vitest";

import { footnotePrefix } from "../../src/insert-or-navigate-footnotes";
import { lintBlockedByPrefix } from "../../src/linting/linter";

// Scenario: "footnote-prefix: 2. # later chapters" makes footnotePrefix return
// the comment too, so footnotePrefixProblem blocks every insert and
// lintBlockedByPrefix cancels linting on a phantom prefix the note doesn't
// actually have (js-yaml-verified divergence from Obsidian's real YAML parse).
// Hunt: 2026-08-09. Lens: grammar.
// Root cause: footnotePrefix's hand-rolled frontmatter reader grabs the whole
// rest of the line instead of parsing YAML — comments (and the colon-space
// rule) are not honored.

describe("bug: footnote-prefix frontmatter reader keeps YAML comments", () => {
    it.fails("a trailing YAML comment is not part of the prefix value", () => {
        // YAML: value is "2." — "# later chapters" is a comment
        const md = "---\nfootnote-prefix: 2. # later chapters\n---\nbody";
        expect(footnotePrefix(md)).toBe("2.");
    });

    it.fails("a comment-only value is an empty value, not a prefix of '#…'", () => {
        // YAML: null value (only a comment) — Obsidian shows no prefix
        const md = "---\nfootnote-prefix: #chapter\n---\nbody";
        expect(footnotePrefix(md)).toBe("");
    });

    it.fails("strips a comment after a quoted value", () => {
        expect(footnotePrefix('---\nfootnote-prefix: "2." # chapter\n---\nbody')).toBe("2.");
    });

    it.fails("a key with no space after the colon is not a YAML mapping entry", () => {
        // YAML: "footnote-prefix:2." is a plain scalar line, NOT a key
        const md = "---\nfootnote-prefix:2.\n---\nbody";
        expect(footnotePrefix(md)).toBe("");
    });

    it.fails("a commented prefix must not cancel linting", () => {
        expect(
            lintBlockedByPrefix("---\nfootnote-prefix: 2. # chapter\n---\nbody[^1]"),
        ).toBeNull();
    });
});
