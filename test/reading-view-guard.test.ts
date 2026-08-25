import { EditorPosition } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

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

// BUG (reported by Jason 2026-08-08, probed live the same day): in Reading
// view the commands passed their checks and ran the whole cascade against
// the HIDDEN editor buffer — one named press invisibly inserted "[^]" at
// the end-of-word position (render and file untouched), and the next press
// found the caret inside it and toasted about an empty reference the user
// could not see. Text-editing commands must be inert in Reading view; the
// editor state there is not something the user can watch or fix.

function fakeEditor(lines: string[], cursor: EditorPosition): FakeEditor {
    return sharedFakeEditor(lines, { cursor, edits: true, wholeDoc: true });
}

// richer view (getMode) than the shared plugin fake supports — stays local
function previewPlugin(doc: FakeEditor): FootnotePlugin {
    return {
        app: {
            workspace: {
                getActiveViewOfType: () => ({
                    editor: doc,
                    getMode: () => "preview",
                }),
            },
            vault: {},
        },
        settings: {
            insertAtEndOfWord: true,
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

const START = { line: 0, ch: 2 };

describe("footnote commands in Reading view", () => {
    it("the named command changes nothing", async () => {
        const doc = fakeEditor(["alpha bravo charlie"], { ...START });
        await insertNamedFootnote(previewPlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(START);
    });

    it("the auto-numbered command changes nothing", async () => {
        const doc = fakeEditor(["alpha bravo charlie"], { ...START });
        await insertAutonumFootnote(previewPlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(START);
    });

    it("the inline command changes nothing", async () => {
        const doc = fakeEditor(["alpha bravo charlie"], { ...START });
        await insertInlineFootnote(previewPlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual(START);
    });

    it("the paste command changes nothing and skips the clipboard", async () => {
        const reads = { count: 0 };
        vi.stubGlobal("navigator", {
            clipboard: {
                readText: () => {
                    reads.count++;
                    return Promise.resolve("clip");
                },
            },
        });
        const doc = fakeEditor(["alpha bravo charlie"], { ...START });
        await pasteInlineFootnote(previewPlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(reads.count).toBe(0);
    });
});
