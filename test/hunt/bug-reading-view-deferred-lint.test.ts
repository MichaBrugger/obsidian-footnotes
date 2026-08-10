import { Editor, EditorChange, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { lintAfterFootnoteCreation } from "../../src/linting/linter";

// The popup-deferred lint-on-creation fires after a user-driven delay, and a Reading-view flip mid-popup (no active-leaf-change fires) leaves every internal gate untripped, so the deferred lint edits the hidden buffer.
// Hunt: 2026-08-09. Lens: interactions.
// Root cause: commit a30761f guarded the lint COMMANDS with readingViewActive but not lintAfterFootnoteCreation, whose gates (file path, popup busy, table focus) all stay untripped by a Reading-view flip.

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition;
}

function fakeEditor(lines: string[], cursor: EditorPosition): FakeDoc {
    const doc = {
        appliedChanges: [] as EditorChange[],
        cursor,
        getCursor: () => doc.cursor,
        getLine: (n: number) => lines[n] ?? "",
        getValue: () => lines.join("\n"),
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
        wordAt: () => null,
        offsetToPos(offset: number) {
            let remaining = offset;
            for (let line = 0; line < lines.length; line++) {
                if (remaining <= lines[line].length) return { line, ch: remaining };
                remaining -= lines[line].length + 1;
            }
            return { line: lines.length - 1, ch: lines.at(-1)?.length ?? 0 };
        },
        setCursor(pos: EditorPosition) {
            doc.cursor = pos;
        },
        scrollIntoView() {},
        transaction(spec: {
            changes?: EditorChange[];
            selection?: { from: EditorPosition };
        }) {
            if (spec.changes) doc.appliedChanges.push(...spec.changes);
            if (spec.selection) doc.cursor = spec.selection.from;
        },
    };
    return doc as unknown as FakeDoc;
}

function pluginFor(
    doc: FakeDoc,
    overrides: Record<string, boolean | string> = {},
    mode: "source" | "preview" = "source",
): FootnotePlugin {
    return {
        app: {
            workspace: {
                getActiveViewOfType: () => ({
                    editor: doc,
                    file: { path: "note.md" },
                    getMode: () => mode,
                }),
            },
            vault: {},
        },
        settings: {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "# Footnotes",
            enableRemoveBlankLastLines: true,
            keepOrphanedDefinitions: true,
            renumberNamedFootnotes: false,
            lintFixPunctuation: true,
            lintMoveToBottom: true,
            lintReindex: true,
            lintApplyPrefix: true,
            lintOnFootnoteCreation: false,
            ...overrides,
        },
    } as unknown as FootnotePlugin;
}

describe("popup-deferred lint-on-creation vs Reading view (fixed 2026-08-10)", () => {
    it("deferred lint-on-creation is inert if the note is now in Reading view", () => {
        const lines = ["Alpha[^2], bravo", "", "[^2]: "];
        const doc = fakeEditor(lines, { line: 2, ch: lines[2].length });
        const plugin = pluginFor(
            doc,
            { lintOnFootnoteCreation: true },
            "preview",
        );
        lintAfterFootnoteCreation(plugin, true, "note.md");
        expect(doc.appliedChanges).toEqual([]);
        expect(doc.cursor).toEqual({ line: 2, ch: lines[2].length });
    });

    it("the same lint still runs when the note stayed in editing view", () => {
        // guards the fix against over-gating: identical setup, source mode —
        // the punctuation rule has real work ("Alpha[^2]," → "Alpha,[^2]")
        const lines = ["Alpha[^2], bravo", "", "[^2]: "];
        const doc = fakeEditor(lines, { line: 2, ch: lines[2].length });
        const plugin = pluginFor(
            doc,
            { lintOnFootnoteCreation: true },
            "source",
        );
        lintAfterFootnoteCreation(plugin, true, "note.md");
        expect(doc.appliedChanges.length).toBeGreaterThan(0);
    });
});
