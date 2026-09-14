import { beforeEach, describe, expect, it } from "vitest";

import { fakeEditor, FakeEditor } from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";
import { resetNotices } from "../helpers/notices";

import FootnotePlugin from "../../src/main";
import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";
import { docContext, referenceOccurrenceAtCursor } from "../../src/editor/doc-context";
import { shouldJumpFromReferenceToDefinition } from "../../src/commands/navigation";
import { renameTargetAtCursor } from "../../src/commands/rename-footnote";

// BUG: with the caret strictly inside the brackets of a COLUMN-0 lazy label,
// the press corrupts the line into "[^1[^2]]: lazy body" - a new reference
// written INSIDE the old one's brackets.
//
// The shape: a paragraph, then "[^1]: lazy body" directly under it (so
// Obsidian reads that line as plain paragraph text, not a definition), and
// the name "1" really is defined further down the note.
//
// Why: the caret lookup tests the RAW line first, and that first gate is
// asked with its default setting of "a label is a definition", which throws
// away any "[^x]" that sits at column 0 and is followed by a colon. Only past
// that gate does the lookup consult the document's own list of which lines
// really start a definition, the list that exists precisely so a lazy label's
// own "[^x]" counts as the live reference it is. A column-0 lazy label never
// gets that far, so the lookup returns nothing, the navigation step declines,
// and the press falls through to creation, which inserts at the caret.
//
// What the user would see: the line they were standing on turns into
// "[^1[^2]]: lazy body". The same note written inside a blockquote is fine,
// because a quoted label's "[^x]" does not start at column 0.
//
// Settings note: this pins the press with End-of-word adjustment OFF. With
// that setting at its default (on), a caret at ch 3 is nudged to the end of
// the word first and lands "[^1]:[^2] lazy body" - an unwanted footnote
// rather than corruption. By analysis a caret at ch 1 appears to corrupt the
// line even at the defaults, since there is no word to move past; that one
// still needs a live probe before it is claimed.
//
// Hunt: 2026-09-13. Lens: popup routing and the navigation cascade.
//
// Source of truth: the cascade's own step-3 comment in
// src/commands/insert-or-navigate-footnotes.ts, which says a press inside a
// reference must continue that footnote and never nest a new reference inside
// the brackets; the pin test/hunt/bug-double-press-named-nests-marker, which
// is the same rule for the empty "[^]" case; and the pin
// test/hunt/bug-lazy-label-reference-is-live, whose Reading-view ground truth
// (2026-09-09) is that this "[^1]" is a live reference.

const mixed = ["intro", "[^1]: lazy body", "", "[^1]: real body"];
const quoted = ["> intro", "> [^1]: lazy body", "", "[^1]: real body"];

const editorOf = (lines: string[], line: number, ch: number) =>
    fakeEditor(lines, { cursor: { line, ch }, wholeDoc: true });

function pressPlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            enablePopupEditor: false,
            insertAtEndOfWord: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

beforeEach(() => {
    resetNotices();
});

describe("the caret inside a column-0 lazy label's own reference", () => {
    it("control: rename sees it, in both spellings", () => {
        const flat = editorOf(mixed, 1, 3);
        expect(renameTargetAtCursor(flat, { line: 1, ch: 3 }, docContext(flat))).toBe("1");
        const quote = editorOf(quoted, 1, 5);
        expect(renameTargetAtCursor(quote, { line: 1, ch: 5 }, docContext(quote))).toBe("1");
    });

    it("control: the quoted spelling navigates to the real definition", () => {
        const doc = editorOf(quoted, 1, 5);
        expect(shouldJumpFromReferenceToDefinition(quoted[1], { line: 1, ch: 5 }, sharedFakePlugin({ enablePopupEditor: false }, doc), doc)).toBe(true);
        expect(doc.cursor.line).toBe(3);
    });

    it.fails("the shared caret lookup finds the reference at column 0 as well", () => {
        const doc = editorOf(mixed, 1, 3);
        expect(referenceOccurrenceAtCursor(mixed[1], { line: 1, ch: 3 }, doc)?.target.name).toBe("1");
    });

    it.fails("and the press does not write a new reference inside the old one's brackets", async () => {
        const doc = fakeEditor(mixed, { cursor: { line: 1, ch: 3 }, edits: true, wholeDoc: true });
        await insertAutonumFootnote(pressPlugin(doc));
        expect(doc.lines[1]).toBe("[^1]: lazy body");
    });
});
