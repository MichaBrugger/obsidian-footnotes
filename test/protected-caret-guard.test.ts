import { EditorPosition } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Jason's rule (2026-08-12, always on — no toggle, inline spans included):
// footnote CREATION is blocked when the caret sits inside code, math, a
// comment, or frontmatter. A reference minted there is dead text Obsidian
// never renders, and the next lint's orphan handling then deletes it — so
// every creation path warns and stands still instead. Navigation is
// untouched (it never reaches protected text — the masked gates fall
// through).

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

    it("a named placeholder that would COMPLETE an inline-math pair and be swallowed", async () => {
        // "$5 or [^]$6" satisfies the non-space-edge rule the moment the
        // placeholder lands — the name-entry flow would be stranded in math
        await expectBlocked(insertNamedFootnote, ["$5 or $6 tail"], {
            line: 0,
            ch: 6,
        });
    });

    it("an inline placeholder that would COMPLETE an inline-math pair and be swallowed", async () => {
        // the command-press flow property's shrunk counterexample:
        // "$5 or ^[]$6" masks the just-planted brackets into math
        await expectBlocked(insertInlineFootnote, ["$5 or $6"], {
            line: 0,
            ch: 6,
        });
    });

    it("a reference that would COMPLETE an inline-math pair and be swallowed by it", async () => {
        // found by the command-press property suite (2026-08-12): "$5 or "
        // ends with a space, so the dollars are prose — until "[^2]"
        // lands before the second one and "$5 or [^2]$" satisfies the
        // non-space-edge rule, masking the fresh reference into math
        await expectBlocked(insertAutonumFootnote, ["$5 or $6 [^1]"], {
            line: 0,
            ch: 6,
        });
    });

    it("a reference that would DEMOTE a quote and strand its own definition", async () => {
        // found by the command-press property suite (2026-08-12): "[^1]"
        // at column 0 of "> $$" breaks the blockquote, the now doc-level
        // "$$" swallows everything below — including the definition the
        // same transaction appends. The simulate-and-verify refusal
        // catches it before any edit.
        await expectBlocked(
            insertAutonumFootnote,
            ["> $$", "> quoted math[^75]"],
            { line: 0, ch: 0 },
        );
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
