import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";
import { lintFootnotes } from "../../src/linting/linter";

// Reindex enters a genuine period-3 CYCLE (never idempotent) on definition blocks split by a reference-bearing line with cyclically referencing bodies; lint with moveDefinitionsToBottom:false churns forever.
// Hunt: 2026-08-09. Lens: properties.
// Root cause: one reindexOnce pass's renames + block permutation change the nested references' appearance order in a way the next pass "corrects" a third of the way around, so the fixpoint loop never converges.

describe("bug: reindex cycles on definition blocks split by a reference line", () => {
    const CYCLIC = "[^2]: a [^1]\nx[^3]\n[^1]: b\n[^3]: c [^2]";

    it.fails("reindex is idempotent (f(f(doc)) === f(doc))", () => {
        const once = reindexFootnotes(CYCLIC);
        expect(reindexFootnotes(once)).toBe(once);
    });

    it.fails("lint with moveDefinitionsToBottom:false is idempotent", () => {
        const opt = { moveDefinitionsToBottom: false };
        const once = lintFootnotes(CYCLIC, opt);
        expect(lintFootnotes(once, opt)).toBe(once);
    });
});
