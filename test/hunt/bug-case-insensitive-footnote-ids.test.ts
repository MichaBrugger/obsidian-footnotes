import { Editor, EditorChange, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { shouldCreateMatchingFootnoteDetail } from "../../src/insert-or-navigate-footnotes";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// BUG: Obsidian footnote labels are case-insensitive — "[^Note]" and "[^note]:"
// are the SAME footnote, and the metadata cache lowercases ids. The plugin's own
// popup code already relies on this (footnote-popup.ts lowercases the id, issue
// #50), but every other comparison keys on the raw match and is case-sensitive.
// Three concrete failures:
//  1. Data loss on reindex: keepOrphanedDefinitions:false classifies "[^note]:"
//     as an orphan of "[^Note]" ("note" !== "Note") and DELETES the definition.
//  2. Split pair: renumberNamedFootnotes:true numbers the marker [^1] and its
//     definition [^2] — one footnote torn into a broken pair.
//  3. Duplicate creation: with the caret in "[^Note]" and a "[^note]:" detail
//     already present, the named command creates a second detail instead of
//     navigating to the existing one.
// Scenario: markers/definitions differing only in letter case are treated as unrelated.
// fixed 2026-07-17: ids are folded to lowercase for identity everywhere they
// are compared (reindex pairing/orphans/numbering, detail scans, jump logic),
// while original casing is preserved in untouched output text.
// Provenance: iteration-1/eval-1/without_skill/run-1 (bug sweep, BUG 1).

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition | null;
}

function fakeEditor(lines: string[]): FakeDoc {
    const doc = {
        appliedChanges: [] as EditorChange[],
        cursor: null as EditorPosition | null,
        getLine: (n: number) => lines[n],
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

function fakePlugin(overrides: Record<string, unknown> = {}): FootnotePlugin {
    return {
        app: { vault: {} },
        settings: {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            ...overrides,
        },
    } as unknown as FootnotePlugin;
}

describe("bug: footnote ids compared case-sensitively", () => {
    it("reindex must not delete a definition referenced with different casing", () => {
        const result = reindexFootnotes(
            "Alpha[^Note].\n\n[^note]: the detail text",
            { keepOrphanedDefinitions: false },
        );
        expect(result).toContain("the detail text");
    });

    it("renumbering named footnotes keeps marker and definition paired", () => {
        const result = reindexFootnotes(
            "Alpha[^Note].\n\n[^note]: the detail text",
            { renumberNamedFootnotes: true },
        );
        expect(result).toBe("Alpha[^1].\n\n[^1]: the detail text");
    });

    it("the named command must not create a duplicate case-variant detail", () => {
        const doc = fakeEditor([
            "Alpha[^Note].",
            "",
            "[^note]: existing detail",
        ]);
        // caret inside the [^Note] marker; a detail for this footnote exists
        // (case-insensitively), so this press should navigate, not create
        shouldCreateMatchingFootnoteDetail(
            "Alpha[^Note].",
            { line: 0, ch: 8 },
            fakePlugin(),
            doc,
        );
        expect(doc.appliedChanges).toEqual([]);
    });
});
