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
import {
    convertCellSelectionToNamed,
    convertSelectionToNamed,
    selectionPressHandled,
    SelectionChangedNotice,
    SelectionCommandNotice,
    SelectionSpanNotice,
} from "../src/commands/selection-footnote";
import { ProtectedCreationNotice, simulateChanges } from "../src/editor/insertion-liveness";
import { TableCellEditor } from "../src/editor/table-cursor";

// Turning a selection into a footnote (issue #35, Jason's calls 2026-08-12:
// overload the existing hotkeys, always on; single-line selections only;
// named/paste redirect instead of converting). The auto-numbered key moves
// the selected text into a new definition's body; the inline key wraps it
// as "^[…]" in place. The generative twin lives in
// command-properties.test.ts — these pin the concrete contracts.

interface SelDoc extends Editor {
    lines: string[];
    cursor: EditorPosition;
}

function fakeEditor(
    lines: string[],
    cursor: EditorPosition,
    selection?: { anchor: EditorPosition; head: EditorPosition },
): SelDoc {
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
            // simulateChanges IS the transaction semantics the commands rely
            // on (verbatim CodeMirror ordering) — reusing it keeps the fake
            // honest
            if (spec.changes) doc.lines = simulateChanges(doc.lines, spec.changes);
            if (spec.selection) doc.cursor = spec.selection.from;
        },
    };
    return doc as unknown as SelDoc;
}

