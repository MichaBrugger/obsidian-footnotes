import { describe, expect, it } from "vitest";

import { footnotePrefix, footnotePrefixProblem } from "../src/parsing/footnote-prefix";
import { lintBlockedByPrefix } from "../src/linting/linter";

// The hand-rolled frontmatter reader behind the footnote-prefix property.
// History: the 2026-08-09 hunt found "footnote-prefix: 2. # later
// chapters" read as a phantom prefix and taught the reader YAML comments.
// Jason reversed that on 2026-09-05: nobody writes YAML comments, the
// Properties editor can't produce them, and the stripping was checking
// code nobody needed. The text after the colon IS the value; a comment
// makes it invalid, and the ordinary invalid-prefix toast says so.

describe("the footnote-prefix frontmatter reader", () => {
    it("reads a plain value", () => {
        expect(footnotePrefix("---\nfootnote-prefix: 2.\n---\nbody")).toBe("2.");
    });

    it("drops the quotes Obsidian adds around a value YAML would misread", () => {
        expect(footnotePrefix('---\nfootnote-prefix: "2:"\n---\nbody')).toBe("2:");
        expect(footnotePrefix("---\nfootnote-prefix: '2:'\n---\nbody")).toBe("2:");
    });

    it("a YAML comment is part of the value, and that value is invalid (ruling 2026-09-05)", () => {
        const value = footnotePrefix("---\nfootnote-prefix: 2. # later chapters\n---\nbody");
        expect(value).toBe("2. # later chapters");
        expect(footnotePrefixProblem(value)).toBe(
            "The footnote prefix can't contain spaces, backticks, or brackets.",
        );
    });

    it("text after a closing quote keeps the quotes in the value, which is then invalid", () => {
        const value = footnotePrefix('---\nfootnote-prefix: "2." # chapter\n---\nbody');
        expect(value).toBe('"2." # chapter');
        expect(footnotePrefixProblem(value)).not.toBeNull();
    });

    it("a comment-only value is read as the prefix it spells (accepted consequence of the ruling)", () => {
        // YAML would call this an empty value; the plugin reads "#chapter".
        // Hand-written edge nobody hits - the Properties editor can't
        // write it - and it needs no special case.
        expect(footnotePrefix("---\nfootnote-prefix: #chapter\n---\nbody")).toBe("#chapter");
    });

    it("a key with no space after the colon is not a YAML mapping entry (Obsidian shows no property)", () => {
        expect(footnotePrefix("---\nfootnote-prefix:2.\n---\nbody")).toBe("");
    });

    it("a commented prefix blocks linting like any other invalid prefix", () => {
        expect(
            lintBlockedByPrefix("---\nfootnote-prefix: 2. # chapter\n---\nbody[^1]"),
        ).not.toBeNull();
    });
});
