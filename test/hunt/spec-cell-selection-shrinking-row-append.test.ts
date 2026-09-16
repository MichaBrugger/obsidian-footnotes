// Imported from the Kimi K3 cycle 3 hunt of 2026-09-16 (OpenCode worktree); 1 of 1 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { describe, expect, it } from "vitest";

import { fakeEditor as sharedFakeEditor } from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";
import { convertCellSelectionToNamed } from "../../src/commands/selection-footnote";
import type { TableCellEditor } from "../../src/editor/table-cursor";

// SPEC QUESTION: the shrinking twin of bug-cell-selection-stale-append.
// When the selection inside the cell is LONGER than the reference that
// replaces it ("some long text" to "[^note1]"), the note's last row ends
// up SHORTER than the DocContext's stale copy measured it, and the
// definition's append position lands PAST the row's new end - an offset
// CodeMirror may clamp (the definition lands at the row's end, harmless)
// or reject (the transaction fails, the conversion half-lands). The fake
// editor's simulator maps any over-long position to the string's end, so
// the unit layer cannot distinguish the two.
//
// NEEDS A LIVE CHECK (smoke suite): a note ending in a table, a
// multi-character cell selection converted with the named or numbered
// key - does the definition land below the row, or does the press error
// out / mis-land? The growing-row twin (one character converted) is
// pinned as bug-cell-selection-stale-append with real corruption in the
// same fake.
//
// Source of truth: the pinned createAutonumFootnote fix (the note must be
// re-read after the cell's write-back) - the stale read is wrong either
// way; only the visible failure mode is in question. Settings involved:
// defaults.

function syncingCell(
    doc: ReturnType<typeof sharedFakeEditor>,
    rowLine: number,
    cellFrom: number,
    cellTo: number,
    text: string,
    head: number,
    anchor: number,
): TableCellEditor {
    let cellText = text;
    return {
        state: {
            doc: { toString: () => cellText },
            selection: { main: { head, anchor } },
        },
        dispatch: (spec) => {
            if (spec.changes) {
                const { from, to, insert } = spec.changes;
                cellText = cellText.slice(0, from) + insert + cellText.slice(to ?? from);
            }
            const row = doc.lines[rowLine];
            doc.lines[rowLine] = row.slice(0, cellFrom) + cellText + row.slice(cellTo);
        },
    };
}

describe("spec: a cell selection conversion that SHRINKS the note's last row", () => {
    it("the definition's append position is not stale: within the new row's length", () => {
        const lines = ["intro", "", "| a | x |", "| --- | --- |", "| b | some long text |"];
        const doc = sharedFakeEditor(lines, { wholeDoc: true, edits: true, cursor: { line: 4, ch: 7 } });
        const cell = syncingCell(doc, 4, 6, 20, "some long text", 5, 0);
        convertCellSelectionToNamed(
            sharedFakePlugin(
                {
                    insertAtEndOfWord: false,
                    enablePopupEditor: false,
                    enableFootnotePrefix: false,
                    enableFootnoteSectionHeading: false,
                    lintOnFootnoteCreation: false,
                },
                doc,
            ),
            doc,
            cell,
            { from: 0, to: 14, text: "some long text", lead: "" },
            "note1",
        );
        // the row is now 16 characters long ("| b | [^note1] |"); every
        // change the press asked for must land inside it or below it
        for (const change of doc.appliedChanges) {
            expect(change.from.ch).toBeLessThanOrEqual(doc.lines[change.from.line].length);
        }
    });
});
