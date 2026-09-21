import { beforeEach, describe, expect, it } from "vitest";

import { fakeEditor } from "./helpers/fake-editor";
import { fakePlugin } from "./helpers/fake-plugin";
import { messages, noticed, resetNotices } from "./helpers/notices";
import { insertAutonumFootnote } from "../src/commands/insert-or-navigate-footnotes";

// These tests take over five checks that used to sit on manual sheet 05
// ("Navigation"). Each one is something a machine can look at, so it no
// longer needs Jason sitting in front of the real Obsidian window:
//
//  1. "'Nothing references this footnote' toast, caret stays, NOTHING
//     inserted" (the orphan definition at the bottom of the sheet)
//  2. "Same on its indented continuation line"
//  3. "The multi-line definition below lands the caret at the end of its
//     LAST continuation line"
//  4. the uppercase half of "Colon and uppercase names navigate to the
//     right definition" (the colon half is already pinned by
//     test/colon-in-name.test.ts, and the popup binding by the smoke
//     scenario "popup binds to a named footnote with ':' in the name")
//  5. "Caret in bravo[^lb], numbered key: lands at the end of the
//     indented line, nothing appended"
//
// What stays on the sheet is the part only eyes can settle: whether a
// jump leaves the caret CENTERED in the viewport, and whether the popup
// binds to a definition written inside a list item.
//
// Every test below drives the real command entry point
// (insertAutonumFootnote, what the numbered hotkey runs), so it exercises
// the same decision cascade a real press does. The "fake editor" is a
// stand-in for Obsidian's editor: it holds the note as an array of lines,
// applies whatever edits the plugin asks for, and records every place the
// plugin moved the caret to in `moves`.

/** The note as an editor the commands can drive: it can be read whole, it can be edited, and the caret starts where the test says. */
function noteAt(lines: string[], line: number, ch: number) {
    return fakeEditor(lines, {
        wholeDoc: true,
        edits: true,
        cursor: { line, ch },
    });
}

/** The sheet's settings: defaults, with the popup off (the classic jump). */
const settings = { enablePopupEditor: false, insertAtEndOfWord: false };

beforeEach(resetNotices);

describe("a footnote nothing references (sheet 05, the orphan section)", () => {
    // The definition at the very bottom of the sheet, with the
    // continuation line underneath it.
    const NOTE = [
        "Filler so the jumps travel; scroll matters here.",
        "",
        "[^orphan]: no reference anywhere uses this definition, on purpose",
        "    its continuation line behaves the same way",
    ];
    // The advice half of the toast names the footnote in quotes, the same
    // way every other toast spells a reference.
    const TOAST =
        'Nothing references this footnote. Add a "[^orphan]" reference in the text, or delete the definition.';

    it("the press on the label line explains itself, moves nothing and inserts nothing", async () => {
        const doc = noteAt(NOTE, 2, NOTE[2].length);
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(noticed(TOAST)).toBe(true);
        expect(doc.lines).toEqual(NOTE);
        expect(doc.cursor).toEqual({ line: 2, ch: NOTE[2].length });
        expect(doc.moves).toEqual([]);
    });

    it("the press on the indented continuation line behaves the same way", async () => {
        const doc = noteAt(NOTE, 3, 10);
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(noticed(TOAST)).toBe(true);
        expect(doc.lines).toEqual(NOTE);
        expect(doc.cursor).toEqual({ line: 3, ch: 10 });
        expect(doc.moves).toEqual([]);
    });
});

describe("jumping to a multi-line definition (sheet 05)", () => {
    // the sheet's own fixture, definition and trailing use together
    const NOTE = [
        "A trailing use so the multi-line definition jumps: from me[^multiline].",
        "",
        "[^multiline]: this definition has continuation lines",
        "    the caret should land at the end",
        "    of this very last line, right here",
    ];

    it("the caret lands at the end of the LAST continuation line", async () => {
        // caret inside the "[^multiline]" reference
        const inside = NOTE[0].indexOf("[^multiline]") + 3;
        const doc = noteAt(NOTE, 0, inside);
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines).toEqual(NOTE);
        expect(doc.moves).toEqual([{ line: 4, ch: NOTE[4].length }]);
    });
});

describe("uppercase footnote names navigate both ways (sheet 05)", () => {
    const NOTE = [
        "Jump from an uppercase name[^Chapter] here.",
        "",
        "[^Chapter]: uppercase names are stored lowercased internally",
    ];
    const reference = NOTE[0].indexOf("[^Chapter]");

    it("the reference jumps to the end of its definition", async () => {
        const doc = noteAt(NOTE, 0, reference + 3);
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines).toEqual(NOTE);
        expect(doc.moves).toEqual([{ line: 2, ch: NOTE[2].length }]);
    });

    it("the definition jumps back to the reference", async () => {
        const doc = noteAt(NOTE, 2, 5);
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines).toEqual(NOTE);
        expect(doc.moves).toEqual([
            { line: 0, ch: reference + "[^Chapter]".length },
        ]);
    });

    it("a definition labelled in a different case is still the same footnote", async () => {
        // this is what "stored lowercased internally" means in practice:
        // the press must find the lower-case definition and navigate to
        // it, never mint a second one
        const mixed = [NOTE[0], NOTE[1], "[^chapter]: the same footnote"];
        const doc = noteAt(mixed, 0, reference + 3);
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines).toEqual(mixed);
        expect(doc.moves).toEqual([{ line: 2, ch: mixed[2].length }]);
    });
});

describe("a definition indented to a list item's margin (sheet 05, ruling 1)", () => {
    // the sheet's own list-item fixture
    const NOTE = [
        "- [^la]: a definition written right after the list marker",
        "- item two",
        "",
        "- item three",
        "",
        "    [^lb]: a definition indented to the item's margin (four spaces)",
        "",
        "Uses: alpha[^la] and bravo[^lb].",
    ];

    it("the numbered key on bravo[^lb] lands at the end of the indented line and appends nothing", async () => {
        const inside = NOTE[7].indexOf("[^lb]") + 3;
        const doc = noteAt(NOTE, 7, inside);
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines).toEqual(NOTE);
        expect(doc.moves).toEqual([{ line: 5, ch: NOTE[5].length }]);
        // no toast either: this is an ordinary jump, not a refusal
        expect(messages()).toEqual([]);
    });
});
