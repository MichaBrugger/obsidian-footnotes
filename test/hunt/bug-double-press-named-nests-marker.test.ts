import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";

import FootnotePlugin from "../../src/main";
import { createFootnoteReference } from "../../src/commands/create-footnote";

// BUG: pressing the named-footnote hotkey twice in a row (before typing a name)
// nests a second empty reference inside the first: "[^]" becomes "[^[^]]". The
// first press leaves "[^]" with the caret between the brackets; the second press
// falls all the way to createFootnoteReference, which blindly inserts another
// "[^]" at the caret. The empty "[^]" doesn't match AllReferences (which requires a
// non-empty name), so every earlier cascade step misses it. The inline command
// already handles the equivalent double-press by hopping the caret out; the
// named command has no guard.
// Scenario: double-pressing the named hotkey corrupts "[^]" into "[^[^]]".
// pinned 2026-07-17, hunt-bugs consolidation.
// Provenance: iteration-1/eval-1/without_skill/run-1 (bug sweep, BUG 5).

function fakePlugin(overrides: Record<string, unknown> = {}): FootnotePlugin {
    return sharedFakePlugin({
        insertAtEndOfWord: false,
        enablePopupEditor: false,
        ...overrides,
    });
}

describe("bug: double-pressing the named hotkey nests [^] references", () => {
    it("does not insert a second [^] inside the empty reference", () => {
        const line = "[^]";
        const doc = fakeEditor([line], { edits: true });
        // caret between the brackets, where the first press left it
        createFootnoteReference(line, { line: 0, ch: 2 }, fakePlugin(), doc);
        expect(doc.lines).toEqual([line]);
    });
});
