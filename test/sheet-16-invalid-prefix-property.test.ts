import { beforeEach, describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
} from "../src/commands/insert-or-navigate-footnotes";
import { lintBlockedByPrefix, lintFootnotes } from "../src/linting/linter";
import { fakeEditor as sharedFakeEditor, FakeEditor } from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";
import { messages, noticed, resetNotices } from "./helpers/notices";

// Manual sheet 16 ("A note whose footnote-prefix property is invalid"),
// moved down into units on 2026-09-20. The sheet's fixture is a note whose
// footnote-prefix holds a SPACE ("bad prefix"): the Set footnote prefix
// modal would never accept it, but a hand edit can produce it.
//
// These replace four of the sheet's five checks:
//
//   1. "Numbered hotkey ... and nothing is inserted"
//   2. "The named and inline hotkeys refuse with the same toast"
//   3. "**Lint footnotes**: 'Linting canceled: ...' and the note is
//      untouched"
//   5. "Turn `Per-note footnote prefix` OFF: the hotkeys insert plain
//      [^2] / [^] again and the lint runs normally"
//
// Check 4 (the Set footnote prefix modal opening prefilled, and Escape
// leaving the property alone) stays on the sheet: it needs a human looking
// at a real modal. Its refusal half is already pinned by
// test/set-footnote-prefix.test.ts, "refuses an invalid prefix inline
// without writing".

// the sheet's note, with its prose trimmed to one fixture sentence
const NOTE = [
    "---",
    "footnote-prefix: bad prefix",
    "---",
    "A fixture footnote[^1] keeps the lint honest.",
    "",
    "[^1]: the fixture definition",
];
// the caret sits at the end of the fixture sentence, in plain prose
const CARET = { line: 3, ch: NOTE[3].length };

// the exact toast the sheet quotes
const REFUSAL =
    'No footnote was created: this note\'s footnote-prefix ("bad prefix") is invalid. The footnote prefix can\'t contain spaces, backticks, brackets, or "#".';

function noteEditor(): FakeEditor {
    return sharedFakeEditor(NOTE, {
        cursor: { ...CARET },
        edits: true,
        wholeDoc: true,
        words: true,
    });
}

function pluginFor(doc: FakeEditor, enableFootnotePrefix: boolean): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: true,
            enablePopupEditor: false,
            enableFootnotePrefix,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: true,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

// the two id-minting insert commands, named the way the sheet names their
// hotkeys. The inline hotkey is the sheet's third; it gets its own test
// below, because it does not in fact refuse.
const INSERTS: [string, (plugin: FootnotePlugin) => Promise<void>][] = [
    ["numbered", insertAutonumFootnote],
    ["named", insertNamedFootnote],
];

describe("sheet 16: the insert hotkeys while the prefix property is invalid", () => {
    beforeEach(resetNotices);

    it.each(INSERTS)("the %s hotkey toasts the refusal and inserts nothing", async (_name, command) => {
        const doc = noteEditor();
        await command(pluginFor(doc, true));
        expect(doc.lines).toEqual(NOTE);
        expect(doc.cursor).toEqual(CARET);
        expect(noticed(REFUSAL)).toBe(true);
    });

    it.fails("the inline hotkey refuses with the same toast", async () => {
        // What the code does instead: the inline command inserts "^[]" as
        // usual and says nothing. An inline footnote carries no id, so the
        // note's prefix has nothing to attach to, and only the two
        // id-minting commands ask activeFootnotePrefix for one. The sheet
        // says the inline hotkey refuses too.
        const doc = noteEditor();
        await insertInlineFootnote(pluginFor(doc, true));
        expect(doc.lines).toEqual(NOTE);
        expect(noticed(REFUSAL)).toBe(true);
    });
});

describe("sheet 16: Lint footnotes cancels, naming the bad value", () => {
    it("the cancel message quotes the property and says why", () => {
        expect(lintBlockedByPrefix(NOTE.join("\n"))).toBe(
            'Linting canceled: this note\'s footnote-prefix ("bad prefix") is invalid. The footnote prefix can\'t contain spaces, backticks, brackets, or "#".',
        );
    });
});

describe("sheet 16: with `Per-note footnote prefix` turned off", () => {
    beforeEach(resetNotices);

    it("the numbered hotkey inserts a plain [^2], with no toast", async () => {
        const doc = noteEditor();
        await insertAutonumFootnote(pluginFor(doc, false));
        expect(doc.lines[3]).toContain("[^2]");
        expect(messages()).toEqual([]);
    });

    it("the named hotkey inserts a plain [^], with no toast", async () => {
        const doc = noteEditor();
        await insertNamedFootnote(pluginFor(doc, false));
        expect(doc.lines[3]).toContain("[^]");
        expect(messages()).toEqual([]);
    });

    it("the lint itself ignores the property and cleans the note", () => {
        // the pure lint never reads the prefix while applyNotePrefix is
        // off, so the fixture footnote is simply reindexed and gathered
        const before = NOTE.join("\n");
        expect(lintFootnotes(before, { applyNotePrefix: false })).toBe(before);
    });

    it.fails("the Lint footnotes command is not blocked while the feature is off", () => {
        // What the code does instead: lintBlockedByPrefix() reads the note
        // text alone and never looks at the settings, and both lint entry
        // points (runFootnoteTransformCommand and lintActiveNoteIfSafe)
        // call it before anything else. So the command still cancels with
        // "Linting canceled: ..." even with `Per-note footnote prefix`
        // switched off, which is not what the sheet describes.
        expect(lintBlockedByPrefix(NOTE.join("\n"))).toBeNull();
    });
});
