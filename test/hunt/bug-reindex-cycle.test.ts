import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";
import { lintFootnotes } from "../../src/linting/linter";

// Reindex enters a genuine period-3 CYCLE (never idempotent) on definition blocks split by a reference-bearing line with cyclically referencing bodies; lint with moveDefinitionsToBottom:false churns forever.
// Hunt: 2026-08-09. Lens: properties.
// Root cause: one reindexOnce pass's renames + block permutation change the nested references' appearance order in a way the next pass "corrects" a third of the way around, so the fixpoint loop never converges.

describe("fixed 2026-08-10: reindex cycles on definition blocks split by a reference line", () => {
    // blank lines between the blocks: a label directly under a prose line
    // is lazy text since 2026-09-09, and this cycle needs three real blocks
    const CYCLIC = "[^2]: a [^1]\n\nx[^3]\n\n[^1]: b\n[^3]: c [^2]";

    it("reindex is idempotent (f(f(doc)) === f(doc))", () => {
        const once = reindexFootnotes(CYCLIC);
        expect(reindexFootnotes(once)).toBe(once);
    });

    it("lint with moveDefinitionsToBottom:false is idempotent", () => {
        const opt = { moveDefinitionsToBottom: false };
        const once = lintFootnotes(CYCLIC, opt);
        expect(lintFootnotes(once, opt)).toBe(once);
    });
});
