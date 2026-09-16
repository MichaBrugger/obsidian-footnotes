import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";

import { renameTargetAtCursor, renameTargetInSelection } from "../../src/commands/rename-footnote";

// Found by the release workflow's property run on the 0.2.0 tag
// (2026-09-12, fast-check seed -1547175367): a caret on a definition label
// that sits inside a %% block comment was offered "93" as a rename target,
// although the label is dead there (a definition inside a %% block is not
// a definition to Obsidian, and the plugin renames nothing inside a block
// comment). The right-click menu would show "Rename footnote" on it, and
// the command would then have nothing to rename. Nothing inside a block
// comment is a rename target.

const LINES = [
    "---",
    "footnote-prefix: 4_",
    "---",
    "---",
    "",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "",
    "%%",
    "[^93]: commented label",
    "%%",
];

// REVERSED 2026-09-15 (Jason's ruling A1): Obsidian counts a commented
// label's own "[^93]" as a live reference (Reading view gives the real
// definition a second back-arrow), so the label IS a rename target, the
// way a lazy label is. The 2026-09-12 fix that called it dead is undone.
describe("a label inside a %% block comment is a rename target, through its own reference", () => {
    it("the caret rule offers the name inside the brackets, and nothing outside them", () => {
        const doc = fakeEditor(LINES, { wholeDoc: true });
        expect(renameTargetAtCursor(doc, { line: 8, ch: 3 })).toBe("93");
        expect(renameTargetAtCursor(doc, { line: 8, ch: 24 })).toBeNull();
    });

    it("the selection rule offers it too", () => {
        const doc = fakeEditor(LINES, { wholeDoc: true });
        expect(renameTargetInSelection(doc, { line: 8, ch: 0 }, { line: 8, ch: 6 })).toBe("93");
    });

    it("a lazy label under a comment-only line is paragraph text, so its own [^x] is a live reference and a target", () => {
        // the shape the property soak found after the fix above (2026-09-12):
        // "%% c %%" is a paragraph line, the label under it is lazy, and a
        // lazy label's "[^94]" is the live reference it really is - so
        // offering "94" is right, and it was the property's oracle that
        // had to learn the rule
        const lines = ["%% c %%", "[^94]: lazy under a comment line"];
        const doc = fakeEditor(lines, { wholeDoc: true });
        expect(renameTargetAtCursor(doc, { line: 1, ch: 3 })).toBe("94");
    });

    it("a hidden reference inside the block still is one, since Obsidian binds it", () => {
        const lines = [...LINES.slice(0, 7), "%%", "hidden[^93] reference", "%%", "", "[^93]: the definition"];
        const doc = fakeEditor(lines, { wholeDoc: true });
        expect(renameTargetAtCursor(doc, { line: 8, ch: 9 })).toBe("93");
    });
});
