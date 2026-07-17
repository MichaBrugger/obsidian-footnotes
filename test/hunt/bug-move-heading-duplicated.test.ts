import { describe, expect, it } from "vitest";

import { moveFootnoteDefinitionsToBottom } from "../../src/move-footnotes-to-bottom";
import { tidyFootnotes } from "../../src/tidy-footnotes";

// BUG: moveFootnoteDefinitionsToBottom duplicates a footnote-section heading
// that already sits mid-document above the definitions. The presence check is
// `base.endsWith(sectionHeading)`, which only inspects the TAIL of the body. On
// "body[^1].\n# Footnotes\n\n[^1]: def\n\ntrailing prose" the body ends with
// "trailing prose" (not the heading), so a SECOND "# Footnotes" is appended
// above the moved definition — leaving one heading orphaned mid-document and one
// at the bottom. Also reached via tidy.
// Scenario: move-to-bottom adds a second "# Footnotes" when one already exists mid-doc.
// pinned 2026-07-17, hunt-bugs consolidation.
// Provenance: iteration-1/eval-0/with_skill/run-1 (transforms hunt), lens: interactions.

describe("bug: move-to-bottom duplicates a mid-document footnote heading", () => {
    const input = "body[^1].\n# Footnotes\n\n[^1]: def\n\ntrailing prose";

    it("does not duplicate a heading that sits mid-document", () => {
        const out = moveFootnoteDefinitionsToBottom(input, "# Footnotes");
        const count = out.split("\n").filter((l) => l === "# Footnotes").length;
        expect(count).toBe(1);
    });

    it("tidy does not leave an orphaned heading behind", () => {
        const out = tidyFootnotes(input, { sectionHeading: "# Footnotes" });
        const count = out.split("\n").filter((l) => l === "# Footnotes").length;
        expect(count).toBe(1);
    });
});
