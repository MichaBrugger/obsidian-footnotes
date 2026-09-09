import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";

import { buildDefinitionAppend } from "../../src/commands/definition-append";

// Timing pin for review B2 (2026-09-09): the definition append's walk up
// from EOF, when the note ends inside an unclosed fence, comment, or math
// block, used to re-slice and re-scan the prefix once per line - quadratic
// on a long note with the opener near the top. scanDocument now records
// endsProtectedAt during its one walk. Under test/perf/ (excluded from the
// Stryker dry run, whose instrumented code is several times slower); the
// equivalence proof against the old prefix probe lives in
// test/hunt/spec-ends-protected-at.

describe("the append above an unclosed opener near the top of a long note", () => {
    it("is fast", () => {
        const lines = ["prose[^9]?", "", "text <!-- opens here"];
        for (let i = 0; i < 3000; i++) lines.push(`hidden line ${i}`);
        const doc = fakeEditor(lines, { cursor: { line: 0, ch: 0 }, wholeDoc: true });
        const started = performance.now();
        const { change } = buildDefinitionAppend(doc, "1", false, fakePlugin());
        const took = performance.now() - started;
        expect(change.from).toEqual({ line: 0, ch: "prose[^9]?".length });
        expect(took).toBeLessThan(150);
    });
});
