import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// With keepOrphanedDefinitions:false, a 21-deep chain of definitions each referencing the next is NOT fully deleted in one call - deletion resumes on the next call (non-idempotent).
// Hunt: 2026-08-09. Lens: properties.
// Root cause: the reindexOnce fixpoint loop caps at 20 iterations, and a transitive-orphan chain exposes only one new orphan per pass, so depth 21+ never converges in a single call.

describe("fixed 2026-08-10: transitive-orphan chains outrun the 20-iteration reindex fixpoint cap", () => {
    const chain = (depth: number) =>
        Array.from({ length: depth }, (_, i) =>
            i === depth - 1
                ? `[^${depth}]: end`
                : `[^${i + 1}]: uses[^${i + 2}]`,
        ).join("\n");
    const dropOrphans = { keepOrphanedDefinitions: false };

    it("a 21-deep chain is fully deleted in ONE call (transitive promise)", () => {
        const doc = `para.\n\n${chain(21)}`;
        expect(reindexFootnotes(doc, dropOrphans)).toBe("para.");
    });

    it("orphan deletion is idempotent on a 25-deep chain", () => {
        const doc = `para.\n\n${chain(25)}`;
        const once = reindexFootnotes(doc, dropOrphans);
        expect(reindexFootnotes(once, dropOrphans)).toBe(once);
    });
});
