// Imported from the Kimi K3 cycle 5 hunt of 2026-09-16 (OpenCode worktree); 1 of 3 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { beforeEach, describe, expect, it } from "vitest";

import { selectionPressHandled } from "../../src/commands/selection-footnote";
import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

// An escaped "\[^]" is literal prose, not a placeholder: Reading view
// renders it as typed, and the unnamed-reference alert already ignores it
// on exactly that ruling (Kimi hunt cycle 1, 2026-09-16: "an escaped
// \[^] is not a placeholder"). ADR-0001's corollary: dead
// reference-shaped text is not a footnote and travels freely.
//
// The selection conversion's nesting check never got the memo.
// spanTouchesFootnote (selection-footnote.ts) scans the masked line for
// "[^]" with no escape check, so a selection over prose that happens to
// discuss footnote syntax refuses to convert with the nested-footnote
// toast - as if the escaped text were a live placeholder the conversion
// would nest.
//
// What the user sees: they select "see \[^] here" (a sentence ABOUT
// footnotes) and press the numbered key: the press is refused with
// "footnotes can't be nested inside other footnotes", which is nonsense
// there - nothing in the selection is a footnote.
//
// Source of truth: the cycle-1 ruling that an escaped \[^] is not a
// placeholder (pinned for the alert in
// test/hunt/bug-escaped-placeholder-alert.test.ts or its siblings) +
// ADR-0001 (docs/adr/0001-no-nested-footnotes.md): only LIVE footnote
// artifacts refuse a conversion.
//
// Settings involved: none (the selection claim is always on).

describe("a selection over an escaped \\[^] converts like any prose", () => {
    beforeEach(resetNotices);

    it("the numbered key converts instead of refusing to nest", () => {
        // the selection is "see \\[^]" (the pin's original indices reached
        // into "here" and so converted a split word)
        const doc = fakeEditor(["see \\[^] here"], {
            selection: { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 8 } },
            edits: true,
            wholeDoc: true,
        });
        const plugin = fakePlugin();
        selectionPressHandled(plugin, doc, null, "autonum", { line: 0, ch: 8 });
        expect(messages()).toEqual([]);
        expect(doc.lines[0]).toBe("[^1] here");
        expect(doc.lines[2]).toBe("[^1]: see \\[^]");
    });

    it("control: a selection over a REAL placeholder refuses to nest", () => {
        const doc = fakeEditor(["see [^] here"], {
            selection: { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 11 } },
            edits: true,
            wholeDoc: true,
        });
        const plugin = fakePlugin();
        selectionPressHandled(plugin, doc, null, "autonum", { line: 0, ch: 11 });
        expect(messages().some((m) => m.includes("nested"))).toBe(true);
        expect(doc.lines[0]).toBe("see [^] here");
    });

    it("control: plain prose converts", () => {
        const doc = fakeEditor(["see note here"], {
            selection: { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 8 } },
            edits: true,
            wholeDoc: true,
        });
        const plugin = fakePlugin();
        selectionPressHandled(plugin, doc, null, "autonum", { line: 0, ch: 8 });
        expect(doc.lines[0]).toBe("[^1] here");
        expect(doc.lines[2]).toBe("[^1]: see note");
    });
});
