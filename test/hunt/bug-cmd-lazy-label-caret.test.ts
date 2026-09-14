// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 3 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
} from "../../src/commands/insert-or-navigate-footnotes";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";

// A user puts the caret on the "[^1]" of a LAZY label line (a label-shaped
// line directly under a paragraph: "prose" then "[^1]: lazy body" with no
// blank line between) and presses a footnote key. That "[^1]" is a LIVE
// reference - it renders as a superscript resolving to the real definition
// (pinned in bug-lazy-label-reference-is-live) - so the press must navigate
// to "[^1]: real body", like any other press on a live reference. Instead
// referenceOccurrenceAtCursor's RAW gate runs footnoteReferenceMatches with
// the default labelIsDefinition=true, the column-0 label exclusion swallows
// the lazy line's only match, and the masked re-check that carries the
// correct flag never runs. The press falls through to CREATION and inserts
// the new footnote INTO the brackets: safeInsertionCh nudges left of the
// "^", landing "[^2]" (or "[^]", "^[]") between "[" and "^1]":
// "[[^2]^1]: lazy body" - the live reference is mangled into dangling
// "^1]" text, with no notice. The born-dead verification passes because
// the inserted text itself reads live; it cannot see that the reference
// around it was destroyed.

function fakeEditor(lines: string[], cursor: { line: number; ch: number }): FakeEditor {
    return sharedFakeEditor(lines, { cursor, edits: true, wholeDoc: true });
}

function fakePlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

const LINES = ["prose", "[^1]: lazy body", "", "[^1]: real body"];

describe("a caret on a lazy label line's live reference", () => {
    it.fails("numbered: jumps to the real definition instead of nesting inside the reference", async () => {
        const doc = fakeEditor(LINES, { line: 1, ch: 2 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.transactions).toBe(0);
        expect(doc.getCursor()).toEqual({ line: 3, ch: "[^1]: real body".length });
        expect(doc.lines.join("\n")).toBe(LINES.join("\n"));
    });

    it.fails("named: jumps to the real definition instead of planting a placeholder inside the reference", async () => {
        const doc = fakeEditor(LINES, { line: 1, ch: 2 });
        await insertNamedFootnote(fakePlugin(doc));
        expect(doc.transactions).toBe(0);
        expect(doc.getCursor()).toEqual({ line: 3, ch: "[^1]: real body".length });
        expect(doc.lines.join("\n")).toBe(LINES.join("\n"));
    });

    it.fails("inline: jumps to the real definition instead of wrapping a placeholder inside the reference", async () => {
        const doc = fakeEditor(LINES, { line: 1, ch: 2 });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.transactions).toBe(0);
        expect(doc.getCursor()).toEqual({ line: 3, ch: "[^1]: real body".length });
        expect(doc.lines.join("\n")).toBe(LINES.join("\n"));
    });
});
