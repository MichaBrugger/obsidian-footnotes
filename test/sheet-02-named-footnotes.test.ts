import { beforeEach, describe, expect, it } from "vitest";

import type FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
    pasteInlineFootnote,
} from "../src/commands/insert-or-navigate-footnotes";
import { convertSelectionToNamed } from "../src/commands/selection-footnote";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";
import { messages, resetNotices } from "./helpers/notices";

// These tests take over checks that used to sit on manual sheet 02
// ("named footnotes"). Each one is about text the plugin writes, or a
// message it hands back, so a machine can settle it.
//
// The sheet items this file replaces:
//   - "Type a name, press the hotkey again with the caret still inside:
//     the [^name]: definition is created"
//   - "Type a name, then press the NUMBERED hotkey by accident: it creates
//     the definition exactly like the named key; nothing is nested into
//     the brackets"
//   - "In the modal, type a[b, then a b, then a backtick b, then a#b: each
//     shows the invalid-character message inline"
//   - "Type 1 (already a footnote): '[^1]' is already used by another
//     footnote."
//   - "The NAMED hotkey toasts 'This footnote reference is empty. Type a
//     name between the brackets.' and the caret stays put"
//   - "The NUMBERED, INLINE, and PASTE hotkeys show the same toast,
//     nothing nests"
//
// The name modal itself is thin wiring over convertSelectionToNamed: the
// modal shows whatever string that function hands back and stays open
// while it is not null, so driving the function is driving the modal.

function plugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            // sheet 02 runs on defaults with the popup off; the end-of-word
            // hop is irrelevant to every check here and left off so the
            // fixtures read exactly as written
            insertAtEndOfWord: false,
            expandSelectionToWholeWords: true,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "# Footnotes",
            enableRemoveBlankLastLines: true,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

function noteWithCaret(lines: string[], line: number, ch: number): FakeEditor {
    return sharedFakeEditor(lines, {
        cursor: { line, ch },
        edits: true,
        wholeDoc: true,
    });
}

beforeEach(() => {
    resetNotices();
});

describe("sheet 02: the second press of the two-step named flow", () => {
    // where the first press plus some typing leaves you: a named reference
    // with no definition yet, caret still between the brackets
    const typed = () => ["Insert into this[^cite] sentence."];
    const insideBrackets = { line: 0, ch: "Insert into this[^ci".length };

    it("the named hotkey creates the '[^cite]:' definition", async () => {
        const doc = noteWithCaret(typed(), insideBrackets.line, insideBrackets.ch);
        await insertNamedFootnote(plugin(doc));
        expect(doc.lines).toEqual([
            "Insert into this[^cite] sentence.",
            "",
            "[^cite]: ",
        ]);
    });

    it("the NUMBERED hotkey pressed by accident does exactly the same, nothing nested", async () => {
        const doc = noteWithCaret(typed(), insideBrackets.line, insideBrackets.ch);
        await insertAutonumFootnote(plugin(doc));
        expect(doc.lines).toEqual([
            "Insert into this[^cite] sentence.",
            "",
            "[^cite]: ",
        ]);
    });
});

// The empty-reference guard (the QOL sweep of 2026-08-07). An abandoned
// "[^]" with the caret between its brackets is a footnote you started and
// never named: every command says so and leaves the note alone, instead of
// nesting a new insertion into the brackets.
describe("sheet 02: every command inside an empty '[^]' reference", () => {
    const EmptyReferenceToast =
        "This footnote reference is empty. Type a name between the brackets.";
    // the sheet's fixture sentence, with the caret between the brackets
    const line = "Fixture: an empty [^] reference sits in this sentence.";
    const between = { line: 0, ch: line.indexOf("[^]") + 2 };

    const commands: [string, (plugin: FootnotePlugin) => Promise<void>][] = [
        ["named", insertNamedFootnote],
        ["numbered", insertAutonumFootnote],
        ["inline", insertInlineFootnote],
        ["paste", pasteInlineFootnote],
    ];

    for (const [name, press] of commands) {
        it(`the ${name} hotkey raises the empty-reference toast, leaves the caret, and nests nothing`, async () => {
            const doc = noteWithCaret([line], between.line, between.ch);
            await press(plugin(doc));
            expect(messages()).toEqual([EmptyReferenceToast]);
            expect(doc.lines).toEqual([line]);
            expect(doc.appliedChanges).toEqual([]);
            expect(doc.cursor).toEqual(between);
        });
    }
});

describe("sheet 02: the name modal's refusals", () => {
    // the sheet's fixture: a line to name a footnote out of, and a [^1]
    // the "already used" check collides with
    const note = () => [
        "A sentence you can name me from, twice over.",
        "",
        "[^1]: the fixture definition the modal collides with",
    ];
    // "name me" inside that first line
    const selection = () => ({
        from: { line: 0, ch: 24 },
        to: { line: 0, ch: 31 },
        text: "name me",
        lead: "",
    });

    const invalidNames = ["a[b", "a b", "a`b", "a#b"];

    for (const name of invalidNames) {
        it(`refuses "${name}" with the one invalid-character message, note untouched`, () => {
            const before = note();
            const doc = noteWithCaret(before.slice(), 0, 24);
            const problem = convertSelectionToNamed(
                plugin(doc),
                doc,
                selection(),
                name,
            );
            expect(problem).toBe(
                'Footnote names can\'t contain spaces, backticks, brackets, or "#".',
            );
            expect(doc.lines).toEqual(before);
        });
    }

    it('refuses the name "1", which the fixture footnote already uses', () => {
        const before = note();
        const doc = noteWithCaret(before.slice(), 0, 24);
        const problem = convertSelectionToNamed(plugin(doc), doc, selection(), "1");
        expect(problem).toBe('"[^1]" is already used by another footnote.');
        expect(doc.lines).toEqual(before);
    });
});
