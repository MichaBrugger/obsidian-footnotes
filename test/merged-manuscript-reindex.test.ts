import { describe, expect, it } from "vitest";
import { reindexFootnotes } from "../src/linting/rules/re-index-footnotes";

// The chapter-notes workflow, end to end: each scene note carried its own
// footnote prefix, Longform (or Easy Bake, or cat) glued the scenes together,
// and now the merged note has no prefix of its own. Running the reindex with
// "Renumber named footnotes" on must give the manuscript clean 1..n numbers,
// because to a note without a prefix every prefixed label is just a name.
// Claimed publicly in the Longform #44 outreach comment (2026-09-15), so it
// stays pinned here.
describe("merged manuscript with prefixed footnotes", () => {
    const merged = [
        "# Scene 1",
        "Alpha.[^1-1] Beta.[^1-2] Alpha again.[^1-1]",
        "",
        "[^1-1]: one",
        "[^1-2]: two",
        "",
        "# Scene 2",
        "Gamma.[^2-1] Delta.[^2-note]",
        "",
        "[^2-1]: three",
        "[^2-note]: four",
        "",
        "# Scene 3",
        "Epsilon.[^3-1]",
        "",
        "[^3-1]: five",
        "",
    ].join("\n");

    it("renumbers everything 1..n with renumberNamedFootnotes on", () => {
        const out = reindexFootnotes(merged, { renumberNamedFootnotes: true });
        expect(out).toContain("Alpha.[^1] Beta.[^2] Alpha again.[^1]");
        expect(out).toContain("Gamma.[^3] Delta.[^4]");
        expect(out).toContain("Epsilon.[^5]");
        expect(out).toContain("[^5]: five");
        expect(out).not.toMatch(/\[\^\d-/);
    });

    it("leaves prefixed labels alone with the option off", () => {
        const out = reindexFootnotes(merged, { renumberNamedFootnotes: false });
        expect(out).toBe(merged);
    });
});
