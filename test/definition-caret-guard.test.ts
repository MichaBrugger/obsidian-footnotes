import { Editor, EditorChange, EditorPosition } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeCalls } from "./mocks/obsidian";

import FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
    pasteInlineFootnote,
} from "../src/commands/insert-or-navigate-footnotes";
import { DefinitionCreationNotice } from "../src/commands/press-guards";
import { simulateChanges } from "../src/editor/insertion-liveness";

// Jason's ruling (2026-08-13, from manual testing): Obsidian technically
// renders footnotes nested inside footnote definitions, but that's wildly
// nonstandard markdown and the plugin must not CREATE it — the inline key
// used to happily plant "^[]" into a definition body. Every creation path
// now refuses anywhere inside a definition block (body after the label,
// continuation lines); label-line navigation and the definition-creation
// cascade step are untouched.

interface FakeDoc extends Editor {
    lines: string[];
    cursor: EditorPosition;
}

function fakeEditor(
    lines: string[],
    cursor: EditorPosition,
    selection?: { anchor: EditorPosition; head: EditorPosition },
): FakeDoc {
    const doc = {
        lines: lines.slice(),
        cursor,
        getCursor: () => doc.cursor,
        listSelections: () =>
            selection ? [selection] : [{ anchor: doc.cursor, head: doc.cursor }],
        getLine: (n: number) => doc.lines[n],
        getValue: () => doc.lines.join("\n"),
        lineCount: () => doc.lines.length,
        lastLine: () => doc.lines.length - 1,
        setCursor(pos: EditorPosition) {
            doc.cursor = pos;
        },
        scrollIntoView() {},
        transaction(spec: {
            changes?: EditorChange[];
            selection?: { from: EditorPosition };
        }) {
            if (spec.changes) doc.lines = simulateChanges(doc.lines, spec.changes);
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
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
        },
    } as unknown as FootnotePlugin;
}

beforeEach(() => {
    noticeCalls.length = 0;
});
afterEach(() => {
    vi.unstubAllGlobals();
});

const LINES = [
    "alpha[^1] prose here",
    "",
    "[^1]: definition body text",
    "    continued definition line",
];

const noticed = () =>
    noticeCalls.some((args) => args[0] === DefinitionCreationNotice);

describe("creation refuses inside a footnote definition", () => {
    it("inline key in the definition body", async () => {
        const doc = fakeEditor(LINES, { line: 2, ch: 15 });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(LINES);
        expect(noticed()).toBe(true);
    });

    it("inline key on a continuation line", async () => {
        const doc = fakeEditor(LINES, { line: 3, ch: 10 });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(LINES);
        expect(noticed()).toBe(true);
    });

    it("paste key in the definition body, before the clipboard is read", async () => {
        const reads = { count: 0 };
        vi.stubGlobal("navigator", {
            clipboard: {
                readText: async () => {
                    reads.count++;
                    return "clip";
                },
            },
        });
        const doc = fakeEditor(LINES, { line: 2, ch: 15 });
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(LINES);
        expect(noticed()).toBe(true);
        expect(reads.count).toBe(0);
    });

    it("autonum key on a continuation line NAVIGATES instead of creating", async () => {
        // the numbered/named cascade's jump step claims definition-block
        // presses (multiline-definition-jump) before creation could nest —
        // the new guard is their backstop, and the working refusal for the
        // inline pair below
        const doc = fakeEditor(LINES, { line: 3, ch: 10 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(LINES);
        expect(noticed()).toBe(false);
        expect(doc.cursor.line).toBe(0);
    });

    it("named key on a continuation line navigates the same way", async () => {
        const doc = fakeEditor(LINES, { line: 3, ch: 10 });
        await insertNamedFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(LINES);
        expect(noticed()).toBe(false);
        expect(doc.cursor.line).toBe(0);
    });

    it("a selection inside the definition body refuses conversion", async () => {
        const doc = fakeEditor(LINES, { line: 2, ch: 6 }, {
            anchor: { line: 2, ch: 6 },
            head: { line: 2, ch: 16 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(LINES);
        expect(noticed()).toBe(true);
    });
});

describe("what stays untouched", () => {
    it("the label line still navigates back to the reference", async () => {
        const doc = fakeEditor(LINES, { line: 2, ch: 2 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(LINES);
        expect(noticed()).toBe(false);
        // jumped to the reference on line 0
        expect(doc.cursor.line).toBe(0);
    });

    it("ordinary prose still creates", async () => {
        const doc = fakeEditor(LINES, { line: 0, ch: 15 });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("alpha[^1] prose^[] here");
        expect(noticed()).toBe(false);
    });
});
