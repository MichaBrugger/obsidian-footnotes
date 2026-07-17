import { describe, expect, it } from "vitest";

import { moveFootnoteDefinitionsToBottom } from "../../src/move-footnotes-to-bottom";

// BUG: moveFootnoteDefinitionsToBottom's `base.endsWith(sectionHeading)` check
// is a naive string-suffix test standing in for "does the doc already end with
// this heading". It over-fires on any trailing text that merely ends with the
// configured heading string, so the configured heading is silently NOT inserted
// when it is genuinely absent: an H2 "## Footnotes" satisfies a configured H1
// "# Footnotes"; prose ending in the heading text satisfies it; and a body
// ending in the frontmatter's own closing "---" satisfies a configured "---"
// divider. (Also reached via the without_skill sweep as BUG 6.)
// Scenario: endsWith heading guard false-positives, so the real heading is omitted.
// pinned 2026-07-17, hunt-bugs consolidation.
// Provenance: iteration-1/eval-0/with_skill/run-1 (transforms hunt), lens: interactions/contexts.

describe("bug: move-to-bottom endsWith heading check false-positives", () => {
    it.fails("'## Footnotes' does not satisfy a configured '# Footnotes'", () => {
        const out = moveFootnoteDefinitionsToBottom(
            "body[^1].\n## Footnotes\n\n[^1]: def",
            "# Footnotes",
        );
        expect(out.split("\n")).toContain("# Footnotes");
    });

    it.fails("prose ending in the heading text does not satisfy the check", () => {
        const out = moveFootnoteDefinitionsToBottom(
            "body[^1].\nprose about the # Footnotes\n\n[^1]: def",
            "# Footnotes",
        );
        expect(out.split("\n")).toContain("# Footnotes");
    });

    it.fails("divider heading is added even when body ends with frontmatter close ---", () => {
        // body ends with the frontmatter's own closing "---", so endsWith("---")
        // is true and the configured divider is skipped
        const out = moveFootnoteDefinitionsToBottom(
            "---\ntitle: x\n---\n[^1]: def",
            "---",
        );
        expect(out).toBe("---\ntitle: x\n---\n\n---\n\n[^1]: def");
    });
});
