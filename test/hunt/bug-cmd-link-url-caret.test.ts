// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 3 of 3 tests were red there and carry it.fails.
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

// A user with "insert at end of word" on presses the footnote key while the
// caret sits inside a link's (url) part, say "[text](ht|tp://x)". The
// end-of-word walk lands the reference INSIDE the URL
// ("[text](http:[^1]//x)"): the link's destination is mangled and the
// reference never renders as a footnote, yet its definition is appended at
// the bottom of the note. referenceLandingAfter's own contract says "a
// markdown link's (url) tail ... is stepped over whole, so the reference
// never splits [text](url)" - but that step-over only fires when the walk
// starts at the "]", never when the caret began inside the "(url)".

function fakeEditor(lines: string[], ch: number): FakeEditor {
    return sharedFakeEditor(lines, {
        cursor: { line: 0, ch },
        edits: true,
        wholeDoc: true,
        words: true,
    });
}

function fakePlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: true,
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

describe("caret inside a link's (url) part", () => {
    it.fails("autonum lands after the whole link, not inside the url", async () => {
        // caret between "ht" and "tp": the word is "http", whose end is
        // followed by ":", which the punctuation walk steps over, landing
        // between ":" and "//" deep inside the destination
        const doc = fakeEditor(["[text](http://x)"], "[text](ht".length);
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("[text](http://x)[^1]");
    });

    it.fails("inline lands after the whole link, not inside the url", async () => {
        const doc = fakeEditor(["[text](http://x)"], "[text](ht".length);
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("[text](http://x)^[]");
    });

    it.fails("a nested-paren url: the walk must not stop at the inner ')'", async () => {
        // caret inside "v" of "[a](u_(v)_w)": the word walk ends before the
        // INNER ")", a closing mark the walk steps over - landing mid-url
        const line = "see [a](u_(v)_w) end";
        const doc = fakeEditor([line], "see [a](u_(v".length);
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("see [a](u_(v)_w)[^1] end");
    });
});
