import { EditorPosition } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeCalls } from "../mocks/obsidian";
import { resetNotices } from "../helpers/notices";
import { fakeEditor as sharedFakeEditor, FakeEditor } from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";
import FootnotePlugin from "../../src/main";
import { selectionPressHandled } from "../../src/commands/selection-footnote";
import { pasteInlineFootnote } from "../../src/commands/insert-or-navigate-footnotes";
import { ProtectedSelectionNotice } from "../../src/commands/selection-footnote";
import { ProtectedCreationNotice } from "../../src/editor/insertion-liveness";
import { inlineWrapLandsIntact } from "../../src/commands/inline-footnotes";

// BUG (hunt 2026-08-25, contexts lens; skeptic-confirmed): every
// inline-footnote liveness check verifies only the wrapper's OPEN
// bracket position, never its CLOSE. Wrapping "cost $" in "^[…]" places
// "]" right after the "$" - "$]" satisfies the math boundary rule (the
// original "$ here" did not, so the up-front edge check saw nothing) and
// pairs with the later "$y", the emergent math span swallows the
// wrapper's real closing "]", and inlineFootnoteSpanAt latches onto the
// unrelated decoy "]" further down the line. micromark+math ground truth
// confirms the RENDERED document is genuinely wrong (an inlineMath node
// eats "] here"), so the press should refuse like every other born-dead
// insertion. The gap is SHARED: convertMainSelectionToInline
// (selection-footnote.ts) and insertInlineText
// (insert-or-navigate-footnotes.ts, behind the caret insert AND paste)
// carry the identical open-only check.

const BEFORE = "before cost $ here$y] after";

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

beforeEach(() => {
    resetNotices();
});
afterEach(() => {
    vi.unstubAllGlobals();
});

// a selection refuses in the selection's words, a caret press in the
// caret's (2026-09-16, B27)
const refused = (notice: string = ProtectedCreationNotice) =>
    noticeCalls.some((args) => args[0] === notice);

describe("an emergent math span swallowing the inline wrapper's close bracket", () => {
    it("the selection conversion refuses instead of landing a corrupted wrap", () => {
        const selection: { anchor: EditorPosition; head: EditorPosition } = {
            anchor: { line: 0, ch: 7 },
            head: { line: 0, ch: 13 }, // "cost $"
        };
        const doc = sharedFakeEditor([BEFORE], {
            cursor: { line: 0, ch: 13 },
            selection,
            edits: true,
            wholeDoc: true,
        });
        selectionPressHandled(fakePlugin(doc), doc, null, "inline");
        expect(doc.lines[0]).toBe(BEFORE);
        expect(refused(ProtectedSelectionNotice)).toBe(true);
    });

    it("the paste insert refuses the same shape at a bare caret", async () => {
        vi.stubGlobal("navigator", {
            clipboard: { readText: () => Promise.resolve("cost $") },
        });
        const line = "before  here$y] after";
        const doc = sharedFakeEditor([line], {
            cursor: { line: 0, ch: 7 },
            edits: true,
            wholeDoc: true,
        });
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe(line);
        expect(refused()).toBe(true);
    });
});

describe("inlineWrapLandsIntact's own contract (2026-08-25 mutation audit)", () => {
    it("a span that merely CONTAINS the probe but opens elsewhere refuses, even when its close coincides", () => {
        // span opens at 0 and closes at 4; probing at=1 with wrapLength 4
        // makes the close test alone pass (1 + 4 - 1 === 4) - only the
        // open check refuses
        expect(inlineWrapLandsIntact("^[ab]", 1, 4)).toBe(false);
    });
});
