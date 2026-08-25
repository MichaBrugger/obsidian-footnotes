import { EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
} from "../../src/commands/insert-or-navigate-footnotes";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";

// Found by the command-press property suite (2026-08-12, shrunk from
// "\[^81]. alpha[^1].", caret between "\" and "["): inserting a footnote
// directly AFTER an escaping backslash escapes the INSERTION — the new
// "[^N]" arrives as literal "\[^N]" (dead, its appended definition
// instantly orphaned) — and simultaneously UN-escapes the text that
// backslash used to protect ("[^81]" went live as an orphan). Inline
// presses had the twin failure: "\^[…]" is a literal caret, not an inline
// footnote. The shared position adjuster now nudges such an insertion one
// column left, BEFORE the escaping backslash: both meanings survive.

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
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

describe("insertion directly after an escaping backslash (bug-insert-after-backslash)", () => {
    it("autonum nudges left so neither the new nor the escaped reference changes meaning", async () => {
        const doc = fakeEditor(["\\[^81]. alpha"], { line: 0, ch: 1 });
        await insertAutonumFootnote(fakePlugin(doc));
        const reference = doc.appliedChanges.find((c) => c.text === "[^1]");
        expect(reference?.from).toEqual({ line: 0, ch: 0 });
    });

    it("inline nudges left too — '\\^[…]' would be a literal caret", async () => {
        const doc = fakeEditor(["prose\\ tail"], { line: 0, ch: 6 });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([
            { from: { line: 0, ch: 5 }, text: "^[]" },
        ]);
    });

    it("autonum after an unescaped '^' nudges left — '^[^N]' would be inline-footnote content", async () => {
        // shrunk from the 10k soak: caret inside the literal "\[^80]",
        // where the inserted "[^1]" landed as "^[^1]…" and died
        const doc = fakeEditor(["\\[^80] tail"], { line: 0, ch: 3 });
        await insertAutonumFootnote(fakePlugin(doc));
        const reference = doc.appliedChanges.find((c) => c.text === "[^1]");
        // ch 3 sits after the unescaped "^" at 2 → nudge to 2 (the "[" at 1
        // is not a hazard, so the walk stops there)
        expect(reference?.from).toEqual({ line: 0, ch: 2 });
    });

    it("after an ESCAPED caret the position stands — '\\^' is a literal caret", async () => {
        const doc = fakeEditor(["a\\^ tail"], { line: 0, ch: 3 });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([
            { from: { line: 0, ch: 3 }, text: "^[]" },
        ]);
    });

    it("after an ESCAPED backslash (even run) the position stands", async () => {
        // "a\\" + caret at 3: the backslash pair is literal, inserting
        // there is safe
        const doc = fakeEditor(["a\\\\ tail"], { line: 0, ch: 3 });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.appliedChanges).toEqual([
            { from: { line: 0, ch: 3 }, text: "^[]" },
        ]);
    });
});
