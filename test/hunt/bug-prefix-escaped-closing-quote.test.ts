// Imported from the GLM 5.3 Flash cycle 6 hunt of 2026-09-16 (OpenCode worktree); 2 of 4 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { describe, expect, it } from "vitest";

import { footnotePrefix } from "../../src/parsing/footnote-prefix";

// BUG (GLM hunt, cycle after 9, 2026-09-16): a frontmatter value whose
// closing quote only LOOKS closed is unterminated to YAML. In a
// double-quoted YAML scalar a backslash escapes the quote, and in a
// single-quoted one a doubled quote is an escaped quote, so
//
//     footnote-prefix: "2.\"
//     footnote-prefix: '2.''
//
// both throw in js-yaml (the parser Obsidian uses, verified 2026-09-16:
// "unexpected end of the stream within a double/single quoted scalar").
// Obsidian's Properties panel shows NO footnote-prefix out of such a
// block, exactly as for 'footnote-prefix: "2.' - the shape the imported
// pin bug-name-prefix-unterminated-quote settled for a quote with no
// closer at all.
//
// The plugin's reader matches quotes with /^(["'])(.*)\1$/, which sees a
// closed quote in both spellings and hands the stray backslash/quote on
// as the note's prefix: "2.\" and "2.'". The plugin then namespaces the
// note's footnotes behind a setting the Properties panel does not show
// at all - the exact contract footnote-prefix.ts states for unclosed
// blocks: "Honoring an unclosed block would namespace the note's
// footnotes from a setting the user cannot see."
//
// Source of truth: js-yaml (what Obsidian uses) throws on both values,
// as recorded above; the reader's own unclosed-block contract.
//
// Settings involved: `Per-note footnote prefix` (the reader feeds every
// numbered/named insert, reindex, and the lint's prefix rules).

describe("a prefix value whose closing quote YAML escapes is not a usable prefix", () => {
    it("a backslash-escaped closing quote makes the block unreadable", () => {
        // YAML: \" inside a double-quoted scalar is an escaped quote, so
        // this value never terminates and js-yaml throws
        expect(footnotePrefix('---\nfootnote-prefix: "2.\\"\n---\nbody')).toBe("");
    });

    it("a doubled closing single quote makes the block unreadable too", () => {
        // YAML: '' inside a single-quoted scalar is an escaped quote, so
        // '2.'' never terminates
        expect(footnotePrefix("---\nfootnote-prefix: '2.''\n---\nbody")).toBe("");
    });

    it("control: a plain quoted value still reads", () => {
        expect(footnotePrefix('---\nfootnote-prefix: "2."\n---\nbody')).toBe("2.");
    });

    it("control: an escaped backslash before the quote still parses in YAML", () => {
        // "2.\\" - the \\ is an escaped backslash, the final " closes the
        // scalar; js-yaml parses it to 2.\ and the plugin should too
        expect(footnotePrefix('---\nfootnote-prefix: "2.\\\\"\n---\nbody')).toBe("2.\\");
    });
});
