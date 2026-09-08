import { EditorPosition } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeCalls } from "../mocks/obsidian";
import { resetNotices } from "../helpers/notices";
import { fakeEditor as sharedFakeEditor } from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";
import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";

// BUG (hunt 2026-08-25, interactions lens; skeptic-confirmed): a press
// with one real drag-selection PLUS a collapsed caret elsewhere
// (shift-drag then Alt-click - ordinary CodeMirror multi-cursor use)
// silently converts the selection and DISCARDS the extra caret: no
// footnote there, no notice. normalizedMainSelection filters
// listSelections() to non-empty ranges BEFORE its length checks, so the
// caret vanishes from consideration and the press reads as a lone
// selection; multiCaretTargets is never consulted. The 2026-08-22
// "selection claim keeps priority" ruling covered all-non-empty (refuse)
// and all-collapsed (multi-caret) - the MIXED shape was never ruled on,
// and the multi-caret feature's own founding rationale ("extra carets
// used to be silently ignored, which served nobody") argues against
// silent dropping. Either fix satisfies this pin: refuse atomically with
// a toast, or honor both targets (convert the selection and put the same
// reference at the caret).

beforeEach(() => {
    resetNotices();
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe("a drag-selection plus an extra collapsed caret", () => {
    it("the extra caret's intent is not silently discarded", async () => {
        const doc = sharedFakeEditor(["quick fox", "second line"], {
            cursor: { line: 0, ch: 0 },
            edits: true,
            wholeDoc: true,
            words: true,
        });
        const ranges: { anchor: EditorPosition; head: EditorPosition }[] = [
            { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 5 } },
            { anchor: { line: 1, ch: 3 }, head: { line: 1, ch: 3 } },
        ];
        (
            doc as unknown as { listSelections: () => typeof ranges }
        ).listSelections = () => ranges;

        await insertAutonumFootnote(
            sharedFakePlugin(
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
            ),
        );

        const anyNoticeShown = noticeCalls.length > 0;
        const secondCaretHonored = doc.lines[1] !== "second line";
        expect(anyNoticeShown || secondCaretHonored).toBe(true);
    });
});
