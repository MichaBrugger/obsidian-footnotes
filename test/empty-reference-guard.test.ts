import { EditorPosition } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import { noticeCalls } from "./mocks/obsidian";

import FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
    pasteInlineFootnote,
} from "../src/commands/insert-or-navigate-footnotes";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

// QOL sweep (2026-08-07): any footnote command pressed with the caret inside
// an abandoned empty reference "[^]" warns ("give it a name") and leaves the
// caret in place, instead of the old per-command chaos: the named command
// hopped out past the bracket, and the numbered/inline commands — which
// never see "[^]" because the reference regexes require a non-empty name —
// nested a new insertion INTO it ("[^[^1]]", "[^^[]]"), corrupting the note.

function fakeEditor(lines: string[], cursor: EditorPosition): FakeEditor {
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
            enableRemoveBlankLastLines: true,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

// caret between the brackets of "[^]", where a first named press leaves it
const LINE = "word [^] more";
const INSIDE = { line: 0, ch: 7 };

describe("footnote commands inside an empty [^] reference", () => {
    it("numbered command warns instead of nesting [^N] into it", async () => {
        const doc = fakeEditor([LINE], { ...INSIDE });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(INSIDE);
    });

    it("named command warns instead of hopping the caret out", async () => {
        const doc = fakeEditor([LINE], { ...INSIDE });
        await insertNamedFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(INSIDE);
    });

    it("inline command warns instead of nesting ^[] into it", async () => {
        const doc = fakeEditor([LINE], { ...INSIDE });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(INSIDE);
    });

    it("paste command warns instead of nesting the clipboard into it", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { readText: async () => "clip" },
        });
        const doc = fakeEditor([LINE], { ...INSIDE });
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(INSIDE);
    });

    it("a caret outside the empty reference inserts normally", async () => {
        const doc = fakeEditor([LINE], { line: 0, ch: 0 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges.length).toBeGreaterThan(0);
    });

    // Originally these pinned that a code-masked "[^]" doesn't block the
    // INSERT (#41 parity). Since the protected-caret guard (Jason's rule
    // 2026-08-12) creation inside code is blocked outright — what survives
    // is that the EMPTY-REFERENCE toast never fires there; the block comes
    // from the protected-text guard instead.
    it("a [^] inside inline code never fires the empty-reference warning (#41 parity)", async () => {
        // "use `x [^] y` here" with the caret between the code span's brackets
        noticeCalls.length = 0;
        const line = "use `x [^] y` here";
        const doc = fakeEditor([line], { line: 0, ch: 9 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(emptyReferenceToastFired()).toBe(false);
        expect(protectedToastFired()).toBe(true);
    });

    it("a [^] inside a code fence never fires the empty-reference warning either", async () => {
        noticeCalls.length = 0;
        const doc = fakeEditor(["```", "a [^] b", "```"], { line: 1, ch: 4 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(emptyReferenceToastFired()).toBe(false);
        expect(protectedToastFired()).toBe(true);
    });
});

const emptyReferenceToastFired = () =>
    noticeCalls.some(
        (args) =>
            typeof args[0] === "string" &&
            args[0].includes("footnote reference is empty"),
    );
const protectedToastFired = () =>
    noticeCalls.some(
        (args) =>
            typeof args[0] === "string" &&
            args[0].includes("inside code, math"),
    );
