import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorPosition } from "obsidian";

import { noticed, resetNotices } from "./helpers/notices";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

import type FootnotePlugin from "../src/main";
import { insertAutonumFootnote } from "../src/commands/insert-or-navigate-footnotes";
import {
    convertSelectionToNamed,
    ProtectedSelectionNotice,
} from "../src/commands/selection-footnote";
import { lintFootnotes } from "../src/linting/linter";

// These tests take over three checks that used to sit on manual sheet 05
// ("Selection block zoo"). Each one was a thing a machine can look at, so
// it does not need Jason in the real Obsidian window any more:
//
//  1. "The indented table inside the definition doesn't confuse later
//     lints (run Lint: nothing rewrites it)"
//  2. "Select from INSIDE the $$ block to below it: the
//     cuts-through-protected-text toast, nothing changes"
//  3. "Pick any two fixtures above, use the NAMED hotkey: ... Enter
//     converts identically under [^yourname]; one undo reverts
//     everything" (the modal itself opening is the smoke suite's job, in
//     "a selection + the named key names the footnote through a modal";
//     what is pinned here is that the submit converts a block-zoo
//     selection and does it in ONE editor transaction, which is what
//     makes ONE undo take the whole thing back)
//
// What stays on the sheet is the part only eyes can settle: whether the
// finished footnote RENDERS the list, quote, callout, table, code block
// and maths correctly in Reading view and in the popup.

// A fake editor is a stand-in for Obsidian's real editor: it holds the
// note as an array of lines and records what the plugin asks it to do.
function fakeEditor(
    lines: string[],
    cursor: EditorPosition,
    selection?: { anchor: EditorPosition; head: EditorPosition },
): FakeEditor {
    return sharedFakeEditor(lines, {
        cursor,
        selection,
        edits: true,
        wholeDoc: true,
    });
}

// The settings the sheet asks for: defaults, with the popup turned off.
function fakePlugin(
    doc: FakeEditor,
    overrides: Partial<FootnotePlugin["settings"]> = {},
): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: false,
            expandSelectionToWholeWords: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
            ...overrides,
        },
        doc,
    );
}

beforeEach(() => {
    resetNotices();
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe("a table that has moved into a footnote survives the lint", () => {
    // The sheet's worry: once a table sits indented four spaces under a
    // "[^1]:" label, a later Lint run might mistake those rows for
    // something to tidy and rewrite them. It must not touch them.
    it("the lint leaves the indented table exactly as the conversion left it", async () => {
        const lines = [
            "above prose",
            "",
            "| a | b |",
            "| --- | --- |",
            "| 1 | 2 |",
            "",
            "below prose",
            "tail stays",
        ];
        const doc = fakeEditor(lines, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 6, ch: "below prose".length },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        // the shape the block zoo promises: the whole table rode into the
        // definition body, indented four spaces under the label
        expect(doc.lines).toEqual([
            "[^1]",
            "tail stays",
            "",
            "[^1]: above prose",
            "    ",
            "    | a | b |",
            "    | --- | --- |",
            "    | 1 | 2 |",
            "    ",
            "    below prose",
        ]);
        // and now the lint, with every rule on, changes nothing at all
        const converted = doc.lines.join("\n");
        expect(lintFootnotes(converted)).toBe(converted);
    });

    it("a second lint run changes nothing either (the lint is settled)", () => {
        const converted = [
            "[^1]",
            "tail stays",
            "",
            "[^1]: above prose",
            "    ",
            "    | a | b |",
            "    | --- | --- |",
            "    | 1 | 2 |",
            "    ",
            "    below prose",
        ].join("\n");
        expect(lintFootnotes(lintFootnotes(converted))).toBe(converted);
    });
});

describe("a selection that cuts a $$ maths block in half refuses", () => {
    // Taking the inside of a "$$" block without its closing "$$" would
    // strand that closer and turn the rest of the note into maths, so the
    // press refuses and says why.
    it("from inside the block down to the prose below: the toast, nothing changes", async () => {
        const before = [
            "before the fence",
            "$$",
            "E = mc^2",
            "$$",
            "after the fence",
        ];
        const doc = fakeEditor(before, { line: 2, ch: 0 }, {
            anchor: { line: 2, ch: 0 },
            head: { line: 4, ch: "after the fence".length },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("from the prose above down into the middle of the block refuses too", async () => {
        const before = [
            "before the fence",
            "$$",
            "E = mc^2",
            "$$",
            "after the fence",
        ];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 2, ch: 4 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });
});

describe("the named key's modal converts a block-zoo selection", () => {
    // convertSelectionToNamed is what the name modal calls when you press
    // Enter. A null answer means no problem was found and the conversion
    // went through.
    it("a callout under the typed name, in ONE transaction so one undo reverts it", () => {
        const lines = [
            "before the callout",
            "",
            "> [!note] Heads up",
            "> callout body",
            "",
            "after the callout",
        ];
        const doc = fakeEditor(lines, { line: 0, ch: 0 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            {
                from: { line: 0, ch: 0 },
                to: { line: 5, ch: "after the callout".length },
                text: lines.join("\n"),
                lead: "",
            },
            "yourname",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual([
            "[^yourname]",
            "",
            "[^yourname]: before the callout",
            "    ",
            "    > [!note] Heads up",
            "    > callout body",
            "    ",
            "    after the callout",
        ]);
        // one transaction is one entry in Obsidian's undo history, which
        // is what "one undo reverts everything" means
        expect(doc.transactions).toBe(1);
    });

    it("a bulleted list with a nested item, same shape and same single transaction", () => {
        const lines = [
            "before the list",
            "",
            "- alpha",
            "    - nested",
            "- beta",
            "",
            "after the list",
        ];
        const doc = fakeEditor(lines, { line: 0, ch: 0 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            {
                from: { line: 0, ch: 0 },
                to: { line: 6, ch: "after the list".length },
                text: lines.join("\n"),
                lead: "",
            },
            "yourname",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual([
            "[^yourname]",
            "",
            "[^yourname]: before the list",
            "    ",
            "    - alpha",
            "        - nested",
            "    - beta",
            "    ",
            "    after the list",
        ]);
        expect(doc.transactions).toBe(1);
    });
});
