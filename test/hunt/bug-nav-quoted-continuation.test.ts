// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 2 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";

import {
    createAutonumFootnote,
    createMatchingFootnoteDefinition,
} from "../../src/commands/create-footnote";
import {
    shouldJumpFromDefinitionToReference,
    shouldJumpFromReferenceToDefinition,
} from "../../src/commands/navigation";
import { docContext } from "../../src/editor/doc-context";

// What a user sees: the note has a blockquoted definition "> [^1]: quoted def"
// with a continuation line ">     cont line", and a matching reference. The
// caret sits on the continuation line and the footnote hotkey is pressed. On a
// column-0 definition's continuation line the press jumps back to the
// reference. Here it inserts a brand-new "[^2]" INTO the continuation line and
// appends a "[^2]:" definition: a footnote nested inside another footnote's
// definition, which the plugin refuses everywhere else (Jason's ruling
// 2026-08-13: no footnotes inside definitions).
//
// Root: shouldJumpFromDefinitionToReference's cheap check
// (definitionLabelIn null + the line does not start with whitespace) drops the
// press before the document scan runs, and warnDefinitionCaretIfInside only
// consults ctx.blocks(), which never covers quoted definitions (case C22), so
// the creation step fires. Same guard class as
// bug-quoted-definition-invisible-to-rename-and-selection.

const LINES = ["body[^1]", "", "> [^1]: quoted def", ">     cont line"];
const CURSOR = { line: 3, ch: 8 };

/** The numbered-command cascade, minus the guards that do not apply here. */
function press(doc: ReturnType<typeof fakeEditor>): boolean {
    const plugin = fakePlugin({});
    const lineText = LINES[CURSOR.line];
    const ctx = docContext(doc);
    return (
        shouldJumpFromDefinitionToReference(lineText, CURSOR, plugin, doc, ctx) ||
        shouldJumpFromReferenceToDefinition(lineText, CURSOR, plugin, doc, ctx) ||
        createMatchingFootnoteDefinition(lineText, CURSOR, plugin, doc, ctx) ||
        createAutonumFootnote(lineText, CURSOR, plugin, doc, null, ctx)
    );
}

describe("a press on a quoted definition's continuation line", () => {
    it.fails("never nests a new footnote inside the quoted definition", () => {
        const doc = fakeEditor(LINES, { cursor: CURSOR, edits: true });
        const handled = press(doc);
        expect(handled).toBe(true);
        expect(doc.lines).toEqual(LINES);
    });

    it.fails("jumps back to the reference, like a column-0 continuation line", () => {
        const doc = fakeEditor(LINES, { cursor: CURSOR, edits: true });
        press(doc);
        expect(doc.moves).toEqual([{ line: 0, ch: 8 }]);
    });
});
