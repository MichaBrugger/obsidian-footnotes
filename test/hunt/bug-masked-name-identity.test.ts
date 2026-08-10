import { Editor, EditorChange, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import {
    shouldCreateMatchingFootnoteDetail,
    shouldJumpFromDetailToMarker,
    shouldJumpFromMarkerToDetail,
} from "../../src/insert-or-navigate-footnotes";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// Scenario: a footnote whose name contains an inline-code span ("[^x`c`y]")
// gets a NUL-masked identity on marker-scanning paths but its raw identity on
// definition-listing paths — marker→detail jumps fail, created detail lines
// are stuffed with literal NUL bytes, and reindex severs the pair or deletes
// a still-referenced definition.
// Hunt: 2026-08-09. Lens: offsets.
// Root cause: these paths run the name extraction on the code-MASKED line and
// read match[0]/match[1] straight off the mask without re-slicing the original
// text (the re-slice fix pinned in bug-detail-name-inline-code-nul was only
// applied to the definition-listing path).

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition;
}

function fakeEditor(lines: string[], cursor: EditorPosition = { line: 0, ch: 0 }): FakeDoc {
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

describe("press-jump (marker → detail) with a code-span-named footnote (fixed 2026-08-10)", () => {
    const MARKER_LINE = "ref [^x`c`y] end"; // marker at ch 4..11, caret ch 8 is inside
    const DETAIL_LINE = "[^x`c`y]: body";

    it("jumps from such a marker to its existing detail", () => {
        const doc = fakeEditor([MARKER_LINE, "", DETAIL_LINE], { line: 0, ch: 8 });
        expect(shouldJumpFromMarkerToDetail(MARKER_LINE, doc.cursor, doc, fakePlugin())).toBe(true);
        expect(doc.cursor).toEqual({ line: 2, ch: DETAIL_LINE.length });
    });

    it("jumps from [^`1`] to its detail", () => {
        const lines = ["ref [^`1`] here", "", "[^`1`]: the detail"];
        const caret = { line: 0, ch: 7 }; // on the "1" inside "[^`1`]"
        const doc = fakeEditor(lines, caret);
        expect(shouldJumpFromMarkerToDetail(lines[0], caret, doc, fakePlugin())).toBe(true);
        expect(doc.cursor).toEqual({ line: 2, ch: "[^`1`]: the detail".length });
    });
});

describe("press-create with a code-span-named footnote (fixed 2026-08-10)", () => {
    it("refuses to create a detail for a backticked name (disallowed, Jason 2026-08-10)", () => {
        // backticked names don't render in Obsidian, so instead of creating
        // a detail (with or without NUL bytes) the press warns and stops —
        // the same treatment as spaced names
        const MARKER_LINE = "ref [^x`c`y] end";
        const doc = fakeEditor([MARKER_LINE, ""], { line: 0, ch: 8 });
        const handled = shouldCreateMatchingFootnoteDetail(
            MARKER_LINE,
            doc.cursor,
            fakePlugin(),
            doc,
        );
        expect(handled).toBe(true);
        expect(doc.appliedChanges).toEqual([]);
    });

    it("does NOT append a duplicate detail full of NUL bytes when the detail exists", () => {
        const lines = ["ref [^`1`] here", "", "[^`1`]: the detail"];
        const doc = fakeEditor(lines, { line: 0, ch: 7 });
        shouldCreateMatchingFootnoteDetail(lines[0], { line: 0, ch: 7 }, fakePlugin(), doc);
        expect(doc.appliedChanges).toEqual([]);
    });
});

describe("press-jump (detail → marker) with a code-span-named footnote (fixed 2026-08-10)", () => {
    it("finds the marker of a backticked footnote name", () => {
        const lines = ["ref [^`1`] here", "", "[^`1`]: the detail"];
        const doc = fakeEditor(lines, { line: 2, ch: 5 });
        shouldJumpFromDetailToMarker(lines[2], { line: 2, ch: 5 }, doc, fakePlugin());
        // "[^`1`]" starts at index 4 and is 6 code units long
        expect(doc.cursor).toEqual({ line: 0, ch: 10 });
    });
});

describe("reindex with a code-span-named footnote (fixed 2026-08-10)", () => {
    const doc = "see[^a`b`c] twice[^a`b`c].\n\n[^a`b`c]: hi";

    it("renumberNamedFootnotes keeps marker and definition paired", () => {
        expect(reindexFootnotes(doc, { renumberNamedFootnotes: true })).toBe(
            "see[^1] twice[^1].\n\n[^1]: hi",
        );
    });

    it("drop-orphans does not delete a referenced code-span-named definition", () => {
        expect(reindexFootnotes(doc, { keepOrphanedDefinitions: false })).toBe(doc);
    });

    it("the same split through a name containing an HTML comment span", () => {
        const commentNamed = "see[^a<!-- -->b].\n\n[^a<!-- -->b]: hi";
        expect(reindexFootnotes(commentNamed, { renumberNamedFootnotes: true })).toBe(
            "see[^1].\n\n[^1]: hi",
        );
    });
});
