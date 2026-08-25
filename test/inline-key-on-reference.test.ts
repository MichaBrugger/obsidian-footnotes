import { EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import { fakeEditor as sharedFakeEditor, FakeEditor } from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

import FootnotePlugin from "../src/main";
import { navigateReferenceIfInside } from "../src/commands/insert-or-navigate-footnotes";

// QOL (2026-07-20), the reverse of the inline-footnote hop: pressing the
// INLINE footnote hotkey while the caret sits inside a numbered or named
// reference must not nest "^[]" into it ("[^na^[]med]" is invalid). The press
// behaves like the numbered/named hotkey instead: jump to the reference's
// definition, or create the definition when it is missing.

function fakeEditor(lines: string[], cursor: EditorPosition): FakeEditor {
    return sharedFakeEditor(lines, { cursor, edits: true });
}

function fakePlugin(): FootnotePlugin {
    return sharedFakePlugin({
        insertAtEndOfWord: false,
        enablePopupEditor: false,
        enableFootnotePrefix: false,
        enableFootnoteSectionHeading: false,
        footnoteSectionHeading: "",
        enableRemoveBlankLastLines: true,
    });
}

describe("navigateReferenceIfInside (inline hotkey on a regular reference)", () => {
    it("jumps to the definition when the caret is inside a reference that has one", () => {
        const doc = fakeEditor(["Alpha[^1] b", "", "[^1]: one"], {
            line: 0,
            ch: 7,
        });
        expect(navigateReferenceIfInside(fakePlugin(), doc, null)).toBe(true);
        // caret lands at the end of the definition, nothing was inserted
        expect(doc.cursor).toEqual({ line: 2, ch: "[^1]: one".length });
        expect(doc.lines).toEqual(["Alpha[^1] b", "", "[^1]: one"]);
    });

    it("creates the missing definition like the named hotkey would", () => {
        const doc = fakeEditor(["Alpha[^note] b"], { line: 0, ch: 8 });
        expect(navigateReferenceIfInside(fakePlugin(), doc, null)).toBe(true);
        expect(doc.lines).toEqual(["Alpha[^note] b", "", "[^note]: "]);
    });

    it("reports false when the caret is not inside any reference", () => {
        const doc = fakeEditor(["Alpha[^1] b", "", "[^1]: one"], {
            line: 0,
            ch: 2,
        });
        expect(navigateReferenceIfInside(fakePlugin(), doc, null)).toBe(false);
        expect(doc.lines).toEqual(["Alpha[^1] b", "", "[^1]: one"]);
    });

    it("a caret just past the closing bracket is outside (issue #49 parity)", () => {
        const doc = fakeEditor(["Alpha[^1] b", "", "[^1]: one"], {
            line: 0,
            ch: 9,
        });
        expect(navigateReferenceIfInside(fakePlugin(), doc, null)).toBe(false);
    });

    it("a reference inside inline code is plain text (issue #41 parity)", () => {
        const doc = fakeEditor(["code `x [^1] y` end", "", "[^1]: one"], {
            line: 0,
            ch: 10,
        });
        expect(navigateReferenceIfInside(fakePlugin(), doc, null)).toBe(false);
        expect(doc.lines).toEqual(["code `x [^1] y` end", "", "[^1]: one"]);
    });
});
