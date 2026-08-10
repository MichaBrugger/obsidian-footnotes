import { describe, expect, it } from "vitest";

import { computeNextFootnoteNumber } from "../../src/insert-or-navigate-footnotes";

// With an existing [^9007199254740991] (MAX_SAFE_INTEGER), the autonumber mints 9007199254740992, which later scans skip via the isSafeInteger guard, so the NEXT press mints the same id AGAIN — duplicate footnote ids.
// Hunt: 2026-08-10. Lens: regressions.
// Root cause: computeNextFootnoteNumber increments the largest scanned id without checking Number.isSafeInteger on the result, while the scan side's isSafeInteger guard can never see the minted id.

describe("bug: autonumber increments MAX_SAFE_INTEGER into an unsafe, unrescanable id", () => {
    it.fails("does not reuse the first id created after MAX_SAFE_INTEGER", () => {
        const original = `real[^${Number.MAX_SAFE_INTEGER}]`;
        const first = computeNextFootnoteNumber(original);
        const afterFirstCreation =
            `${original} next[^${first}]\n\n[^${first}]: next`;

        expect(computeNextFootnoteNumber(afterFirstCreation)).not.toBe(first);
    });
});
