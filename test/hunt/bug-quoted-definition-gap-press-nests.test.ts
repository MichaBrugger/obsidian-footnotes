// Imported from the Kimi K3 cycle 1 hunt of 2026-09-16 (OpenCode worktree); 2 of 4 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";
import { fakeEditor as sharedFakeEditor, FakeEditor } from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";

// A quoted definition owns its continuation the way a column-0 one does:
// "> [^1]: x" followed by a blank ">" line and then an indented quoted
// line is ONE definition in Reading view (verified 2026-09-16, the
// quotedDefinitionEnd walk). But the walk the JUMP cascade uses to find
// "the definition above this quoted line" (quotedDefinitionAbove in
// navigation.ts) stops at the blank ">" line instead of stepping over it
// to the indented continuation. So a caret on the indented line is not
// seen as inside the definition - and the definition-interior guard
// (warnDefinitionCaretIfInside) only knows column-0 blocks, so nothing
// stops the press either.
//
// What the user sees: with the caret on the indented continuation line,
// pressing the numbered hotkey INSERTS a brand-new reference right into
// the middle of the existing footnote's body - a nested footnote, the
// thing ADR-0001 says is prevented plugin-wide - instead of jumping back
// to the footnote's reference the way a press on the blank line just
// above does.
//
// Source of truth: Reading view 2026-09-16 (quotedDefinitionEnd's
// docstring: the indented quoted line after the blank quote line belongs
// to the definition) + ADR-0001 (creation of nested footnotes is refused
// everywhere) + the two walkers' own inconsistency (the orphan rules
// treat lines 0-2 as one block; navigation treats the caret line as
// ordinary text).
//
// Settings involved: none (defaults; popup off so the landing is a jump).

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

const DOC = [
    "text[^1] here",
    "",
    "> [^1]: quoted definition",
    ">",
    ">     indented continuation",
];

describe("a press inside a quoted definition's continuation across a blank quote line", () => {
    it("does not nest a new footnote inside the definition (ADR-0001)", async () => {
        const doc = sharedFakeEditor(DOC, {
            cursor: { line: 4, ch: ">     indented".length },
            edits: true,
            wholeDoc: true,
        });
        await insertAutonumFootnote(fakePlugin(doc));
        // the press must refuse or jump - never insert into the definition body
        expect(doc.lines[4]).toBe(">     indented continuation");
        expect(doc.lines.join("\n")).not.toContain("[^2]");
    });

    it("jumps back to the reference, like a press on the label line", async () => {
        const doc = sharedFakeEditor(DOC, {
            cursor: { line: 4, ch: ">     indented".length },
            edits: true,
            wholeDoc: true,
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.moves).toContainEqual({ line: 0, ch: "text[^1]".length });
    });

    it("control: a press on the blank quote line between them DOES jump today", async () => {
        const doc = sharedFakeEditor(DOC, {
            cursor: { line: 3, ch: 1 },
            edits: true,
            wholeDoc: true,
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines.join("\n")).not.toContain("[^2]");
    });

    it("control: a press on the quoted continuation with NO blank line jumps today", async () => {
        const doc = sharedFakeEditor(
            ["text[^1] here", "", "> [^1]: quoted definition", "> continuation"],
            { cursor: { line: 3, ch: "> cont".length }, edits: true, wholeDoc: true },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines.join("\n")).not.toContain("[^2]");
    });
});
