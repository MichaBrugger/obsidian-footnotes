import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";

import { renameTargetInSelection } from "../../src/commands/rename-footnote";

// Jason's phone pass, sheet 24 (2026-09-11): a long press on "[^menu]" opened
// Obsidian's menu with only its own "Delete footnote and reference"; the
// plugin's "Rename footnote" was missing, and a long press on a definition
// label opened no menu at all. On a phone a long press SELECTS the word it
// lands on, so the caret sits at the selection's end - on the "]" of the
// reference or after the label's name - and the menu gate, which asked for
// a caret strictly inside a reference, said no. The gate (and the command
// the menu item runs) now look at the whole selection: a reference or a
// definition label the selection overlaps is the target.

const LINES = ["Fixture reference[^menu] for the long-press check.", "", "[^menu]: the definition"];

describe("the rename target under a selection", () => {
    it("a selection covering the whole reference, brackets included", () => {
        const doc = fakeEditor(LINES, { wholeDoc: true });
        expect(renameTargetInSelection(doc, { line: 0, ch: 17 }, { line: 0, ch: 24 })).toBe("menu");
    });

    it("a selection of just the name inside the brackets", () => {
        const doc = fakeEditor(LINES, { wholeDoc: true });
        expect(renameTargetInSelection(doc, { line: 0, ch: 19 }, { line: 0, ch: 23 })).toBe("menu");
    });

    it("a selection that merely touches the reference's edge is no target, an overlapping one is", () => {
        const doc = fakeEditor(LINES, { wholeDoc: true });
        expect(renameTargetInSelection(doc, { line: 0, ch: 0 }, { line: 0, ch: 17 })).toBeNull();
        expect(renameTargetInSelection(doc, { line: 0, ch: 8 }, { line: 0, ch: 28 })).toBe("menu");
    });

    it("a selection on the definition's label, whole or partial", () => {
        const doc = fakeEditor(LINES, { wholeDoc: true });
        expect(renameTargetInSelection(doc, { line: 2, ch: 0 }, { line: 2, ch: 8 })).toBe("menu");
        expect(renameTargetInSelection(doc, { line: 2, ch: 2 }, { line: 2, ch: 6 })).toBe("menu");
    });

    it("a selection in the definition's body, or on plain prose, is no target", () => {
        const doc = fakeEditor(LINES, { wholeDoc: true });
        expect(renameTargetInSelection(doc, { line: 2, ch: 9 }, { line: 2, ch: 12 })).toBeNull();
        expect(renameTargetInSelection(doc, { line: 0, ch: 25 }, { line: 0, ch: 28 })).toBeNull();
    });

    it("a collapsed selection is the plain caret rule, and the ends may come in either order", () => {
        const doc = fakeEditor(LINES, { wholeDoc: true });
        expect(renameTargetInSelection(doc, { line: 0, ch: 20 }, { line: 0, ch: 20 })).toBe("menu");
        expect(renameTargetInSelection(doc, { line: 0, ch: 24 }, { line: 0, ch: 24 })).toBeNull();
        expect(renameTargetInSelection(doc, { line: 0, ch: 24 }, { line: 0, ch: 17 })).toBe("menu");
    });
});
