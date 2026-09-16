// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 2 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { footnotePrefix } from "../../src/parsing/footnote-prefix";

// What a user sees: they type a"b as the note's footnote-prefix in the
// Properties panel, which Obsidian writes out as footnote-prefix: "a\"b"
// and displays back as a"b. This plugin reads the raw YAML text itself and
// takes the quotes off, but never resolves the escapes inside them, so it
// namespaces the note's footnotes as [^a\"b1] while the Properties panel
// says the prefix is a"b. The two disagree about the note's namespace.

describe("quoted footnote-prefix values are not YAML-unescaped", () => {
    it("a double-quoted value resolves its backslash escapes", () => {
        // YAML: "a\"b" is the 3-character string a"b
        expect(footnotePrefix('---\nfootnote-prefix: "a\\"b"\n---\ntext')).toBe('a"b');
    });

    it("a single-quoted value resolves doubled single quotes", () => {
        // YAML: 'it''s' is the string it's
        expect(footnotePrefix("---\nfootnote-prefix: 'it''s'\n---\ntext")).toBe("it's");
    });
});
