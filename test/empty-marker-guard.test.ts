import { Editor, EditorChange, EditorPosition } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
    pasteInlineFootnote,
} from "../src/insert-or-navigate-footnotes";

// QOL sweep (2026-08-07): any footnote command pressed with the caret inside
// an abandoned empty marker "[^]" warns ("give it a name") and leaves the
// caret in place, instead of the old per-command chaos: the named command
// hopped out past the bracket, and the numbered/inline commands — which
// never see "[^]" because the marker regexes require a non-empty name —
// nested a new insertion INTO it ("[^[^1]]", "[^^[]]"), corrupting the note.

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition;
}

function fakeEditor(lines: string[], cursor: EditorPosition): FakeDoc {
    const doc = {
        appliedChanges: [] as EditorChange[],
        cursor,
        getCursor: () => doc.cursor,
        getLine: (n: number) => lines[n],
        getValue: () => lines.join("\n"),
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
        setCursor(pos: EditorPosition) {
            doc.cursor = pos;
        },
        scrollIntoView() {},
        transaction(spec: {
            changes?: EditorChange[];
            selection?: { from: EditorPosition };
        }) {
            if (spec.changes) doc.appliedChanges.push(...spec.changes);
            if (spec.selection) doc.cursor = spec.selection.from;
        },
    };
    return doc as unknown as FakeDoc;
}

function fakePlugin(doc: FakeDoc): FootnotePlugin {
    return {
        app: {
            workspace: { getActiveViewOfType: () => ({ editor: doc }) },
            vault: {},
        },
        settings: {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: true,
            lintOnFootnoteCreation: false,
        },
    } as unknown as FootnotePlugin;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

// caret between the brackets of "[^]", where a first named press leaves it
const LINE = "word [^] more";
const INSIDE = { line: 0, ch: 7 };

describe("footnote commands inside an empty [^] marker", () => {
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

    it("a caret outside the empty marker inserts normally", async () => {
        const doc = fakeEditor([LINE], { line: 0, ch: 0 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges.length).toBeGreaterThan(0);
    });

    it("a [^] inside inline code is plain text and does not block (#41 parity)", async () => {
        // "use `x [^] y` here" with the caret between the code span's brackets
        const line = "use `x [^] y` here";
        const doc = fakeEditor([line], { line: 0, ch: 9 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges.length).toBeGreaterThan(0);
    });

    it("a [^] inside a code fence does not block either", async () => {
        const doc = fakeEditor(["```", "a [^] b", "```"], { line: 1, ch: 4 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges.length).toBeGreaterThan(0);
    });
});
