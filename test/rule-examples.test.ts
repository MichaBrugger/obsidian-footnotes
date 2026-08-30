import { describe, expect, it } from "vitest";

import { footnoteRules } from "../src/linting/rules";

// The registry's worked examples are EXECUTED, not just displayed: every
// example must round-trip through its rule's real apply, and the result
// must be settled (applying again changes nothing). This keeps the
// registry honest - an example that drifts from the transform fails here,
// and the registry itself stays load-bearing instead of decorative
// (surfaced by knip, 2026-08-10).

describe("rule registry", () => {
    it("has unique ids and at least one worked example per rule", () => {
        // guard against vacuity: an emptied registry would pass every
        // per-rule loop below by never running it (a Stryker survivor
        // pointed this out - the array-emptying mutant lived)
        expect(footnoteRules.length).toBeGreaterThan(0);
        const ids = footnoteRules.map((rule) => rule.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const rule of footnoteRules) {
            expect(rule.examples.length, rule.id).toBeGreaterThan(0);
        }
    });

    for (const rule of footnoteRules) {
        describe(rule.id, () => {
            for (const example of rule.examples) {
                it(example.description, () => {
                    const applied = rule.apply(example.before, example.options);
                    expect(applied).toBe(example.after);
                    // examples show settled output - a second pass is a no-op
                    expect(rule.apply(applied, example.options)).toBe(applied);
                });
            }
        });
    }
});
