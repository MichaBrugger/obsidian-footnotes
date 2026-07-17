import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/reindex-footnotes";

// BUG: reindexFootnotes is not idempotent when definition BODIES contain nested
// numbered markers whose first appearance is inside a definition. The marker
// appearance order is computed once from pre-reorder line positions, but the
// definition blocks are then permuted, which changes the nested markers' actual
// appearance order in the output. A second pass therefore renumbers them
// differently: the nested [^1]/[^2] (and their [^1]:/[^2]: bodies) get swapped
// on the re-run, so reindex(reindex(doc)) !== reindex(doc). The code already
// re-derives order after orphan removal for the same class of reason, but not
// after block permutation.
// Scenario: reindex churns nested-in-definition marker numbers on a second run.
// pinned 2026-07-17, hunt-bugs consolidation.
// Provenance: iteration-1/eval-0/with_skill/run-1 (transforms hunt), lens: properties.

describe("bug: reindex not idempotent with markers nested in reordered definitions", () => {
    const doc = [
        "body[^b] text[^a].",
        "",
        "[^a]: has [^1] inside",
        "[^b]: has [^2] inside",
        "",
        "[^1]: one",
        "[^2]: two",
    ].join("\n");

    it.fails("reindex(reindex(doc)) === reindex(doc)", () => {
        const once = reindexFootnotes(doc);
        expect(reindexFootnotes(once)).toBe(once);
    });
});
