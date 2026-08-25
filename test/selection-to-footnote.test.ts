import { App, EditorPosition } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeCalls } from "./mocks/obsidian";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

import FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
    pasteInlineFootnote,
} from "../src/commands/insert-or-navigate-footnotes";
import {
    convertCellSelectionToNamed,
    InlineSelectionNotice,
    NestedSelectionNotice,
    ProtectedSelectionNotice,
    convertSelectionToNamed,
    registerActiveNameModal,
    selectionPressHandled,
    submitActiveNameModal,
    SelectionChangedNotice,
    SelectionCommandNotice,
    SelectionSpanNotice,
} from "../src/commands/selection-footnote";
import { ProtectedCreationNotice } from "../src/editor/insertion-liveness";
import { commandHotkeys } from "../src/editor/obsidian-internals";
import { DefinitionCreationNotice } from "../src/commands/press-guards";
import { TableCellEditor } from "../src/editor/table-cursor";

// Turning a selection into a footnote (issue #35, Jason's calls 2026-08-12:
// overload the existing hotkeys, always on; single-line selections only;
// named/paste redirect instead of converting). The auto-numbered key moves
// the selected text into a new definition's body; the inline key wraps it
// as "^[…]" in place. The generative twin lives in
// command-properties.test.ts — these pin the concrete contracts.

// with `selection` undefined, the shared fake's listSelections falls back
// to a live collapsed range at the current cursor — the same behavior the
// old local fake's `selection ? [selection] : [...cursor...]` gave.
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
    noticeCalls.length = 0;
});
afterEach(() => {
    vi.unstubAllGlobals();
});

const noticed = (message: string) =>
    noticeCalls.some((args) => args[0] === message);

