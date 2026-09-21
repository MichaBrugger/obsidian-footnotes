import { beforeEach, describe, expect, it } from "vitest";
import type { EditorPosition } from "obsidian";

import { fakeEditor as sharedFakeEditor, FakeEditor } from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";
import { messages, noticed, resetNotices } from "./helpers/notices";

import type FootnotePlugin from "../src/main";
import { insertAutonumFootnote } from "../src/commands/insert-or-navigate-footnotes";
import { ProtectedSelectionNotice } from "../src/commands/selection-footnote";

// These tests take over four checks that used to sit on manual sheet 06
// ("Selection to footnote"). Each one is a text outcome, so a machine can
// settle it and Jason does not have to:
//
//  1. "Select `x+y` inside the dollars (cutting the math), numbered key:
//     'No footnote was created: the selection cuts through code, math, or
//     other protected text. Select all of it or none of it.'"
//  2. "Select from the line ABOVE the fence to just its opening ``` line
//     (cutting the block in half): the same toast"
//  3. "Select from the line above the fence through its closing ``` line
//     (the whole block): it converts; the fence rides into the definition
//     indented"
//  4. "Select the fence ALONE: it converts with an EMPTY label line, and
//     with `Lint on footnote creation` ON the lint changes nothing else:
//     [^d] keeps its definition, no waiting notice, the caret lands in
//     the new footnote"
//
// The rendering halves of 3 and 4 ("renders as code inside the footnote")
// stay with Jason: only eyes in Reading view can settle those.
//
// A "fake editor" is a stand-in for Obsidian's real editor: it holds the
// note as an array of lines, applies the edits the plugin asks for, and
// remembers where the caret ended up. Each test drives
// insertAutonumFootnote, which is exactly what the numbered hotkey runs.

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

// The sheet's settings: defaults, with the popup off and whole-word
// expansion off, so each selection converts exactly as the sheet makes it.
function fakePlugin(
    doc: FakeEditor,
    overrides: Partial<FootnotePlugin["settings"]> = {},
): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
            expandSelectionToWholeWords: false,
            ...overrides,
        },
        doc,
    );
}

beforeEach(resetNotices);

describe("a selection that cuts through inline math refuses (sheet 06)", () => {
    it("selecting x+y from inside the dollars changes nothing and says why", async () => {
        const before = ["Fixture lines: and $x+y$ math; a live reference here."];
        const from = before[0].indexOf("x+y");
        const doc = fakeEditor(before, { line: 0, ch: from }, {
            anchor: { line: 0, ch: from },
            head: { line: 0, ch: from + "x+y".length },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });
});

describe("selections at a fenced code block's edges (sheet 06)", () => {
    const NOTE = [
        "The line above the fence.",
        "```",
        "select me in here",
        "```",
    ];

    it("the prose above through the fence's OPENING line refuses: that would cut the block in half", async () => {
        const doc = fakeEditor(NOTE, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 1, ch: 3 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(NOTE);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("the prose above through the CLOSING line converts, the fence riding into the body indented", async () => {
        const doc = fakeEditor(NOTE, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 3, ch: 3 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "[^1]",
            "",
            "[^1]: The line above the fence.",
            "    ```",
            "    select me in here",
            "    ```",
        ]);
    });
});

describe("the fence selected ALONE (sheet 06, the 2026-09-09 fix)", () => {
    // A fence is the one construct that never shares the label line: the
    // label line is left empty and the fence starts indented underneath.
    // Before this fix the opener landed ON the label line, and the
    // plugin's own scanner then read the indented closer as a second
    // opener, so every definition below it turned into code.
    const NOTE = [
        "Fixture for the definition checks[^d].",
        "",
        "```",
        "select me in here",
        "```",
        "",
        "[^d]: press the inline hotkey with the caret right here",
    ];
    const fenceSelection = {
        anchor: { line: 2, ch: 0 },
        head: { line: 4, ch: 3 },
    };

    it("converts with an EMPTY label line and the fence indented below it", async () => {
        const doc = fakeEditor(NOTE, { line: 2, ch: 0 }, fenceSelection);
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "Fixture for the definition checks[^d].",
            "",
            "[^1]",
            "",
            "[^d]: press the inline hotkey with the caret right here",
            "[^1]: ",
            "    ```",
            "    select me in here",
            "    ```",
        ]);
    });

    it("with the creation lint on, [^d] keeps its definition, nothing warns, and the caret is in the new footnote", async () => {
        const doc = fakeEditor(NOTE, { line: 2, ch: 0 }, fenceSelection);
        await insertAutonumFootnote(
            fakePlugin(doc, {
                lintOnFootnoteCreation: true,
                lintReindex: true,
                lintMoveToBottom: true,
            }),
        );
        const text = doc.lines.join("\n");
        // the other footnote survives the lint with its body intact
        expect(text).toContain(
            "[^d]: press the inline hotkey with the caret right here",
        );
        // the fence is still a fence, indented under an empty label line
        expect(text).toContain("[^1]: \n    ```\n    select me in here\n    ```");
        // the ordinary lint report is the ONLY toast: no orphaned-
        // reference alert, no "waiting for Obsidian to index" notice, no
        // refusal
        expect(messages()).toEqual(["Footnotes linted."]);
        // and the caret sits inside the new footnote's block, not back in
        // the prose and not on the other footnote
        const label = doc.lines.indexOf("[^1]: ");
        expect(doc.cursor.line).toBeGreaterThanOrEqual(label);
        expect(doc.cursor.line).toBeLessThanOrEqual(label + 3);
    });
});
