import { describe, expect, it } from "vitest";

import { verifyLiveFootnoteInsertion } from "../src/editor/insertion-liveness";

// Direct pins for the shared born-dead verdict (extracted 2026-08-25).
// The call sites' behavior is pinned elsewhere (command-properties,
// mutation-hardening-creation, selection-to-footnote); these hit the
// helper's OWN contract — each refusal case below kills a mutant the
// 2026-08-25 scoped Stryker run showed surviving when only the call
// sites were tested: the definition must start at EXACTLY the given
// label line AND claim every seeded body line, and EVERY reference must
// parse at EXACTLY its anchor under EXACTLY the given name.

const LINES = ["alpha bravo", "", "tail"];
// appends "\n\n[^1]: " after "tail" — label lands on simulated line 4
const DEFINITION_APPEND = { from: { line: 2, ch: 4 }, text: "\n\n[^1]: " };

describe("verifyLiveFootnoteInsertion", () => {
    it("a live reference with its live definition verifies, anchor exact", () => {
        const verified = verifyLiveFootnoteInsertion({
            lines: LINES,
            changes: [
                { from: { line: 0, ch: 5 }, text: "[^1]" },
                DEFINITION_APPEND,
            ],
            referenceChangeIndices: [0],
            footnoteId: "1",
            definitionLabelLine: 4,
        });
        expect(verified).not.toBeNull();
        expect(verified?.anchors).toEqual([{ line: 0, ch: 5 }]);
    });

    it("refuses when no definition block starts at the given label line", () => {
        const verified = verifyLiveFootnoteInsertion({
            lines: LINES,
            changes: [
                { from: { line: 0, ch: 5 }, text: "[^1]" },
                DEFINITION_APPEND,
            ],
            referenceChangeIndices: [0],
            footnoteId: "1",
            // the label really lands on line 4 — a block that merely ENDS
            // past line 3 must not count as starting there
            definitionLabelLine: 3,
        });
        expect(verified).toBeNull();
    });

    it("a seeded continuation line claimed by the block verifies", () => {
        const verified = verifyLiveFootnoteInsertion({
            lines: LINES,
            changes: [
                { from: { line: 0, ch: 5 }, text: "[^1]" },
                { from: { line: 2, ch: 4 }, text: "\n\n[^1]: one\n    two" },
            ],
            referenceChangeIndices: [0],
            footnoteId: "1",
            definitionLabelLine: 4,
            definitionBodyExtraLines: 1,
        });
        expect(verified).not.toBeNull();
    });

    it("refuses when a seeded body line falls OUT of the block", () => {
        const verified = verifyLiveFootnoteInsertion({
            lines: LINES,
            changes: [
                { from: { line: 0, ch: 5 }, text: "[^1]" },
                // the second body line is a heading, which no definition
                // block can claim — the block ends on the label line
                { from: { line: 2, ch: 4 }, text: "\n\n[^1]: one\n# two" },
            ],
            referenceChangeIndices: [0],
            footnoteId: "1",
            definitionLabelLine: 4,
            definitionBodyExtraLines: 1,
        });
        expect(verified).toBeNull();
    });

    it("refuses a reference landing inside inline code", () => {
        const verified = verifyLiveFootnoteInsertion({
            lines: ["alpha `code` bravo", "", "tail"],
            changes: [
                { from: { line: 0, ch: 8 }, text: "[^1]" },
                DEFINITION_APPEND,
            ],
            referenceChangeIndices: [0],
            footnoteId: "1",
            definitionLabelLine: 4,
        });
        expect(verified).toBeNull();
    });

    it("one dead landing refuses the lot — EVERY reference must be live", () => {
        const verified = verifyLiveFootnoteInsertion({
            lines: ["alpha bravo", "`code x`", "tail"],
            changes: [
                { from: { line: 0, ch: 5 }, text: "[^1]" },
                { from: { line: 1, ch: 3 }, text: "[^1]" },
                DEFINITION_APPEND,
            ],
            referenceChangeIndices: [0, 1],
            footnoteId: "1",
            definitionLabelLine: 4,
        });
        expect(verified).toBeNull();
    });

    it("refuses when the occurrence does not sit EXACTLY at its anchor", () => {
        const verified = verifyLiveFootnoteInsertion({
            lines: LINES,
            changes: [
                // leading space: the reference parses one column past the
                // change's anchor, which is not the insertion promised
                { from: { line: 0, ch: 5 }, text: " [^1]" },
                DEFINITION_APPEND,
            ],
            referenceChangeIndices: [0],
            footnoteId: "1",
            definitionLabelLine: 4,
        });
        expect(verified).toBeNull();
    });

    it("refuses when the parsed name is not the promised id", () => {
        const verified = verifyLiveFootnoteInsertion({
            lines: LINES,
            changes: [
                { from: { line: 0, ch: 5 }, text: "[^2]" },
                DEFINITION_APPEND,
            ],
            referenceChangeIndices: [0],
            footnoteId: "1",
            definitionLabelLine: 4,
        });
        expect(verified).toBeNull();
    });
});
