// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 3 of 4 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";
import { lintFootnotes } from "../../src/linting/linter";

// A 32-deep chain of single-line definitions, each body referencing the
// next footnote, blocks in fully reversed order under one top-level
// reference. Renumbering settles by the stray name drifting ONE block per
// pass, so the fixpoint is 32 passes away - past the 30-iteration cap.
// The capped return is not a fixpoint: a second lint keeps renumbering
// (and lint-on-save would rewrite the note again on every save).

const chainDoc = (depth: number): string => {
    const blocks: string[] = [];
    for (let k = depth; k >= 1; k--) {
        blocks.push(k === depth ? `[^${depth}]: tail` : `[^${k}]: sees [^${k + 1}]`);
    }
    return `top[^1]\n\n${blocks.join("\n")}`;
};

describe("reindex fixpoint cap vs a deep nested-renumber chain", () => {
    const doc = chainDoc(32);

    it.fails("reindex is idempotent (f(f(doc)) === f(doc))", () => {
        const once = reindexFootnotes(doc);
        expect(reindexFootnotes(once)).toBe(once);
    });

    it.fails("reindex reaches the settled state in one call", () => {
        const once = reindexFootnotes(doc);
        // settled: blocks renumbered 1..32 in chain order, each body
        // referencing the next
        const settled = [
            "top[^1]",
            "",
            ...Array.from({ length: 32 }, (_, i) =>
                i === 31 ? `[^32]: tail` : `[^${i + 1}]: sees [^${i + 2}]`,
            ),
        ].join("\n");
        expect(once).toBe(settled);
    });

    it.fails("the full lint is idempotent on the same document", () => {
        const once = lintFootnotes(doc);
        expect(lintFootnotes(once)).toBe(once);
    });

    it("control: a 30-deep chain still settles exactly at the cap", () => {
        const once = reindexFootnotes(chainDoc(30));
        expect(reindexFootnotes(once)).toBe(once);
    });
});
