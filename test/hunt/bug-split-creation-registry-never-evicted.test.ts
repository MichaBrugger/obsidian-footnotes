import { describe, expect, it } from "vitest";

import { quotedReference } from "../../src/parsing/footnote-grammar";
import { noteSplitCreation, undoOrphanMessage } from "../../src/editor/undo-orphan-notice";

// BUG: the list of creations the plugin split into two undo steps is a set
// that lives as long as Obsidian does, keyed on the lowercased footnote name
// and nothing else. Nothing is ever removed from it, and it knows nothing
// about which note a name came from, so one table-cell creation makes that
// name promising forever, everywhere.
//
// What the user would see: a wrong promise in a toast. Create a footnote
// inside a table cell once, then later, in any note, undo a definition of a
// footnote with the same name that the plugin never split (a hand-typed one,
// or the definition press of the named flow). The toast says "Undo again to
// remove the reference too", the user presses undo again, and the reference
// stays: the previous history step was something else entirely. Autonumbered
// cell creations are named "1", "2", "3", so the ordinary names are exactly
// the ones that get poisoned.
//
// Hunt: 2026-09-13. Lens: the undo notice.
//
// Source of truth: manual sheet 02 line ~11 and sheet 08 line ~15 - the
// sentence is reserved for creations the plugin itself split into two undo
// steps (2026-09-11); and the module's own stated intent above the set,
// "Only for those is 'undo again to remove the reference too' a promise the
// plugin can keep: the reference step is exactly the previous one."
//
// The names below carry the hunt date so that registering them cannot reach
// any other test file (the suite runs without isolating modules between
// files, and this registry is module-level state).

const SPLIT_IN_A_CELL = "hunt-leak-2026-09-13";
const NEVER_SPLIT = "hunt-plain-2026-09-13";

const refs = (names: string[]) => names.map(quotedReference).join(", ");

describe("the split-creation registry outlives the creation it describes", () => {
    it("a later undo of the same name that the plugin did not split gets no promise", () => {
        // one table-cell creation, in whatever note the user happened to be
        // in at the time
        noteSplitCreation(SPLIT_IN_A_CELL);
        // ... and from here on, every partial undo of a footnote with that
        // name is told a second undo will clear the reference
        expect(undoOrphanMessage([SPLIT_IN_A_CELL], refs([SPLIT_IN_A_CELL]))).toBe(
            `The undo removed the footnote definition, but the footnote reference "[^${SPLIT_IN_A_CELL}]" is still in the note.`,
        );
    });

    it("control: a name the plugin never split is only told the fact", () => {
        expect(undoOrphanMessage([NEVER_SPLIT], refs([NEVER_SPLIT]))).toBe(
            `The undo removed the footnote definition, but the footnote reference "[^${NEVER_SPLIT}]" is still in the note.`,
        );
    });

    it("control: one unsplit name among several keeps the promise out of the toast", () => {
        const names = [SPLIT_IN_A_CELL, NEVER_SPLIT];
        expect(undoOrphanMessage(names, refs(names))).not.toContain("Undo again");
    });
});
