import { describe, expect, it } from "vitest";

import { footnotePrefix } from "../../src/insert-or-navigate-footnotes";

// spec question: when a note's frontmatter carries two footnote-prefix lines,
// which value should win — first-wins, or whatever Obsidian's properties
// panel resolves duplicates to?
// Hunt: 2026-08-09. Lens: regressions.
// The plugin's hand-rolled parser returns on the FIRST match, i.e.
// first-wins. YAML 1.2 says duplicate keys are an ERROR (js-yaml throws), and
// what Obsidian actually surfaces for duplicate keys is unverified — so the
// only certainty is that the plugin and a strict YAML parser disagree.

describe("spec question: duplicate footnote-prefix frontmatter keys", () => {
    it.fails("duplicate footnote-prefix keys resolve the way Obsidian resolves them", () => {
        expect(
            footnotePrefix(
                "---\nfootnote-prefix: 2.\nfootnote-prefix: 3.\n---\nbody",
            ),
        ).toBe("3.");
    });
});
