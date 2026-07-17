import { describe, expect, it } from "vitest";

import { moveFootnoteDefinitionsToBottom } from "../../src/move-footnotes-to-bottom";
import { findDefinitionBlocks, protectedLines } from "../../src/markdown-scan";

// BUG: moveFootnoteDefinitionsToBottom relocates a valid definition INTO an
// unclosed code fence. In the input, "[^1]: def" is a fully valid definition
// ABOVE an unclosed fence. move-to-bottom appends it at the very end of the
// document — after the unclosed fence — where protectedLines (by design, an
// unclosed fence protects to EOF) now treats it as inert code. The plugin's own
// findDefinitionBlocks can no longer see the [^1] definition, so the working
// [^1] marker on line 0 is severed from its body. (tidy inherits this via its
// move step.)
// Hunt: 2026-07-17. Lens: properties. Severity: data-loss.

describe("bug: move-to-bottom buries a definition inside an unclosed fence", () => {
    // "[^1]: def" is valid and above the fence; "[^2]: unreachable" is already
    // trapped inside the unclosed fence in the input (that part is pre-existing).
    const doc = "a[^1].\n\n[^1]: def\n\n```\nfake[^2]\n[^2]: unreachable";

    it("the relocated [^1] definition is still a recognized definition", () => {
        const out = moveFootnoteDefinitionsToBottom(doc);
        const lines = out.split("\n");
        const blocks = findDefinitionBlocks(lines, protectedLines(lines));
        expect(blocks.map((b) => b.name)).toContain("1");
    });
});
