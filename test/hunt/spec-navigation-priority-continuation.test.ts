import { Editor, EditorChange, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { shouldJumpFromDefinitionToReference } from "../../src/insert-or-navigate-footnotes";

// spec question: with the caret on [^b]'s reference inside [^a]'s indented
// continuation line, should the hotkey navigate to [^b]'s definition, or jump
// back to [^a]'s reference?
// Hunt: 2026-08-09. Lens: grammar.
// The cascade's definition-block-membership check runs FIRST and claims the
// press (jumping to [^a]'s first reference), so the reference→definition path for [^b]
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

// DECIDED (Jason, 2026-08-10): footnote references nested in another
// footnote's definition body are unsupported — the definition-block jump
// (back to the OUTER footnote's first reference) deliberately wins the
// press, exactly as the 2026-07-17 jump-back fix established.
describe("decided: the definition-block jump owns presses inside a continuation line", () => {
    it("caret anywhere in a continuation line jumps back to the OUTER footnote's reference", () => {
        const lines = [
            "text[^a] more[^b]",
            "",
            "[^a]: first",
            "    see also [^b]",
            "",
            "[^b]: second",
        ];
        const doc = fakeEditor(lines, { line: 3, ch: 17 }); // inside [^b]
        const handled = shouldJumpFromDefinitionToReference(lines[3], doc.cursor, fakePlugin(), doc);
        expect(handled).toBe(true);
        // [^a]'s first reference ends at ch 8 on line 0
        expect(doc.cursor).toEqual({ line: 0, ch: 8 });
    });
});
