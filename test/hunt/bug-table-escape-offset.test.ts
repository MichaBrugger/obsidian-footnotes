import type { Editor, EditorChange, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import { insertAutonumFootnote } from "../../src/insert-or-navigate-footnotes";
import type FootnotePlugin from "../../src/main";
import { resolveTableCellCursor, type TableCellEditor } from "../../src/table-cursor";

// A caret just inside a marker after an escaped pipe (\|) resolves one source column short, reads as OUTSIDE the marker, and insertAutonumFootnote nests a new marker inside the existing one.
// Hunt: 2026-08-09. Lens: offsets.
// Root cause: resolveTableCellCursor doesn't account for the escape byte before an escaped pipe when mapping a cell caret that sits after it back to source.

function fakeResolution(
    lineText: string,
    cellText: string,
    head: number,
    cellIndex = 0,
): ReturnType<typeof resolveTableCellCursor> {
    const table = { rows: [] as unknown[] };
    const headerRow = {};
    const bodyRow = {};
    table.rows = [headerRow, bodyRow];
    const td = { cellIndex };
    const active = {
        closest(selector: string) {
            if (selector === "td, th") return td;
            if (selector === "table") return table;
            if (selector === "tr") return bodyRow;
            return null;
        },
    };
    const cellView: TableCellEditor = {
        state: {
            doc: { toString: () => cellText },
            selection: { main: { head } },
        },
        dispatch() {},
    };
    class MainView {
        static findFromDOM() {
            return cellView;
        }

        contentDOM = {
            ownerDocument: { activeElement: active },
            contains: () => true,
        };
        posAtDOM = () => 100;
    }
    const cm = new MainView();
    const editor = {
        cm,
        offsetToPos: () => ({ line: 5, ch: 0 }),
        lastLine: () => 20,
        getLine: () => lineText,
    } as unknown as Editor;
    return resolveTableCellCursor(editor);
}

describe("table source-to-cell offset accounts for escape bytes (fixed 2026-08-10)", () => {
    it("leaves a caret BEFORE the escape unshifted", () => {
        // head 3 sits after "lef", before any escape — the mapping must not
        // shift carets that no escape byte precedes
        expect(fakeResolution("| left \\| [^note] | tail |", "left | [^note]", 3)).toEqual({
            line: 7,
            ch: 5,
        });
    });

    it("accounts for the escape byte before a pipe when the caret is after it", () => {
        // Cell editor text omits table-source escaping. Its head 8 is just
        // inside the marker, after "["; in the raw row the same caret is one
        // column later because the pipe is represented as "\\|". Returning
        // ch 10 puts it on the marker's opening bracket, which the command
        // deliberately treats as outside and can therefore nest a new marker.
        expect(fakeResolution("| left \\| [^note] | tail |", "left | [^note]", 8)).toEqual({
            line: 7,
            ch: 11,
        });
    });

    it("does not treat a cell caret just inside a post-escape marker as outside", async () => {
        const lines = ["| Header |", "| --- |", "| left \\| [^note] |"];
        const table = { rows: [] as unknown[] };
        const headerRow = {};
        const bodyRow = {};
        table.rows = [headerRow, bodyRow];
        const td = { cellIndex: 0 };
        const active = {
            closest(selector: string) {
                if (selector === "td, th") return td;
                if (selector === "table") return table;
                if (selector === "tr") return bodyRow;
                return null;
            },
        };
        const cellChanges: unknown[] = [];
        const cellView: TableCellEditor = {
            state: {
                doc: { toString: () => "left | [^note]" },
                selection: { main: { head: 8 } },
            },
            dispatch(spec) {
                cellChanges.push(spec);
            },
        };
        class MainView {
            static findFromDOM() {
                return cellView;
            }

            contentDOM = {
                ownerDocument: { activeElement: active },
                contains: () => true,
            };
            posAtDOM = () => 0;
            focus() {}
        }
        const appliedChanges: EditorChange[] = [];
        const doc = {
            cm: new MainView(),
            getCursor: () => ({ line: 0, ch: 0 }),
            getLine: (line: number) => lines[line],
            getValue: () => lines.join("\n"),
            lineCount: () => lines.length,
            lastLine: () => lines.length - 1,
            offsetToPos: () => ({ line: 0, ch: 0 }),
            setCursor() {},
            scrollIntoView() {},
            transaction(spec: { changes?: EditorChange[]; selection?: { from: EditorPosition } }) {
                if (spec.changes) appliedChanges.push(...spec.changes);
            },
        } as unknown as Editor;
        const plugin = {
            app: {
                workspace: { getActiveViewOfType: () => ({ editor: doc }) },
                vault: {},
            },
            settings: {
                insertAtEndOfWord: false,
                enablePopupEditor: false,
                enableFootnotePrefix: false,
                enableFootnoteSectionHeading: false,
                footnoteSectionHeading: "",
                enableRemoveBlankLastLines: true,
                lintOnFootnoteCreation: false,
            },
        } as unknown as FootnotePlugin;

        await insertAutonumFootnote(plugin);

        expect(cellChanges).toEqual([]);
        expect(appliedChanges.map((change) => change.text)).toEqual(["\n\n[^note]: "]);
    });
});
