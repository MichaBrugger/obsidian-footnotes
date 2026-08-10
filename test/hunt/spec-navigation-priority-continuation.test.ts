import { Editor, EditorChange, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { shouldJumpFromDetailToMarker } from "../../src/insert-or-navigate-footnotes";

// spec question: with the caret on [^b]'s marker inside [^a]'s indented
// continuation line, should the hotkey navigate to [^b]'s detail, or jump
// back to [^a]'s marker?
// Hunt: 2026-08-09. Lens: grammar.
// The cascade's definition-block-membership check runs FIRST and claims the
// press (jumping to [^a]'s first marker), so the marker→detail path for [^b]
// never runs. The order is deliberate — the 2026-07-17 jump-back fix depends
// on it — but the navigation target can surprise a user who aimed at [^b].

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition;
}

function fakeEditor(lines: string[], cursor: EditorPosition): FakeDoc {
    const doc = {
        appliedChanges: [] as EditorChange[],
        cursor,
        getCursor: () => doc.cursor,
        getLine: (n: number) => lines[n],
        getValue: () => lines.join("\n"),
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
        setCursor(pos: EditorPosition) {
            doc.cursor = pos;
        },
        scrollIntoView() {},
        transaction(spec: { changes?: EditorChange[]; selection?: { from: EditorPosition } }) {
            if (spec.changes) doc.appliedChanges.push(...spec.changes);
            if (spec.selection) doc.cursor = spec.selection.from;
        },
    };
    return doc as unknown as FakeDoc;
}

function fakePlugin(): FootnotePlugin {
    return {
        app: { vault: {} },
        settings: {
            enablePopupEditor: false,
            enableFootnoteSectionHeading: false,
            enableRemoveBlankLastLines: true,
            footnoteSectionHeading: "",
            insertAtEndOfWord: false,
            lintOnFootnoteCreation: false,
            enableFootnotePrefix: false,
        },
    } as unknown as FootnotePlugin;
}

describe("spec question: navigation priority inside a continuation line", () => {
    it.fails("caret on ANOTHER footnote's marker inside a continuation line jumps to THAT detail", () => {
        const lines = [
            "text[^a] more[^b]",
            "",
            "[^a]: first",
            "    see also [^b]",
            "",
            "[^b]: second",
        ];
        const doc = fakeEditor(lines, { line: 3, ch: 17 }); // inside [^b]
        const handled = shouldJumpFromDetailToMarker(lines[3], doc.cursor, doc, fakePlugin());
        // user intent: navigate to [^b]'s detail on line 5
        expect(handled).toBe(false);
    });
});
