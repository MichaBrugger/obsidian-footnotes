// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { footnotePrefix, footnotePrefixProblem } from "../../src/parsing/footnote-prefix";

// What a user would see: their frontmatter is broken (an unterminated quote
// makes the whole block unparseable, so Obsidian's Properties panel shows NO
// footnote-prefix at all), yet the plugin still namespaces every new
// footnote behind a prefix containing a stray quote character, e.g.
// [^"2.1]. The setting driving their footnote names is invisible to them.
//
// The reader's own contract (footnote-prefix.ts, on unclosed blocks):
// "Honoring an unclosed block would namespace the note's footnotes from a
// setting the user cannot see." The same holds for a block YAML cannot
// parse at all: js-yaml (what Obsidian uses) throws on
// 'footnote-prefix: "2.' ("unexpected end of the stream within a double
// quoted scalar"), so Obsidian shows no property, while the plugin reads
// the value as `"2.` and accepts it as a valid prefix.

describe("prefix reader vs YAML-unparseable values", () => {
    it.fails("an unterminated quote is not a usable prefix", () => {
        const prefix = footnotePrefix('---\nfootnote-prefix: "2.\n---\nbody[^1]');
        // Obsidian shows NO property here (js-yaml throws on the block),
        // so there is no prefix to honor
        expect(prefix).toBe("");
    });

    it("a properly quoted value still reads fine (contrast pin)", () => {
        expect(footnotePrefix('---\nfootnote-prefix: "2."\n---\nbody[^1]')).toBe("2.");
    });

    it.fails("the stray-quote value is at least not accepted as VALID", () => {
        const prefix = footnotePrefix('---\nfootnote-prefix: "2.\n---\nbody[^1]');
        expect(footnotePrefixProblem(prefix)).not.toBeNull();
    });
});
