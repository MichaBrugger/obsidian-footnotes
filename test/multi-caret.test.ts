import { EditorPosition } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeCalls } from "./mocks/obsidian";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

import FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
    pasteInlineFootnote,
} from "../src/commands/insert-or-navigate-footnotes";
import { MultiCaretFootnoteNotice } from "../src/commands/multi-caret";
import { DefinitionCreationNotice } from "../src/commands/press-guards";
import { ProtectedCreationNotice } from "../src/editor/insertion-liveness";

// Multiple Alt-clicked carets get the SAME footnote at every one
// (2026-08-22, Jason's ask — one source cited many times; always on, no
// toggle, atomic refusal, his calls). The autonum key mints one "[^N]"
// per caret and ONE definition; named/inline/paste drop their skeleton at
// each caret, with cursors left inside the brackets so typing fills all
// of them at once. These pin the transaction shapes; the live
// multi-cursor typing is smoke/manual territory.

function fakeEditor(lines: string[], carets: EditorPosition[]): FakeEditor {
    return sharedFakeEditor(lines, {
        carets,
        edits: true,
        wholeDoc: true,
        words: true,
    });
}

type Settings = Partial<FootnotePlugin["settings"]>;

function fakePlugin(doc: FakeEditor, settings: Settings = {}): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
            ...settings,
        },
        doc,
    );
}

beforeEach(() => {
    noticeCalls.length = 0;
});
afterEach(() => {
    vi.unstubAllGlobals();
});

const noticed = (message: string) =>
    noticeCalls.some((args) => args[0] === message);

describe("the auto-numbered key at several carets", () => {
    it("inserts the SAME reference at every caret with ONE definition", async () => {
        const doc = fakeEditor(
            ["alpha bravo charlie", "delta echo"],
            [
                { line: 0, ch: 5 },
                { line: 0, ch: 11 },
                { line: 1, ch: 5 },
            ],
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "alpha[^1] bravo[^1] charlie",
            "delta[^1] echo",
            "",
            "[^1]: ",
        ]);
        // the caret jumps to the one definition, like a single-caret insert
        expect(doc.cursor).toEqual({ line: 3, ch: "[^1]: ".length });
        expect(doc.transactions).toBe(1);
    });

    it("numbers past existing footnotes, and carets can come UNSORTED", async () => {
        const doc = fakeEditor(
            ["word here more[^1]", "", "[^1]: a"],
            [
                { line: 0, ch: 9 },
                { line: 0, ch: 4 },
            ],
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "word[^2] here[^2] more[^1]",
            "",
            "[^1]: a",
            "[^2]: ",
        ]);
    });

    it("end-of-word hops every caret, and same-word carets collapse to ONE insert", async () => {
        const doc = fakeEditor(
            ["alpha bravo"],
            [
                { line: 0, ch: 1 },
                { line: 0, ch: 3 },
                { line: 0, ch: 8 },
            ],
        );
        await insertAutonumFootnote(
            fakePlugin(doc, { insertAtEndOfWord: true }),
        );
        expect(doc.lines).toEqual([
            "alpha[^1] bravo[^1]",
            "",
            "[^1]: ",
        ]);
    });
});

describe("the named and inline keys at several carets", () => {
    it("named drops [^] at each caret with a cursor inside EVERY bracket pair", async () => {
        const doc = fakeEditor(
            ["alpha bravo", "charlie"],
            [
                { line: 0, ch: 5 },
                { line: 1, ch: 7 },
            ],
        );
        await insertNamedFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["alpha[^] bravo", "charlie[^]"]);
        // typing now writes the same name into both
        expect(doc.selections).toEqual([
            { from: { line: 0, ch: 7 } },
            { from: { line: 1, ch: 9 } },
        ]);
    });

    it("named prefills the note's prefix in every skeleton", async () => {
        const doc = fakeEditor(
            ["---", "footnote-prefix: 2.", "---", "alpha bravo"],
            [
                { line: 3, ch: 5 },
                { line: 3, ch: 11 },
            ],
        );
        await insertNamedFootnote(
            fakePlugin(doc, { enableFootnotePrefix: true }),
        );
        expect(doc.lines[3]).toBe("alpha[^2.] bravo[^2.]");
        expect(doc.selections).toEqual([
            { from: { line: 3, ch: 5 + "[^2.".length } },
            { from: { line: 3, ch: 16 + "[^2.".length } },
        ]);
    });

    it("inline drops ^[] at each caret with a cursor inside every pair", async () => {
        const doc = fakeEditor(
            ["alpha bravo"],
            [
                { line: 0, ch: 5 },
                { line: 0, ch: 11 },
            ],
        );
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["alpha^[] bravo^[]"]);
        expect(doc.selections).toEqual([
            { from: { line: 0, ch: 7 } },
            { from: { line: 0, ch: 16 } },
        ]);
    });
});

describe("the paste key at several carets", () => {
    it("wraps the SAME clipboard text at every caret, cursor after each", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { readText: () => Promise.resolve("same source") },
        });
        const doc = fakeEditor(
            ["alpha bravo"],
            [
                { line: 0, ch: 5 },
                { line: 0, ch: 11 },
            ],
        );
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["alpha^[same source] bravo^[same source]"]);
        expect(doc.selections).toEqual([
            { from: { line: 0, ch: 5 + "^[same source]".length } },
            { from: { line: 0, ch: 25 + "^[same source]".length } },
        ]);
    });

    it("an empty clipboard toasts and edits nothing", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { readText: () => Promise.resolve("   ") },
        });
        const before = ["alpha bravo"];
        const doc = fakeEditor(before, [
            { line: 0, ch: 5 },
            { line: 0, ch: 11 },
        ]);
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(
            noticed(
                "The clipboard is empty, so there is nothing to put in an inline footnote.",
            ),
        ).toBe(true);
    });
});

describe("atomic refusals — one bad caret refuses the whole press", () => {
    it("a caret inside inline code refuses everything with the protected toast", async () => {
        const before = ["alpha `code` bravo"];
        const doc = fakeEditor(before, [
            { line: 0, ch: 5 },
            { line: 0, ch: 9 },
        ]);
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("a caret inside an existing reference refuses with its own toast", async () => {
        const before = ["alpha[^1] bravo", "", "[^1]: x"];
        const doc = fakeEditor(before, [
            { line: 0, ch: 7 },
            { line: 0, ch: 15 },
        ]);
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(MultiCaretFootnoteNotice)).toBe(true);
    });

    it("a caret inside a definition body refuses with the definition toast", async () => {
        const before = ["alpha", "", "[^1]: definition body"];
        const doc = fakeEditor(before, [
            { line: 0, ch: 5 },
            { line: 2, ch: 12 },
        ]);
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(DefinitionCreationNotice)).toBe(true);
    });

    it("a caret inside an inline footnote refuses (mixed meanings, no hop)", async () => {
        const before = ["alpha ^[note] bravo"];
        const doc = fakeEditor(before, [
            { line: 0, ch: 10 },
            { line: 0, ch: 19 },
        ]);
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(MultiCaretFootnoteNotice)).toBe(true);
    });
});
