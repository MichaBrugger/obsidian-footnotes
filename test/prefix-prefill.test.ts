import { Editor, EditorChange, EditorPosition, Notice } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import FootnotePlugin from "../src/main";
import {
    shouldCreateFootnoteMarker,
    shouldCreateMatchingFootnoteDetail,
    warnPrefilledMarkerIfInside,
} from "../src/insert-or-navigate-footnotes";

vi.mock("obsidian", async (importOriginal) => ({
    ...(await importOriginal<typeof import("obsidian")>()),
    Notice: vi.fn(),
}));

// Prefix-at-bracket-creation (requested 2026-07-20, replacing the
// detail-time rename): with an active footnote-prefix the named command
// creates "[^7-]" with the caret right after the prefix — the user SEES
// the namespace while typing the name. A press inside the untouched
// placeholder keeps the caret where it is and asks for a suffix instead
// (2026-08-05; it used to hop out, which was harder to understand).
// Detail creation no longer renames anything.

interface FakeDoc extends Editor {
    appliedChanges: EditorChange[];
    cursor: EditorPosition | null;
}

function fakeEditor(lines: string[], cursor: EditorPosition): FakeDoc {
    const doc = {
        appliedChanges: [] as EditorChange[],
        cursor,
        getCursor: () => doc.cursor,
        getValue: () => lines.join("\n"),
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
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

function fakePlugin(enablePrefix: boolean): FootnotePlugin {
    return {
        app: { vault: {} },
        settings: {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: enablePrefix,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: true,
        },
    } as unknown as FootnotePlugin;
}

const FRONTMATTER = ["---", "footnote-prefix: 7-", "---"];

describe("named command prefills the footnote-prefix into the new marker", () => {
    it("creates [^7-] with the caret right after the prefix", () => {
        const doc = fakeEditor([...FRONTMATTER, "Alpha bravo"], {
            line: 3,
            ch: 11,
        });
        shouldCreateFootnoteMarker(
            "Alpha bravo",
            { line: 3, ch: 11 },
            doc,
            fakePlugin(true),
        );
        expect(doc.appliedChanges).toEqual([
            { from: { line: 3, ch: 11 }, text: "[^7-]" },
        ]);
        // caret between the prefix and the closing bracket
        expect(doc.cursor).toEqual({ line: 3, ch: 11 + "[^7-".length });
    });

    it("creates a plain [^] while the prefix toggle is off", () => {
        const doc = fakeEditor([...FRONTMATTER, "Alpha bravo"], {
            line: 3,
            ch: 11,
        });
        shouldCreateFootnoteMarker(
            "Alpha bravo",
            { line: 3, ch: 11 },
            doc,
            fakePlugin(false),
        );
        expect(doc.appliedChanges).toEqual([
            { from: { line: 3, ch: 11 }, text: "[^]" },
        ]);
        expect(doc.cursor).toEqual({ line: 3, ch: 13 });
    });

    it("ignores an invalid digit-ending prefix (defensive)", () => {
        const doc = fakeEditor(["---", "footnote-prefix: 10", "---", "Alpha"], {
            line: 3,
            ch: 5,
        });
        shouldCreateFootnoteMarker(
            "Alpha",
            { line: 3, ch: 5 },
            doc,
            fakePlugin(true),
        );
        expect(doc.appliedChanges).toEqual([
            { from: { line: 3, ch: 5 }, text: "[^]" },
        ]);
    });
});

describe("warnPrefilledMarkerIfInside (the [^7-] placeholder toast)", () => {
    it("keeps the caret in place and asks for a suffix", () => {
        const doc = fakeEditor([...FRONTMATTER, "Alpha [^7-] bravo"], {
            line: 3,
            ch: 9,
        });
        vi.mocked(Notice).mockClear();
        expect(warnPrefilledMarkerIfInside(fakePlugin(true), doc, null)).toBe(
            true,
        );
        // the caret does NOT move — the toast is the whole response
        expect(doc.cursor).toEqual({ line: 3, ch: 9 });
        expect(doc.appliedChanges).toEqual([]);
        expect(Notice).toHaveBeenCalledWith(
            expect.stringContaining("suffix"),
        );
    });

    it("reports false once a name has been typed after the prefix", () => {
        const doc = fakeEditor([...FRONTMATTER, "Alpha [^7-tag] bravo"], {
            line: 3,
            ch: 9,
        });
        expect(warnPrefilledMarkerIfInside(fakePlugin(true), doc, null)).toBe(
            false,
        );
    });

    it("reports false with the prefix feature off", () => {
        const doc = fakeEditor([...FRONTMATTER, "Alpha [^7-] bravo"], {
            line: 3,
            ch: 9,
        });
        expect(warnPrefilledMarkerIfInside(fakePlugin(false), doc, null)).toBe(
            false,
        );
    });

    it("reports false when the caret is outside the placeholder", () => {
        const doc = fakeEditor([...FRONTMATTER, "Alpha [^7-] bravo"], {
            line: 3,
            ch: 2,
        });
        expect(warnPrefilledMarkerIfInside(fakePlugin(true), doc, null)).toBe(
            false,
        );
    });
});

describe("detail creation no longer applies the prefix", () => {
    it("a hand-typed unprefixed marker gets a matching unprefixed detail", () => {
        // the lint pass owns prefixing after the fact; the insert flow
        // applies the prefix at bracket creation only
        const doc = fakeEditor([...FRONTMATTER, "Alpha [^tag] b"], {
            line: 3,
            ch: 9,
        });
        expect(
            shouldCreateMatchingFootnoteDetail(
                "Alpha [^tag] b",
                { line: 3, ch: 9 },
                fakePlugin(true),
                doc,
            ),
        ).toBe(true);
        expect(doc.appliedChanges).toEqual([
            {
                from: { line: 3, ch: "Alpha [^tag] b".length },
                to: { line: 3, ch: "Alpha [^tag] b".length },
                text: "\n\n[^tag]: ",
            },
        ]);
    });
});