function fakePlugin(doc: SelDoc): FootnotePlugin {
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

const noticed = (message: string) =>
    noticeCalls.some((args) => args[0] === message);

describe("the auto-numbered key converts a selection", () => {
    it("moves the selected text into a new definition's body", async () => {
        const doc = fakeEditor(
            ["The quick fox jumps", "", "tail"],
            { line: 0, ch: 9 },
            { anchor: { line: 0, ch: 4 }, head: { line: 0, ch: 9 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        // the first footnote gets its usual blank separator line
        expect(doc.lines).toEqual([
            "The [^1] fox jumps",
            "",
            "tail",
            "",
            "[^1]: quick",
        ]);
        // the caret lands at the end of the pre-filled body, ready to edit
        expect(doc.cursor).toEqual({ line: 4, ch: "[^1]: quick".length });
    });

    it("numbers past existing footnotes and appends after the last block", async () => {
        const doc = fakeEditor(
            ["word here[^1]", "", "[^1]: a"],
            { line: 0, ch: 0 },
            { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 4 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "[^2] here[^1]",
            "",
            "[^1]: a",
            "[^2]: word",
        ]);
    });

    it("sheds the selection's whitespace edges back into the prose", async () => {
        const doc = fakeEditor(
            ["The quick fox jumps"],
            { line: 0, ch: 3 },
            // " quick " selected, spaces included
            { anchor: { line: 0, ch: 3 }, head: { line: 0, ch: 10 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("The [^1] fox jumps");
    });

    it("a REVERSED (head-before-anchor) selection converts the same", async () => {
        const doc = fakeEditor(
            ["The quick fox jumps"],
            { line: 0, ch: 4 },
            { anchor: { line: 0, ch: 9 }, head: { line: 0, ch: 4 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("The [^1] fox jumps");
    });

    it("a full-line drag (ending at ch 0 of the next line) converts the line", async () => {
        const doc = fakeEditor(
            ["word", "next"],
            { line: 0, ch: 0 },
            { anchor: { line: 0, ch: 0 }, head: { line: 1, ch: 0 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["[^1]", "next", "", "[^1]: word"]);
    });

    it("a whitespace-only selection falls through to a plain insert", async () => {
        const doc = fakeEditor(
            ["The quick fox"],
            { line: 0, ch: 4 },
            { anchor: { line: 0, ch: 3 }, head: { line: 0, ch: 4 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        // the ordinary caret cascade ran instead: reference at the caret,
        // empty definition appended
        expect(doc.lines).toEqual(["The [^1]quick fox", "", "[^1]: "]);
    });
});

describe("the inline key converts a selection", () => {
    it("wraps the selected text as ^[…] in place, caret after the bracket", async () => {
        const doc = fakeEditor(
            ["The quick fox jumps"],
            { line: 0, ch: 9 },
            { anchor: { line: 0, ch: 4 }, head: { line: 0, ch: 9 } },
        );
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["The ^[quick] fox jumps"]);
        expect(doc.cursor).toEqual({ line: 0, ch: 4 + "^[quick]".length });
    });

    it("escapes an unbalanced bracket so the wrapper can't end early", async () => {
        const doc = fakeEditor(
            ["pay a ] b now"],
            { line: 0, ch: 4 },
            // "a ] b" selected
            { anchor: { line: 0, ch: 4 }, head: { line: 0, ch: 9 } },
        );
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["pay ^[a \\] b] now"]);
    });
});

describe("the named key converts a selection through its modal (2026-08-13)", () => {
    // the modal is thin wiring over convertSelectionToNamed — these drive
    // the exported conversion the way its submit does
    it("replaces the selection with [^name] and seeds the definition", () => {
        const doc = fakeEditor(["The quick fox jumps"], { line: 0, ch: 4 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            {
                from: { line: 0, ch: 4 },
                to: { line: 0, ch: 9 },
                text: "quick",
            },
            "Speed2026",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual([
            "The [^Speed2026] fox jumps",
            "",
            "[^Speed2026]: quick",
        ]);
        expect(doc.cursor).toEqual({ line: 2, ch: "[^Speed2026]: quick".length });
    });

    it("healing an orphan: a name only dangling references carry is welcome", () => {
        const doc = fakeEditor(["see [^lost] and quick brown"], { line: 0, ch: 16 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            {
                from: { line: 0, ch: 16 },
                to: { line: 0, ch: 21 },
                text: "quick",
            },
            "lost",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual([
            "see [^lost] and [^lost] brown",
            "",
            "[^lost]: quick",
        ]);
    });

    it("refuses a name that is already DEFINED, inline", () => {
        const before = ["The quick fox", "", "[^taken]: existing"];
        const doc = fakeEditor(before, { line: 0, ch: 4 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            { from: { line: 0, ch: 4 }, to: { line: 0, ch: 9 }, text: "quick" },
            "Taken",
        );
        expect(problem).toBe('"[^Taken]" is already defined. Pick a new name.');
        expect(doc.lines).toEqual(before);
    });

    it("refuses invalid names with the reason, inline", () => {
        const doc = fakeEditor(["The quick fox"], { line: 0, ch: 4 });
        const selection = {
            from: { line: 0, ch: 4 },
            to: { line: 0, ch: 9 },
            text: "quick",
        };
        expect(
            convertSelectionToNamed(fakePlugin(doc), doc, selection, "bad name"),
        ).toBe("Footnote names can't contain spaces or backticks.");
        expect(
            convertSelectionToNamed(fakePlugin(doc), doc, selection, "a[b"),
        ).toBe("Footnote names can't contain brackets.");
        expect(doc.lines).toEqual(["The quick fox"]);
    });

    it("bails with a notice when the note changed under the open modal", () => {
        const doc = fakeEditor(["The rapid fox"], { line: 0, ch: 4 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            // captured before the note changed: the span no longer reads
            // "quick"
            { from: { line: 0, ch: 4 }, to: { line: 0, ch: 9 }, text: "quick" },
            "fine",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual(["The rapid fox"]);
        expect(noticed(SelectionChangedNotice)).toBe(true);
    });

    it("refuses a born-dead conversion like autonum does", () => {
        const before = ["> $$", "> quoted math[^75]"];
        const doc = fakeEditor(before, { line: 0, ch: 0 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            { from: { line: 0, ch: 0 }, to: { line: 0, ch: 1 }, text: ">" },
            "dead",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });
});

describe("selections that refuse", () => {
    it("a multi-line selection warns and edits nothing", async () => {
        const before = ["first line", "second line"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 6 },
            head: { line: 1, ch: 6 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(SelectionSpanNotice)).toBe(true);
    });

    it("multiple selection ranges warn and edit nothing", async () => {
        const before = ["alpha beta gamma"];
        const doc = fakeEditor(before, { line: 0, ch: 0 });
        (doc as unknown as { listSelections: () => unknown }).listSelections =
            () => [
                { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 5 } },
                { anchor: { line: 0, ch: 6 }, head: { line: 0, ch: 10 } },
            ];
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(SelectionSpanNotice)).toBe(true);
    });

    it("the named key claims the press for its name modal, editing nothing yet", async () => {
        // the modal itself is DOM territory (smoke suite); in units the
        // press must consume the selection silently and leave the document
        // to the modal's submit
        const before = ["The quick fox"];
        const doc = fakeEditor(before, { line: 0, ch: 4 }, {
            anchor: { line: 0, ch: 4 },
            head: { line: 0, ch: 9 },
        });
        await insertNamedFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticeCalls).toEqual([]);
    });

    it("the paste key redirects WITHOUT touching the clipboard", async () => {
        const reads = { count: 0 };
        vi.stubGlobal("navigator", {
            clipboard: {
                readText: async () => {
                    reads.count++;
                    return "clip";
                },
            },
        });
        const before = ["The quick fox"];
        const doc = fakeEditor(before, { line: 0, ch: 4 }, {
            anchor: { line: 0, ch: 4 },
            head: { line: 0, ch: 9 },
        });
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(SelectionCommandNotice)).toBe(true);
        expect(reads.count).toBe(0);
    });

    it("a selection inside a fenced code block refuses (autonum)", async () => {
        const before = ["```", "code here", "```"];
        const doc = fakeEditor(before, { line: 1, ch: 0 }, {
            anchor: { line: 1, ch: 0 },
            head: { line: 1, ch: 4 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("a selection inside a fenced code block refuses (inline)", async () => {
        const before = ["```", "code here", "```"];
        const doc = fakeEditor(before, { line: 1, ch: 0 }, {
            anchor: { line: 1, ch: 0 },
            head: { line: 1, ch: 4 },
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("selecting part of a fence DELIMITER refuses (found by the conversion property)", async () => {
        // wrapping the opener's first backtick as "^[`]" would un-fence
        // everything below it — the simulated RESULT looks live precisely
        // because the construct got destroyed, so the up-front protected
        // check must own this, not the born-dead simulation
        const before = ["```", "fake[^1]", "```"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 0, ch: 1 },
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("selecting inside an inline code span refuses", async () => {
        const before = ["a `co de` b"];
        const doc = fakeEditor(before, { line: 0, ch: 3 }, {
            anchor: { line: 0, ch: 3 },
            head: { line: 0, ch: 5 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("a replacement that would demote a quote and strand its own definition refuses", async () => {
        // replacing the ">" leaves "$$" doc-level, swallowing everything
        // below — including the definition the same transaction appends
        // (the quote-demotion class the press property suite found)
        const before = ["> $$", "> quoted math[^75]"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 0, ch: 1 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });
});

describe("selections inside an actively edited table cell", () => {
    function fakeCell(text: string, anchor: number, head: number) {
        const dispatched: {
            changes?: { from: number; to?: number; insert: string };
            selection?: { anchor: number };
        }[] = [];
        const cell: TableCellEditor = {
            state: {
                doc: { toString: () => text },
                selection: { main: { head, anchor } },
            },
            dispatch: (spec) => {
                dispatched.push(spec);
            },
        };
        return { cell, dispatched };
    }

    it("the inline key wraps the cell selection through the cell's editor", () => {
        const { cell, dispatched } = fakeCell("plain word here", 6, 10);
        const doc = fakeEditor(
            ["| plain word here |", "| --- |", "| x |"],
            { line: 0, ch: 8 },
        );
        const handled = selectionPressHandled(fakePlugin(doc), doc, cell, "inline");
        expect(handled).toBe(true);
        expect(dispatched).toEqual([
            {
                changes: { from: 6, to: 10, insert: "^[word]" },
                selection: { anchor: 6 + "^[word]".length },
            },
        ]);
    });

    it("the auto-numbered key replaces in the cell and appends the seeded definition", () => {
        const { cell, dispatched } = fakeCell("plain word here", 6, 10);
        const doc = fakeEditor(
            ["| plain word here |", "| --- |", "| x |"],
            { line: 0, ch: 8 },
        );
        const handled = selectionPressHandled(
            fakePlugin(doc),
            doc,
            cell,
            "autonum",
            { line: 0, ch: 8 },
        );
        expect(handled).toBe(true);
        expect(dispatched).toEqual([
            {
                changes: { from: 6, to: 10, insert: "[^1]" },
                selection: { anchor: 6 + "[^1]".length },
            },
        ]);
        expect(doc.lines[doc.lines.length - 1]).toBe("[^1]: word");
    });

    it("an empty cell selection is no claim — the caret cascade owns the press", () => {
        const { cell, dispatched } = fakeCell("plain word here", 7, 7);
        const doc = fakeEditor(["| plain word here |"], { line: 0, ch: 8 });
        expect(
            selectionPressHandled(fakePlugin(doc), doc, cell, "inline"),
        ).toBe(false);
        expect(dispatched).toEqual([]);
    });

    it("a cell selection inside the cell's inline code refuses", () => {
        const { cell, dispatched } = fakeCell("has `co de` x", 6, 8);
        const doc = fakeEditor(["| has `co de` x |"], { line: 0, ch: 7 });
        expect(
            selectionPressHandled(fakePlugin(doc), doc, cell, "inline"),
        ).toBe(true);
        expect(dispatched).toEqual([]);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("the named key claims a cell selection for its modal, dispatching nothing yet", () => {
        const { cell, dispatched } = fakeCell("plain word here", 6, 10);
        const doc = fakeEditor(["| plain word here |"], { line: 0, ch: 8 });
        expect(
            selectionPressHandled(fakePlugin(doc), doc, cell, "named"),
        ).toBe(true);
        expect(dispatched).toEqual([]);
        expect(noticeCalls).toEqual([]);
    });

    it("the modal's submit converts the cell selection under the typed name", () => {
        const { cell, dispatched } = fakeCell("plain word here", 6, 10);
        const doc = fakeEditor(
            ["| plain word here |", "| --- |", "| x |"],
            { line: 0, ch: 8 },
        );
        const problem = convertCellSelectionToNamed(
            fakePlugin(doc),
            doc,
            cell,
            { from: 6, to: 10, text: "word" },
            "src",
            { line: 0, ch: 8 },
        );
        expect(problem).toBeNull();
        expect(dispatched).toEqual([
            {
                changes: { from: 6, to: 10, insert: "[^src]" },
                selection: { anchor: 6 + "[^src]".length },
            },
        ]);
        expect(doc.lines[doc.lines.length - 1]).toBe("[^src]: word");
    });
});
