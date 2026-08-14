import { Editor, EditorChange, EditorPosition } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import FootnotePlugin from "../../src/main";
import {
    insertInlineFootnote,
    pasteInlineFootnote,
} from "../../src/commands/insert-or-navigate-footnotes";

// Found by the command-press property suite on its FIRST run (2026-08-12,
// shrunk counterexample ["[^1]: alpha"], caret 0:0, paste): the inline and
// paste commands inserted their "^[…]" straight into a definition LABEL —
// at column 0 that shoves "[^1]:" off the line start, DESTROYING the
// definition and orphaning every reference it served. The numbered/named
// cascade was immune (its jump-from-definition step runs first); the
// inline pair never had that step. A press inside the label now navigates
// back to the first reference (or explains an orphan), exactly like the
// other footnote keys.

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition;
}

function fakeEditor(lines: string[], cursor: EditorPosition): FakeDoc {
    const doc = {
        appliedChanges: [] as EditorChange[],
        cursor,
        getCursor: () => doc.cursor,
        listSelections: () => [{ anchor: doc.cursor, head: doc.cursor }],
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

describe("inline presses inside a definition label (bug-inline-press-breaks-definition-label)", () => {
    it("the inline key at column 0 of a referenced definition jumps back instead of inserting", async () => {
        const doc = fakeEditor(["use[^1] here", "", "[^1]: alpha"], {
            line: 2,
            ch: 0,
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual({ line: 0, ch: "use[^1]".length });
    });

    it("mid-label is protected too, not just column 0", async () => {
        const doc = fakeEditor(["use[^1] here", "", "[^1]: alpha"], {
            line: 2,
            ch: 3,
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual({ line: 0, ch: "use[^1]".length });
    });

    it("the paste key on an orphaned definition stands still without touching the clipboard", async () => {
        const reads = { count: 0 };
        vi.stubGlobal("navigator", {
            clipboard: {
                readText: async () => {
                    reads.count++;
                    return "clip";
                },
            },
        });
        const doc = fakeEditor(["[^1]: alpha"], { line: 0, ch: 0 });
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual({ line: 0, ch: 0 });
        expect(reads.count).toBe(0);
    });

    it("just past the label, the definition CONTENT refuses too (spec change 2026-08-13)", async () => {
        // SUPERSEDED SPEC: this pin originally asserted that definition
        // content past the label still takes an inline footnote. Jason's
        // ruling from manual testing reversed that — nested footnotes are
        // nonstandard markdown the plugin must not create — so the press
        // now refuses with the definition-creation notice instead (see
        // test/definition-caret-guard.test.ts for the whole family).
        const line = "[^1]: alpha";
        const doc = fakeEditor(["use[^1]", "", line], {
            line: 2,
            ch: line.length,
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([]);
    });

    it("a definition-shaped label inside a fence is plain text and stays insertable... blocked by the protected-caret guard instead", async () => {
        const doc = fakeEditor(["```", "[^1]: alpha", "```", "x"], {
            line: 1,
            ch: 0,
        });
        await insertInlineFootnote(fakePlugin(doc));
        // no label navigation AND no insertion — the protected-text guard
        // owns this caret; the point pinned here is no false label-jump
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual({ line: 1, ch: 0 });
    });
});
