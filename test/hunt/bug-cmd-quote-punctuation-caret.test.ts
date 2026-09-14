// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 1 of 1 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";

// SPEC QUESTION. With "insert at end of word" on and the caret parked right
// after a closing quote and before the sentence's punctuation (`say "word"|.`),
// where does the reference belong? referenceLandingAfter's documented
// convention is that a note on the last word of `This is "some bravo".`
// lands after the quote AND the full stop. But the walk only fires when a
// word touches the caret: one column earlier (right after the quote) wordAt
// finds nothing, so the press splices the reference BETWEEN quote and
// period: `say "word[^1].` - inside the quotation, before the punctuation,
// the one spot the convention says a reference never sits. The same press
// one column later (after the period) lands correctly, so the convention
// breaks exactly at the closing quote.

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

describe("caret between a closing quote and the sentence's punctuation", () => {
    it.fails("lands after the quote and the period, the documented convention", async () => {
        // say "word".  - caret between the quote and the full stop
        const doc = fakeEditor(['say "word".'], 'say "word"'.length);
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe('say "word".[^1]');
    });
});
