// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { footnotePrefix } from "../../src/parsing/footnote-prefix";

// What a user would see: their Properties panel clearly shows a
// "footnote-prefix" property with value "2.", but the plugin behaves as if
// the note had no prefix at all: new footnotes are minted unprefixed and
// the apply-prefix lint does nothing, silently.
//
// The reader's own contract (footnote-prefix.ts): it "covers only the slice
// of YAML Obsidian itself shows as a property". A space before the colon
// ("footnote-prefix : 2.") is still that property to YAML: js-yaml (what
// Obsidian uses) parses it as { "footnote-prefix": "2." }, so Obsidian's
// Properties panel shows it. The hand-rolled pattern
// /^footnote-prefix:(?:\s+(.*))?$/ misses it.

describe("prefix reader vs space before the colon", () => {
    it.fails("reads a prefix written with a space before the colon", () => {
        expect(footnotePrefix("---\nfootnote-prefix : 2.\n---\nbody[^1]")).toBe("2.");
    });

    it.fails("reads a prefix written with a tab before the colon", () => {
        expect(footnotePrefix("---\nfootnote-prefix\t: 2.\n---\nbody[^1]")).toBe("2.");
    });

    it("the ordinary spelling still reads (contrast pin)", () => {
        expect(footnotePrefix("---\nfootnote-prefix: 2.\n---\nbody[^1]")).toBe("2.");
    });
});
