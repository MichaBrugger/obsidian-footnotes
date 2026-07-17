import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// BUG: reindex orphan-deletion is non-transitive (single pass). Two definitions
// that only reference EACH OTHER ("[^1]: uses[^2] inside" / "[^2]: two body",
// no top-level marker for either) are mutually orphaned, but reindex computes
// the orphan set once, cuts, then re-derives WITHOUT looping. Pass 1 deletes
// [^1] (not in the pre-cut marker set) and renumbers [^2]->[^1], leaving
// "para.\n\n[^1]: two body". Running the same command AGAIN (pass 2) now finds
// that survivor unreferenced and deletes it too, silently destroying "two
// body". A convergent transform must reach its orphan fixpoint in one run.
// (Reached identically via lint with keepOrphanedDefinitions:false.)
// Hunt: 2026-07-17. Lens: properties. Severity: data-loss.
// fixed 2026-07-17: reindexFootnotes now re-runs reindexOnce to a fixpoint,
// so all transitive orphans are removed within a single call.

describe("bug: reindex orphan deletion needs two runs (destroys text on the 2nd)", () => {
    const doc = "para.\n\n[^1]: uses[^2] inside\n[^2]: two body";
    const f = (d: string) => reindexFootnotes(d, { keepOrphanedDefinitions: false });

    it("deleting orphans is idempotent (f(f(doc)) === f(doc))", () => {
        const once = f(doc);
        expect(f(once)).toBe(once);
    });
});
