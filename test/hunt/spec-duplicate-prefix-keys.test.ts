import { describe, expect, it } from "vitest";

import { footnotePrefix } from "../../src/parsing/footnote-prefix";

// DECIDED (Jason, 2026-08-10): duplicate footnote-prefix keys aren't a state
// Obsidian's properties panel produces, so the plugin's first-wins read
// stands as the documented behavior. (Strict YAML calls duplicates an error;
// hand-edited frontmatter that carries two keys gets the first one.)
// Originally a spec question from the 2026-08-09 hunt.

describe("decided: duplicate footnote-prefix frontmatter keys are first-wins", () => {
    it("the FIRST footnote-prefix key wins", () => {
        expect(
            footnotePrefix(
                "---\nfootnote-prefix: 2.\nfootnote-prefix: 3.\n---\nbody",
            ),
        ).toBe("2.");
    });
});