describe("the auto-numbered key converts a selection", () => {
    it("moves the selected text into a new definition's body", async () => {
        const doc = fakeEditor(
            ["The quick fox jumps", "", "tail"],
            { line: 0, ch: 9 },
            { anchor: { line: 0, ch: 4 }, head: { line: 0, ch: 9 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        // the first footnote gets its usual blank separator line
        expect(doc.lines).toEqual([
            "The [^1] fox jumps",
            "",
            "tail",
            "",
            "[^1]: quick",
        ]);
        // the caret lands at the end of the pre-filled body, ready to edit
        expect(doc.cursor).toEqual({ line: 4, ch: "[^1]: quick".length });
    });

    it("numbers past existing footnotes and appends after the last block", async () => {
        const doc = fakeEditor(
            ["word here[^1]", "", "[^1]: a"],
            { line: 0, ch: 0 },
            { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 4 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "[^2] here[^1]",
            "",
            "[^1]: a",
            "[^2]: word",
        ]);
    });

    it("sheds the selection's whitespace edges back into the prose", async () => {
        const doc = fakeEditor(
            ["The quick fox jumps"],
            { line: 0, ch: 3 },
            // " quick " selected, spaces included
            { anchor: { line: 0, ch: 3 }, head: { line: 0, ch: 10 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("The [^1] fox jumps");
    });

    it("a REVERSED (head-before-anchor) selection converts the same", async () => {
        const doc = fakeEditor(
            ["The quick fox jumps"],
            { line: 0, ch: 4 },
            { anchor: { line: 0, ch: 9 }, head: { line: 0, ch: 4 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("The [^1] fox jumps");
    });

    it("a full-line drag (ending at ch 0 of the next line) converts the line", async () => {
        const doc = fakeEditor(
            ["word", "next"],
            { line: 0, ch: 0 },
            { anchor: { line: 0, ch: 0 }, head: { line: 1, ch: 0 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["[^1]", "next", "", "[^1]: word"]);
    });

    it("a whitespace-only selection falls through to a plain insert", async () => {
        const doc = fakeEditor(
            ["The quick fox"],
            { line: 0, ch: 4 },
            { anchor: { line: 0, ch: 3 }, head: { line: 0, ch: 4 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        // the ordinary caret cascade ran instead: reference at the caret,
        // empty definition appended
        expect(doc.lines).toEqual(["The [^1]quick fox", "", "[^1]: "]);
    });
});

describe("the inline key converts a selection", () => {
    it("wraps the selected text as ^[…] in place, caret after the bracket", async () => {
        const doc = fakeEditor(
            ["The quick fox jumps"],
            { line: 0, ch: 9 },
            { anchor: { line: 0, ch: 4 }, head: { line: 0, ch: 9 } },
        );
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["The ^[quick] fox jumps"]);
        expect(doc.cursor).toEqual({ line: 0, ch: 4 + "^[quick]".length });
    });

    it("escapes an unbalanced bracket so the wrapper can't end early", async () => {
        const doc = fakeEditor(
            ["pay a ] b now"],
            { line: 0, ch: 4 },
            // "a ] b" selected
            { anchor: { line: 0, ch: 4 }, head: { line: 0, ch: 9 } },
        );
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["pay ^[a \\] b] now"]);
    });
});

describe("the named key converts a selection through its modal (2026-08-13)", () => {
    // the modal is thin wiring over convertSelectionToNamed — these drive
    // the exported conversion the way its submit does
    it("replaces the selection with [^name] and seeds the definition", () => {
        const doc = fakeEditor(["The quick fox jumps"], { line: 0, ch: 4 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            {
                from: { line: 0, ch: 4 },
                to: { line: 0, ch: 9 },
                text: "quick",
            },
            "Speed2026",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual([
            "The [^Speed2026] fox jumps",
            "",
            "[^Speed2026]: quick",
        ]);
        expect(doc.cursor).toEqual({ line: 2, ch: "[^Speed2026]: quick".length });
    });

    it("healing an orphan: a name only dangling references carry is welcome", () => {
        const doc = fakeEditor(["see [^lost] and quick brown"], { line: 0, ch: 16 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            {
                from: { line: 0, ch: 16 },
                to: { line: 0, ch: 21 },
                text: "quick",
            },
            "lost",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual([
            "see [^lost] and [^lost] brown",
            "",
            "[^lost]: quick",
        ]);
    });

    it("refuses a name that is already DEFINED, inline", () => {
        const before = ["The quick fox", "", "[^taken]: existing"];
        const doc = fakeEditor(before, { line: 0, ch: 4 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            { from: { line: 0, ch: 4 }, to: { line: 0, ch: 9 }, text: "quick" },
            "Taken",
        );
        expect(problem).toBe('"[^Taken]" is already defined. Pick a new name.');
        expect(doc.lines).toEqual(before);
    });

    it("refuses invalid names with the reason, inline", () => {
        const doc = fakeEditor(["The quick fox"], { line: 0, ch: 4 });
        const selection = {
            from: { line: 0, ch: 4 },
            to: { line: 0, ch: 9 },
            text: "quick",
        };
        expect(
            convertSelectionToNamed(fakePlugin(doc), doc, selection, "bad name"),
        ).toBe("Footnote names can't contain spaces or backticks.");
        expect(
            convertSelectionToNamed(fakePlugin(doc), doc, selection, "a[b"),
        ).toBe("Footnote names can't contain brackets.");
        expect(doc.lines).toEqual(["The quick fox"]);
    });

    it("bails with a notice when the note changed under the open modal", () => {
        const doc = fakeEditor(["The rapid fox"], { line: 0, ch: 4 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            // captured before the note changed: the span no longer reads
            // "quick"
            { from: { line: 0, ch: 4 }, to: { line: 0, ch: 9 }, text: "quick" },
            "fine",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual(["The rapid fox"]);
        expect(noticed(SelectionChangedNotice)).toBe(true);
    });

    it("refuses a born-dead conversion like autonum does", () => {
        const before = ["> $$", "> quoted math[^75]"];
        const doc = fakeEditor(before, { line: 0, ch: 0 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            { from: { line: 0, ch: 0 }, to: { line: 0, ch: 1 }, text: ">" },
            "dead",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });
});

describe("a multi-line selection converts into a multi-paragraph definition (2026-08-19)", () => {
    it("indents continuation lines four spaces under the seeded label", async () => {
        const before = ["intro", "first para", "", "second para", "outro"];
        const doc = fakeEditor(before, { line: 1, ch: 0 }, {
            anchor: { line: 1, ch: 0 },
            head: { line: 3, ch: "second para".length },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "intro",
            "[^1]",
            "outro",
            "",
            "[^1]: first para",
            "    ",
            "    second para",
        ]);
        // the caret lands at the end of the LAST body line
        expect(doc.cursor).toEqual({ line: 6, ch: "    second para".length });
    });

    it("converts Jason's academic shape: paragraphs around a whole fenced code block", async () => {
        const before = [
            "This is a test.",
            "First paragraph of the note.",
            "",
            "```",
            "\tlorem ipsum dolor sit",
            "```",
            "",
            "Closing paragraph.",
        ];
        const doc = fakeEditor(before, { line: 1, ch: 0 }, {
            anchor: { line: 1, ch: 0 },
            head: { line: 7, ch: "Closing paragraph.".length },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "This is a test.",
            "[^1]",
            "",
            "[^1]: First paragraph of the note.",
            "    ",
            "    ```",
            "    \tlorem ipsum dolor sit",
            "    ```",
            "    ",
            "    Closing paragraph.",
        ]);
        expect(doc.cursor).toEqual({
            line: 9,
            ch: "    Closing paragraph.".length,
        });
    });

    it("stitches the unselected prefix and suffix onto one line", async () => {
        const doc = fakeEditor(
            ["keep this. move me", "and me. keep too"],
            { line: 0, ch: 11 },
            {
                anchor: { line: 0, ch: 11 },
                head: { line: 1, ch: 7 },
            },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "keep this. [^1] keep too",
            "",
            "[^1]: move me",
            "    and me.",
        ]);
    });

    it("sheds blank edge lines back into the prose", async () => {
        const doc = fakeEditor(
            ["", "the payload", "", "tail"],
            { line: 0, ch: 0 },
            { anchor: { line: 0, ch: 0 }, head: { line: 2, ch: 0 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "",
            "[^1]",
            "",
            "tail",
            "",
            "[^1]: the payload",
        ]);
    });

    it("the inline key REFUSES a multi-line selection, pointing at the other keys", async () => {
        // flatten-like-paste was tried and reverted (Jason, 2026-08-20):
        // it basically never looked correct outside clean paragraphs
        const before = ["see first para", "", "second para here"];
        const doc = fakeEditor(before, { line: 0, ch: 4 }, {
            anchor: { line: 0, ch: 4 },
            head: { line: 2, ch: "second para".length },
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(InlineSelectionNotice)).toBe(true);
    });

    it("a full-line drag still converts on the inline key (it normalizes to ONE line)", async () => {
        const doc = fakeEditor(
            ["wrap me", "next"],
            { line: 0, ch: 0 },
            { anchor: { line: 0, ch: 0 }, head: { line: 1, ch: 0 } },
        );
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["^[wrap me]", "next"]);
    });

    it("the named modal converts a multi-line selection under the typed name", () => {
        const doc = fakeEditor(["para one", "para two"], { line: 0, ch: 0 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            {
                from: { line: 0, ch: 0 },
                to: { line: 1, ch: 8 },
                text: "para one\npara two",
            },
            "Smith2019",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual([
            "[^Smith2019]",
            "",
            "[^Smith2019]: para one",
            "    para two",
        ]);
    });

    it("the named modal notices a multi-line selection gone stale", () => {
        const doc = fakeEditor(["para one", "para 2wo"], { line: 0, ch: 0 });
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            {
                from: { line: 0, ch: 0 },
                to: { line: 1, ch: 8 },
                text: "para one\npara two",
            },
            "fine",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual(["para one", "para 2wo"]);
        expect(noticed(SelectionChangedNotice)).toBe(true);
    });
});

describe("whole protected constructs travel INTO the footnote (2026-08-19)", () => {
    it("a selection containing a whole inline code span converts, span intact", async () => {
        const doc = fakeEditor(
            ["keep the `magic word` here"],
            { line: 0, ch: 5 },
            { anchor: { line: 0, ch: 5 }, head: { line: 0, ch: 21 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "keep [^1] here",
            "",
            "[^1]: the `magic word`",
        ]);
    });

    it("a selection containing a whole math span converts (inline key)", async () => {
        const doc = fakeEditor(["a $x$ b"], { line: 0, ch: 2 }, {
            anchor: { line: 0, ch: 2 },
            head: { line: 0, ch: 5 },
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["a ^[$x$] b"]);
    });

    it("a whole $$ display-math block rides into the definition body", async () => {
        const doc = fakeEditor(
            ["prose before", "$$", "E = mc^2", "$$", "prose after"],
            { line: 0, ch: 0 },
            {
                anchor: { line: 0, ch: 0 },
                head: { line: 4, ch: "prose after".length },
            },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "[^1]",
            "",
            "[^1]: prose before",
            "    $$",
            "    E = mc^2",
            "    $$",
            "    prose after",
        ]);
    });
});

describe("selections that refuse", () => {
    it("multiple selection ranges warn and edit nothing", async () => {
        const before = ["alpha beta gamma"];
        const doc = fakeEditor(before, { line: 0, ch: 0 });
        (doc as unknown as { listSelections: () => unknown }).listSelections =
            () => [
                { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 5 } },
                { anchor: { line: 0, ch: 6 }, head: { line: 0, ch: 10 } },
            ];
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(SelectionSpanNotice)).toBe(true);
    });

    it("multiple CARETS now insert the SAME footnote at every one (2026-08-22)", async () => {
        // superseded behavior: extras used to be ignored (2026-08-21) —
        // Jason's ask upgraded this to same-reference-everywhere; the full
        // multi-caret contract lives in test/multi-caret.test.ts
        const doc = fakeEditor(["alpha bravo", "charlie delta"], {
            line: 0,
            ch: 5,
        });
        (doc as unknown as { listSelections: () => unknown }).listSelections =
            () => [
                { anchor: { line: 0, ch: 5 }, head: { line: 0, ch: 5 } },
                { anchor: { line: 1, ch: 7 }, head: { line: 1, ch: 7 } },
            ];
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "alpha[^1] bravo",
            "charlie[^1] delta",
            "",
            "[^1]: ",
        ]);
    });

    it("the named key claims the press for its name modal, editing nothing yet", async () => {
        // the modal itself is DOM territory (smoke suite); in units the
        // press must consume the selection silently and leave the document
        // to the modal's submit
        const before = ["The quick fox"];
        const doc = fakeEditor(before, { line: 0, ch: 4 }, {
            anchor: { line: 0, ch: 4 },
            head: { line: 0, ch: 9 },
        });
        await insertNamedFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticeCalls).toEqual([]);
    });

    it("the paste key redirects WITHOUT touching the clipboard", async () => {
        const reads = { count: 0 };
        vi.stubGlobal("navigator", {
            clipboard: {
                readText: async () => {
                    reads.count++;
                    return "clip";
                },
            },
        });
        const before = ["The quick fox"];
        const doc = fakeEditor(before, { line: 0, ch: 4 }, {
            anchor: { line: 0, ch: 4 },
            head: { line: 0, ch: 9 },
        });
        await pasteInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(SelectionCommandNotice)).toBe(true);
        expect(reads.count).toBe(0);
    });

    it("a selection inside a fenced code block refuses (autonum)", async () => {
        const before = ["```", "code here", "```"];
        const doc = fakeEditor(before, { line: 1, ch: 0 }, {
            anchor: { line: 1, ch: 0 },
            head: { line: 1, ch: 4 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("a selection inside a fenced code block refuses (inline)", async () => {
        const before = ["```", "code here", "```"];
        const doc = fakeEditor(before, { line: 1, ch: 0 }, {
            anchor: { line: 1, ch: 0 },
            head: { line: 1, ch: 4 },
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("selecting part of a fence DELIMITER refuses (found by the conversion property)", async () => {
        // wrapping the opener's first backtick as "^[`]" would un-fence
        // everything below it — the simulated RESULT looks live precisely
        // because the construct got destroyed, so the up-front protected
        // check must own this, not the born-dead simulation
        const before = ["```", "fake[^1]", "```"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 0, ch: 1 },
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("selecting inside an inline code span refuses", async () => {
        const before = ["a `co de` b"];
        const doc = fakeEditor(before, { line: 0, ch: 3 }, {
            anchor: { line: 0, ch: 3 },
            head: { line: 0, ch: 5 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("a replacement that would demote a quote and strand its own definition refuses", async () => {
        // replacing the ">" leaves "$$" doc-level, swallowing everything
        // below — including the definition the same transaction appends
        // (the quote-demotion class the press property suite found)
        const before = ["> $$", "> quoted math[^75]"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 0, ch: 1 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("a multi-line selection that CUTS a fence refuses (opener grabbed, closer left)", async () => {
        // taking the opener and interior without the closer would turn the
        // stranded "```" into an opener that swallows the rest of the note
        const before = ["prose", "```", "code", "```", "below[^1]", "", "[^1]: x"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 2, ch: 4 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("a multi-line selection ending inside a fence refuses", async () => {
        const before = ["prose here", "```", "code", "```"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 2, ch: 2 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("a full-line drag on a QUOTED fence's interior refuses (30k-soak find, 2026-08-20)", async () => {
        // the found counterexample: replacing the interior line (its "> "
        // marker included) demoted the quote, which killed the fence and
        // turned protected text into an inline footnote. Quoted fences are
        // invisible to endsProtected, so the edge check needs the
        // scanner's startsInFence flag.
        const before = [
            "---",
            "title: t",
            "---",
            "alpha[^1].",
            "",
            "[^1]: alpha",
            "",
            "> ```",
            "> fake[^1]",
            "> ```",
        ];
        for (const command of [insertInlineFootnote, insertAutonumFootnote]) {
            noticeCalls.length = 0;
            const doc = fakeEditor(before, { line: 8, ch: 0 }, {
                anchor: { line: 8, ch: 0 },
                head: { line: 9, ch: 0 },
            });
            await command(fakePlugin(doc));
            expect(doc.lines).toEqual(before);
            expect(noticed(ProtectedSelectionNotice)).toBe(true);
        }
    });

    it("selecting exactly a quoted fence's CLOSER line refuses", async () => {
        // the closer's protection also comes from above — consuming it
        // would leave the fence unclosed
        const before = ["> ```", "> code", "> ```"];
        const doc = fakeEditor(before, { line: 2, ch: 0 }, {
            anchor: { line: 2, ch: 0 },
            head: { line: 2, ch: 5 },
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("a WHOLE quoted fence still converts (containment unaffected)", async () => {
        const doc = fakeEditor(
            ["take this", "", "> ```", "> code", "> ```", "", "and this"],
            { line: 0, ch: 0 },
            { anchor: { line: 0, ch: 0 }, head: { line: 6, ch: 8 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "[^1]",
            "",
            "[^1]: take this",
            "    ",
            "    > ```",
            "    > code",
            "    > ```",
            "    ",
            "    and this",
        ]);
    });

    it("a selection ending mid inline-code on its last line refuses", async () => {
        const before = ["take this", "and `co de` more"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 1, ch: 7 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("a selection overlapping YAML frontmatter refuses", async () => {
        // properties are note metadata, not prose — even swallowed whole
        // they don't belong in a footnote body
        const before = ["---", "title: x", "---", "prose here"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 3, ch: 5 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("a multi-line selection lapping an existing definition refuses (no nesting)", async () => {
        const before = ["prose[^a] here", "", "[^a]: existing", "tail prose"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 2, ch: 6 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(DefinitionCreationNotice)).toBe(true);
    });

    it("a multi-line selection swallowing a whole definition refuses too", async () => {
        const before = ["prose[^a] here", "", "[^a]: existing", "", "tail prose"];
        const doc = fakeEditor(before, { line: 1, ch: 0 }, {
            anchor: { line: 1, ch: 0 },
            head: { line: 4, ch: 10 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(DefinitionCreationNotice)).toBe(true);
    });
});

describe("selections inside an actively edited table cell", () => {
    function fakeCell(text: string, anchor: number, head: number) {
        const dispatched: {
            changes?: { from: number; to?: number; insert: string };
            selection?: { anchor: number };
        }[] = [];
        const cell: TableCellEditor = {
            state: {
                doc: { toString: () => text },
                selection: { main: { head, anchor } },
            },
            dispatch: (spec) => {
                dispatched.push(spec);
            },
        };
        return { cell, dispatched };
    }

    it("the inline key wraps the cell selection through the cell's editor", () => {
        const { cell, dispatched } = fakeCell("plain word here", 6, 10);
        const doc = fakeEditor(
            ["| plain word here |", "| --- |", "| x |"],
            { line: 0, ch: 8 },
        );
        const handled = selectionPressHandled(fakePlugin(doc), doc, cell, "inline");
        expect(handled).toBe(true);
        expect(dispatched).toEqual([
            {
                changes: { from: 6, to: 10, insert: "^[word]" },
                selection: { anchor: 6 + "^[word]".length },
            },
        ]);
    });

    it("the auto-numbered key replaces in the cell and appends the seeded definition", () => {
        const { cell, dispatched } = fakeCell("plain word here", 6, 10);
        const doc = fakeEditor(
            ["| plain word here |", "| --- |", "| x |"],
            { line: 0, ch: 8 },
        );
        const handled = selectionPressHandled(
            fakePlugin(doc),
            doc,
            cell,
            "autonum",
            { line: 0, ch: 8 },
        );
        expect(handled).toBe(true);
        expect(dispatched).toEqual([
            {
                changes: { from: 6, to: 10, insert: "[^1]" },
                selection: { anchor: 6 + "[^1]".length },
            },
        ]);
        expect(doc.lines[doc.lines.length - 1]).toBe("[^1]: word");
    });

    it("an empty cell selection is no claim — the caret cascade owns the press", () => {
        const { cell, dispatched } = fakeCell("plain word here", 7, 7);
        const doc = fakeEditor(["| plain word here |"], { line: 0, ch: 8 });
        expect(
            selectionPressHandled(fakePlugin(doc), doc, cell, "inline"),
        ).toBe(false);
        expect(dispatched).toEqual([]);
    });

    it("a cell selection inside the cell's inline code refuses", () => {
        const { cell, dispatched } = fakeCell("has `co de` x", 6, 8);
        const doc = fakeEditor(["| has `co de` x |"], { line: 0, ch: 7 });
        expect(
            selectionPressHandled(fakePlugin(doc), doc, cell, "inline"),
        ).toBe(true);
        expect(dispatched).toEqual([]);
        expect(noticed(ProtectedSelectionNotice)).toBe(true);
    });

    it("the named key claims a cell selection for its modal, dispatching nothing yet", () => {
        const { cell, dispatched } = fakeCell("plain word here", 6, 10);
        const doc = fakeEditor(["| plain word here |"], { line: 0, ch: 8 });
        expect(
            selectionPressHandled(fakePlugin(doc), doc, cell, "named"),
        ).toBe(true);
        expect(dispatched).toEqual([]);
        expect(noticeCalls).toEqual([]);
    });

    it("the modal's submit converts the cell selection under the typed name", () => {
        const { cell, dispatched } = fakeCell("plain word here", 6, 10);
        const doc = fakeEditor(
            ["| plain word here |", "| --- |", "| x |"],
            { line: 0, ch: 8 },
        );
        const problem = convertCellSelectionToNamed(
            fakePlugin(doc),
            doc,
            cell,
            { from: 6, to: 10, text: "word" },
            "src",
            { line: 0, ch: 8 },
        );
        expect(problem).toBeNull();
        expect(dispatched).toEqual([
            {
                changes: { from: 6, to: 10, insert: "[^src]" },
                selection: { anchor: 6 + "[^src]".length },
            },
        ]);
        expect(doc.lines[doc.lines.length - 1]).toBe("[^src]: word");
    });
});

// ---------------------------------------------------------------------------
// the block zoo (2026-08-19): every block construct Obsidian speaks, selected
// WHOLE inside a conversion — these pin the exact seeded definition so the
// manual combo sheet (A13) can promise what the note will hold. Rendering
// inside the footnote/popup is A13's eyeball territory; the text shape is
// pinned here.
// ---------------------------------------------------------------------------

describe("the block zoo converts (2026-08-19)", () => {
    /** Convert `middle` (with a prose line above and below it riding along) via autonum and return the resulting lines. */
    async function convertBlock(middle: string[]): Promise<string[]> {
        const lines = ["above prose", ...middle, "below prose", "tail stays"];
        const lastSelected = lines.length - 2;
        const doc = fakeEditor(lines, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: lastSelected, ch: lines[lastSelected].length },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        return doc.lines;
    }

    const indented = (middle: string[]) => [
        "[^1]",
        "tail stays",
        "",
        "[^1]: above prose",
        ...middle.map((l) => (l.trim() === "" ? "    " : `    ${l}`)),
        "    below prose",
    ];

    // fixtures are BLANK-PADDED like the A13 sheet (Jason's fix,
    // 2026-08-20): in Live Preview most blocks only render correctly with
    // a blank line between them and surrounding text, so that's the
    // realistic selection shape
    it("a bulleted list (nested item included)", async () => {
        const middle = ["", "- alpha", "    - nested", "- beta", ""];
        expect(await convertBlock(middle)).toEqual(indented(middle));
    });

    it("a numbered list and a task item", async () => {
        const middle = ["", "1. first", "2. second", "- [ ] task", ""];
        expect(await convertBlock(middle)).toEqual(indented(middle));
    });

    it("a blockquote", async () => {
        const middle = ["", "> quoted line", "> second quoted", ""];
        expect(await convertBlock(middle)).toEqual(indented(middle));
    });

    it("a callout", async () => {
        const middle = ["", "> [!note] Heads up", "> callout body", ""];
        expect(await convertBlock(middle)).toEqual(indented(middle));
    });

    it("a horizontal rule", async () => {
        const middle = ["", "---", ""];
        expect(await convertBlock(middle)).toEqual(indented(middle));
    });

    it("a heading", async () => {
        const middle = ["", "## Section title", ""];
        expect(await convertBlock(middle)).toEqual(indented(middle));
    });

    it("image links, markdown and wikilink embed flavors", async () => {
        const middle = ["![alt text](https://example.org/pic.png)", "![[vault image.png]]"];
        expect(await convertBlock(middle)).toEqual(indented(middle));
    });

    it("a table", async () => {
        const middle = ["", "| a | b |", "| --- | --- |", "| 1 | 2 |", ""];
        expect(await convertBlock(middle)).toEqual(indented(middle));
    });

    it("a fence, a $$ block, and inline math together (the A13 fixture)", async () => {
        const middle = [
            "```",
            "fenced code here",
            "```",
            "$$",
            "E = mc^2",
            "$$",
            "inline math before $1+1\\neq3$ and after",
        ];
        expect(await convertBlock(middle)).toEqual(indented(middle));
    });

    it("the inline key flattens a SINGLE-line image link without escaping its brackets", async () => {
        // balanced brackets pass the sanitizer untouched — the embed keeps
        // working inside the inline footnote
        const doc = fakeEditor(
            ["see ![alt](https://x.org/p.png) here"],
            { line: 0, ch: 4 },
            { anchor: { line: 0, ch: 4 }, head: { line: 0, ch: 31 } },
        );
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "see ^[![alt](https://x.org/p.png)] here",
        ]);
    });

    it("the inline key refuses the zoo's multi-line fixtures like any other", async () => {
        const before = ["see ![alt](https://x.org/p.png)", "and more here"];
        const doc = fakeEditor(before, { line: 0, ch: 4 }, {
            anchor: { line: 0, ch: 4 },
            head: { line: 1, ch: 8 },
        });
        await insertInlineFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(InlineSelectionNotice)).toBe(true);
    });

    it("the named modal takes a block-zoo selection too", () => {
        const doc = fakeEditor(
            ["pick > quoted", "- listed end"],
            { line: 0, ch: 5 },
        );
        const problem = convertSelectionToNamed(
            fakePlugin(doc),
            doc,
            {
                from: { line: 0, ch: 5 },
                to: { line: 1, ch: 8 },
                text: "> quoted\n- listed",
            },
            "zoo",
        );
        expect(problem).toBeNull();
        expect(doc.lines).toEqual([
            "pick [^zoo] end",
            "",
            "[^zoo]: > quoted",
            "    - listed",
        ]);
    });
});

describe("quote-relative indented code refuses at the edges (second 30k-soak find, 2026-08-20)", () => {
    it("a full-line drag on a quoted code line refuses (its '>' sits at ch 0)", async () => {
        // the found counterexample, minimized: quote-relative indented
        // code is protected but carries no region flag, and its quote
        // marker at ch 0 is where the whitespace trim can't shield the
        // edge — converting it consumed protected text
        const before = ["", ">     > gap code[^88]", "", "alpha[^1]."];
        for (const command of [insertInlineFootnote, insertAutonumFootnote]) {
            noticeCalls.length = 0;
            const doc = fakeEditor(before, { line: 1, ch: 0 }, {
                anchor: { line: 0, ch: 0 },
                head: { line: 2, ch: 0 },
            });
            await command(fakePlugin(doc));
            expect(doc.lines).toEqual(before);
            expect(noticed(ProtectedSelectionNotice)).toBe(true);
        }
    });

    it("a doc-level indented chunk at the selection TAIL still travels (containment)", async () => {
        const doc = fakeEditor(
            ["take this", "", "    chunk line one", "    chunk line two"],
            { line: 0, ch: 0 },
            { anchor: { line: 0, ch: 0 }, head: { line: 3, ch: 18 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "[^1]",
            "",
            "[^1]: take this",
            "    ",
            "        chunk line one",
            "        chunk line two",
        ]);
    });
});

describe("a footnote command submits the open name modal (2026-08-22)", () => {
    // the modal itself is DOM/smoke territory; these drive the exported
    // registry the way onOpen/onClose do
    afterEach(() => {
        registerActiveNameModal(null);
    });

    it("any creation command submits the registered modal and edits nothing itself", async () => {
        const submissions: string[] = [];
        registerActiveNameModal({ submit: () => submissions.push("submit") });
        const before = ["alpha bravo", "charlie"];
        const doc = fakeEditor(before, { line: 0, ch: 3 });
        await insertAutonumFootnote(fakePlugin(doc));
        await insertInlineFootnote(fakePlugin(doc));
        expect(submissions).toEqual(["submit", "submit"]);
        expect(doc.lines).toEqual(before);
    });

    it("with no modal registered, commands run normally", async () => {
        registerActiveNameModal(null);
        const doc = fakeEditor(["alpha bravo"], { line: 0, ch: 5 });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(["alpha[^1] bravo", "", "[^1]: "]);
    });

    it("submitActiveNameModal reports whether a modal claimed the press", () => {
        expect(submitActiveNameModal()).toBe(false);
        let submitted = 0;
        registerActiveNameModal({ submit: () => submitted++ });
        expect(submitActiveNameModal()).toBe(true);
        expect(submitted).toBe(1);
        registerActiveNameModal(null);
        expect(submitActiveNameModal()).toBe(false);
        expect(submitted).toBe(1);
    });
});

describe("commandHotkeys reads the hotkey registry defensively (2026-08-22)", () => {
    it("custom assignment wins, defaults fall back, absent manager degrades to none", () => {
        const app = (hm: unknown) => ({ hotkeyManager: hm }) as unknown as App;
        const custom = [{ modifiers: ["Alt"], key: "0" }];
        const defaults = [{ modifiers: ["Mod"], key: "9" }];
        expect(
            commandHotkeys(
                app({ getHotkeys: () => custom, getDefaultHotkeys: () => defaults }),
                "x:y",
            ),
        ).toEqual(custom);
        expect(
            commandHotkeys(
                app({ getHotkeys: () => null, getDefaultHotkeys: () => defaults }),
                "x:y",
            ),
        ).toEqual(defaults);
        expect(
            commandHotkeys(
                app({ getHotkeys: () => null, getDefaultHotkeys: () => null }),
                "x:y",
            ),
        ).toEqual([]);
        expect(commandHotkeys(app(undefined), "x:y")).toEqual([]);
    });
});

describe("nested footnotes are prevented in selections (2026-08-24)", () => {
    // Jason's ruling after the Obsidian Academia Discord confirmed nobody
    // nests footnotes: a selection touching a LIVE reference, "[^]"
    // placeholder, or inline footnote refuses — full containment would
    // nest it, partial overlap would corrupt it
    it("a selection CONTAINING a reference refuses, note untouched", async () => {
        const before = ["alpha cite[^1] omega", "", "[^1]: one"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 0, ch: 20 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(NestedSelectionNotice)).toBe(true);
    });

    it("a selection CUTTING a reference in half refuses (corruption guard)", async () => {
        const before = ["alpha cite[^1] omega", "", "[^1]: one"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            // "alpha cite[^" — grabs the opening of the reference only
            anchor: { line: 0, ch: 0 },
            head: { line: 0, ch: 12 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(NestedSelectionNotice)).toBe(true);
    });

    it("a selection containing an INLINE footnote or a [^] placeholder refuses", async () => {
        for (const line of ["keep ^[inline note] here", "keep [^] here"]) {
            noticeCalls.length = 0;
            const before = [line];
            const doc = fakeEditor(before, { line: 0, ch: 0 }, {
                anchor: { line: 0, ch: 0 },
                head: { line: 0, ch: line.length },
            });
            await insertAutonumFootnote(fakePlugin(doc));
            expect(doc.lines).toEqual(before);
            expect(noticed(NestedSelectionNotice)).toBe(true);
        }
    });

    it("a DEAD reference-shaped fake inside a contained code span still converts", async () => {
        const doc = fakeEditor(
            ["take `fake [^9] code` along", "", "tail"],
            { line: 0, ch: 0 },
            { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 27 } },
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual([
            "[^1]",
            "",
            "tail",
            "",
            "[^1]: take `fake [^9] code` along",
        ]);
    });

    it("the cell path refuses a selection containing a reference too", () => {
        const dispatched: unknown[] = [];
        const cell = {
            state: {
                doc: { toString: () => "cell cite[^1] end" },
                selection: { main: { anchor: 0, head: 13 } },
            },
            dispatch: (spec: unknown) => {
                dispatched.push(spec);
            },
        } as unknown as TableCellEditor;
        const doc = fakeEditor(["| a |", "", "[^1]: one"], { line: 0, ch: 2 });
        expect(
            selectionPressHandled(fakePlugin(doc), doc, cell, "inline"),
        ).toBe(true);
        expect(dispatched).toEqual([]);
        expect(noticed(NestedSelectionNotice)).toBe(true);
    });

    it("a multi-line selection with the reference on its SECOND line refuses", async () => {
        const before = ["first line", "second cite[^1] line", "", "[^1]: one"];
        const doc = fakeEditor(before, { line: 0, ch: 0 }, {
            anchor: { line: 0, ch: 0 },
            head: { line: 1, ch: 20 },
        });
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(NestedSelectionNotice)).toBe(true);
    });
});
