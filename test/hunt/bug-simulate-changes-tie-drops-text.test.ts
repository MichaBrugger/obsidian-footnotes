import { describe, expect, it } from "vitest";
import type { EditorChange } from "obsidian";

import {
    simulateChanges,
    simulatedAnchor,
} from "../../src/editor/insertion-liveness";

// BUG (hunt 2026-08-25, offsets lens; skeptic-confirmed against real
// @codemirror/state 6.5.0): when two changes TIE at the same `from` and
// the LOWER-index change is a replace (to > from) while a HIGHER-index
// change there is a zero-length insert, simulateChanges resolves the
// replace's stale `to` against the already-mutated string and slices
// into the just-inserted text — one character of the insert is dropped
// and one character of the replaced range survives. CM6 ground truth
// (verified empirically, both array orders): NO text is ever lost, and
// the zero-length insert's text lands BEFORE the replacement text.
// Blast radius: real doc.transaction goes to real CM6 (shipped
// documents are NOT corrupted — the hunt's command-level "corruption"
// repro was a fake-editor artifact, since the shared fake deliberately
// applies edits through this very function), but the born-dead verdict
// and the cursor/afterReference landings ARE computed from the corrupt
// simulation, so a tie-shaped press (e.g. a {0,0} selection conversion
// whose section heading triggers the phantom-frontmatter prepend) can
// misjudge liveness or land the caret wrong.

const TIE: EditorChange[] = [
    { from: { line: 0, ch: 4 }, to: { line: 0, ch: 5 }, text: "AAAAA" },
    { from: { line: 0, ch: 4 }, text: "BBBBB" },
];

describe("same-from tie between a replace and a zero-length insert", () => {
    it("simulateChanges preserves every character, insert before replace (CM6 semantics)", () => {
        expect(simulateChanges(["....."], TIE)).toEqual(["....BBBBBAAAAA"]);
    });

    it("simulatedAnchor reports where the insert's text actually lands", () => {
        const simulated = simulateChanges(["....."], TIE);
        const anchor = simulatedAnchor(["....."], TIE, 1, simulated);
        // the insert's marker must be findable intact, exactly at the anchor
        const flat = simulated.join("\n");
        expect(flat).toContain("BBBBB");
        expect(anchor).toEqual({ line: 0, ch: 4 });
    });
});
