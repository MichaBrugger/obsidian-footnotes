import { Editor, EditorChange, EditorPosition } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeCalls } from "./mocks/obsidian";

import FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
    pasteInlineFootnote,
} from "../src/insert-or-navigate-footnotes";

// Jason's rule (2026-08-12, always on — no toggle, inline spans included):
// footnote CREATION is blocked when the caret sits inside code, math, a
// comment, or frontmatter. A reference minted there is dead text Obsidian
// never renders, and the next lint's orphan handling then deletes it — so
// every creation path warns and stands still instead. Navigation is
// untouched (it never reaches protected text — the masked gates fall
// through).

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

beforeEach(() => {
    noticeCalls.length = 0;
});
afterEach(() => {
    vi.unstubAllGlobals();
});

const blockedToast = () =>
    noticeCalls.some(
        (args) =>
            typeof args[0] === "string" &&
            args[0].includes("inside code, math"),
    );

async function expectBlocked(
    command: (plugin: FootnotePlugin) => Promise<void>,
    lines: string[],
    cursor: EditorPosition,
) {
    const doc = fakeEditor(lines, { ...cursor });
    await command(fakePlugin(doc));
    expect(doc.appliedChanges).toEqual([]);
    expect(doc.cursor).toEqual(cursor);
    expect(blockedToast()).toBe(true);
}

describe("footnote creation is blocked inside protected text", () => {
    it("autonum inside a fenced code block", async () => {
        await expectBlocked(
            insertAutonumFootnote,
            ["```", "code here", "```", "prose"],
            { line: 1, ch: 5 },
        );
    });

    it("named inside a fenced code block", async () => {
        await expectBlocked(
            insertNamedFootnote,
            ["```", "code here", "```", "prose"],
            { line: 1, ch: 5 },
        );
    });

    it("autonum inside a $$ math block", async () => {
        await expectBlocked(
            insertAutonumFootnote,
            ["$$", "E = mc^2", "$$"],
            { line: 1, ch: 4 },
        );
    });

    it("autonum inside an inline code span", async () => {
        await expectBlocked(insertAutonumFootnote, ["a `code` b"], {
            line: 0,
            ch: 5,
        });
    });

    it("autonum inside an inline math span", async () => {
        await expectBlocked(insertAutonumFootnote, ["pay $x+y$ now"], {
            line: 0,
            ch: 6,
        });
    });

    it("autonum inside an indented code chunk", async () => {
        await expectBlocked(
            insertAutonumFootnote,
            ["para", "", "    indented code"],
            { line: 2, ch: 9 },
        );
    });

    it("autonum inside frontmatter", async () => {
        await expectBlocked(
            insertAutonumFootnote,
            ["---", "title: t", "---", "body"],
            { line: 1, ch: 3 },
        );
    });

    it("inline command inside a fence", async () => {
        await expectBlocked(
            insertInlineFootnote,
            ["```", "code here", "```", "prose"],
            { line: 1, ch: 5 },
        );
    });

    it("paste command blocks BEFORE touching the clipboard", async () => {
        const reads = { count: 0 };
        vi.stubGlobal("navigator", {
            clipboard: {
                readText: async () => {
                    reads.count++;
                    return "clip";
                },
            },
        });
        await expectBlocked(
            pasteInlineFootnote,
            ["```", "code here", "```", "prose"],
            { line: 1, ch: 5 },
        );
        expect(reads.count).toBe(0);
    });

    it("end of a line whose tail opens an unclosed comment", async () => {
        const line = "text <!-- open";
        await expectBlocked(insertAutonumFootnote, [line, "hidden"], {
            line: 0,
            ch: line.length,
        });
    });
});

describe("creation still works at protected-text boundaries", () => {
    it("caret just after a closing backtick inserts normally", async () => {
        const doc = fakeEditor(["a `code` b"], { line: 0, ch: 8 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges.length).toBeGreaterThan(0);
        expect(blockedToast()).toBe(false);
    });

    it("caret just before an opening backtick inserts normally", async () => {
        const doc = fakeEditor(["a `code` b"], { line: 0, ch: 2 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges.length).toBeGreaterThan(0);
        expect(blockedToast()).toBe(false);
    });

    it("plain prose inserts normally", async () => {
        const doc = fakeEditor(["plain prose"], { line: 0, ch: 5 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.appliedChanges.length).toBeGreaterThan(0);
        expect(blockedToast()).toBe(false);
    });
});
