import { describe, expect, it } from "vitest";

// Setup check only: proves the vitest harness runs. Real unit tests are
// written TDD-style by the maintainer — see TESTING.md.
describe("test harness", () => {
    it("runs", () => {
        expect(1 + 1).toBe(2);
    });
});
