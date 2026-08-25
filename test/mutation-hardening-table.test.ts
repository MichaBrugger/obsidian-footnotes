import type { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import {
    activeTableCellEditor,
    nestedSubEditorOwnsFocus,
    resolveTableCellCursor,
    tableRowCellSpans,
    type TableCellEditor,
} from "../src/editor/table-cursor";

// Kills Stryker survivors from the 2026-08-10 baseline (survivors-table-cursor.json,
// 50 mutants on src/table-cursor.ts). Each test is built to diverge between the
// original code and one specific listed mutation; grouped by function, then by
// source line. See the trailing comment block for the equivalent/unreachable
// mutants this file deliberately does not attempt to kill.

describe("nestedSubEditorOwnsFocus", () => {
    // line 37 col 67, BlockStatement -> {}: an emptied function body returns
    // undefined, not a boolean. toBe(false) (not toBeFalsy) tells them apart.
    it("returns false (not undefined) when there is no cm", () => {
        const editor = { cm: undefined } as unknown as Editor;
        expect(nestedSubEditorOwnsFocus(editor)).toBe(false);
    });

    // line 41 col 9, ConditionalExpression -> false: forces the whole
    // cm && active && active !== contentDOM && contains(active) chain to a
    // literal false, so a genuinely focused nested element would wrongly
    // report false. Also re-kills the BlockStatement mutant above.
    it("returns true when a nested, contained element other than contentDOM owns focus", () => {
        const nestedEl = {};
        const contentDOM = {
            ownerDocument: { activeElement: nestedEl },
            contains: (el: unknown) => el === nestedEl,
        };
        const editor = { cm: { contentDOM } } as unknown as Editor;
        expect(nestedSubEditorOwnsFocus(editor)).toBe(true);
    });

    // line 43 col 9, EqualityOperator (!== -> ===) and ConditionalExpression
    // (-> true): both would make "focus is on contentDOM itself" register as
    // a nested sub-editor owning focus.
    it("returns false when the focused element IS contentDOM itself", () => {
        const contentDOM: { ownerDocument: { activeElement: unknown }; contains: (el: unknown) => boolean } = {
            ownerDocument: { activeElement: null },
            contains: () => true,
        };
        contentDOM.ownerDocument.activeElement = contentDOM;
        const editor = { cm: { contentDOM } } as unknown as Editor;
        expect(nestedSubEditorOwnsFocus(editor)).toBe(false);
    });
});

describe("activeTableCellEditor", () => {
    // line 63 col 9 (both ConditionalExpression -> false duplicates, and the
    // LogicalOperator "!active && active === cm.contentDOM" variant): with no
    // focused element, the guard must return null WITHOUT falling through to
    // `active.closest(...)`, which would throw on null. contains() is forced
    // to always return true so the surviving disjunct-based variant
    // ("(!active || active === cm.contentDOM) && !contains") is also caught:
    // it evaluates to false and falls through to the same crash.
    it("returns null (not a throw) when nothing is focused", () => {
        const contentDOM = {
            ownerDocument: { activeElement: null },
            contains: () => true,
        };
        const cm = { contentDOM, constructor: class {} };
        const editor = { cm } as unknown as Editor;
        expect(activeTableCellEditor(editor)).toBeNull();
    });

    // line 63 col 20, ConditionalExpression -> false: forces the
    // `active === cm.contentDOM` disjunct to false. Using an active element
    // that genuinely IS contentDOM, with contains() and closest() rigged so
    // the real check is the only thing stopping a full resolution, exposes
    // the difference: original short-circuits to null, the mutant instead
    // returns a fabricated view.
    it("returns null when the focused element is contentDOM itself, even if it self-contains", () => {
        const fakeView: TableCellEditor = {
            state: { doc: { toString: () => "" }, selection: { main: { head: 0, anchor: 0 } } },
            dispatch() {},
        };
        const contentDOM: {
            ownerDocument: { activeElement: unknown };
            contains: () => boolean;
            closest: (sel: string) => unknown;
        } = {
            ownerDocument: { activeElement: null },
            contains: () => true,
            closest: (sel: string) => (sel === "td, th" ? {} : null),
        };
        contentDOM.ownerDocument.activeElement = contentDOM;
        class ViewClass {
            static findFromDOM() {
                return fakeView;
            }
        }
        const cm = { contentDOM, constructor: ViewClass };
        const editor = { cm } as unknown as Editor;
        expect(activeTableCellEditor(editor)).toBeNull();
    });

    // line 63 col 9, LogicalOperator "(!active || active === cm.contentDOM)
    // && !cm.contentDOM.contains(active)": a focused, distinct-from-
    // contentDOM element that contains() reports as NOT contained must
    // return null. The mutant's AND short-circuits to false here (since
    // neither !active nor active===contentDOM hold), letting it fall
    // through to a fabricated non-null result.
    it("returns null when the focused element is not actually contained", () => {
        const active = { closest: (sel: string) => (sel === "td, th" ? {} : null) };
        const contentDOM = {
            ownerDocument: { activeElement: active },
            contains: () => false,
        };
        const fakeView: TableCellEditor = {
            state: { doc: { toString: () => "" }, selection: { main: { head: 0, anchor: 0 } } },
            dispatch() {},
        };
        class ViewClass {
            static findFromDOM() {
                return fakeView;
            }
        }
        const cm = { contentDOM, constructor: ViewClass };
        const editor = { cm } as unknown as Editor;
        expect(activeTableCellEditor(editor)).toBeNull();
    });

    // line 66 col 9, ConditionalExpression -> false: a focused element with
    // no td/th ancestor must return null rather than falling through to a
    // fabricated view.
    it("returns null when the focused element has no td/th ancestor", () => {
        const active = { closest: () => null };
        const contentDOM = {
            ownerDocument: { activeElement: active },
            contains: () => true,
        };
        const fakeView: TableCellEditor = {
            state: { doc: { toString: () => "" }, selection: { main: { head: 0, anchor: 0 } } },
            dispatch() {},
        };
        class ViewClass {
            static findFromDOM() {
                return fakeView;
            }
        }
        const cm = { contentDOM, constructor: ViewClass };
        const editor = { cm } as unknown as Editor;
        expect(activeTableCellEditor(editor)).toBeNull();
    });

    // line 70 col 18, OptionalChaining removal: when the CM6 constructor
    // exposes no findFromDOM (older/newer incompatible build), the lookup
    // must degrade to null, not throw.
    it("returns null (not a throw) when findFromDOM is unavailable", () => {
        const active = { closest: (sel: string) => (sel === "td, th" ? {} : null) };
        const contentDOM = {
            ownerDocument: { activeElement: active },
            contains: () => true,
        };
        class ViewClass {}
        const cm = { contentDOM, constructor: ViewClass };
        const editor = { cm } as unknown as Editor;
        expect(() => activeTableCellEditor(editor)).not.toThrow();
        expect(activeTableCellEditor(editor)).toBeNull();
    });

    // line 71 col 9 (ConditionalExpression -> false, and the LogicalOperator
    // "!view && view === cm" variant) and line 71 col 18 (ConditionalExpression
    // -> false on the `view === cm` sub-check): findFromDOM handing back the
    // MAIN view (no real cell editor found) must resolve to null, not to the
    // main view being mistaken for a cell editor.
    it("returns null when findFromDOM resolves back to the main editor view", () => {
        const active = { closest: (sel: string) => (sel === "td, th" ? {} : null) };
        const contentDOM = {
            ownerDocument: { activeElement: active },
            contains: () => true,
        };
        class ViewClass {
            static findFromDOM() {
                return cm;
            }
        }
        const cm = { contentDOM, constructor: ViewClass };
        const editor = { cm } as unknown as Editor;
        expect(activeTableCellEditor(editor)).toBeNull();
    });

    // Baseline happy path: a genuinely distinct cell view is returned as-is.
    it("returns the distinct cell view on a full, valid match", () => {
        const active = { closest: (sel: string) => (sel === "td, th" ? {} : null) };
        const contentDOM = {
            ownerDocument: { activeElement: active },
            contains: () => true,
        };
        const fakeView: TableCellEditor = {
            state: { doc: { toString: () => "x" }, selection: { main: { head: 0, anchor: 0 } } },
            dispatch() {},
        };
        class ViewClass {
            static findFromDOM() {
                return fakeView;
            }
        }
        const cm = { contentDOM, constructor: ViewClass };
        const editor = { cm } as unknown as Editor;
        expect(activeTableCellEditor(editor)).toBe(fakeView);
    });
});

describe("tableRowCellSpans (mutation hardening)", () => {
    // line 82 col 19, ConditionalExpression -> false: forces sawPipe's
    // initial value to always be false, so a row whose ONLY pipe is the
    // (optional) leading one loses its single cell entirely.
    it("counts a leading-pipe-only row as one cell, not zero", () => {
        expect(tableRowCellSpans("| abc")).toEqual([{ from: 1, to: 5 }]);
    });

    // line 83 col 25, EqualityOperator (i < lineText.length -> i <=
    // lineText.length): NOT tested here — see the equivalence note below.
});

describe("resolveTableCellCursor (mutation hardening)", () => {
    // Shared shape: a 2-row table (header row 0, one body row 1), a source
    // line "| left \| [^note] | tail |" whose escaped pipe is what makes the
    // escape-aware walk (lines 148-163) worth pinning precisely.
    const ESCAPED_LINE = "| left \\| [^note] | tail |";

    function buildRowScenario(opts: {
        active: { closest(sel: string): unknown } | null;
        contains?: () => boolean;
        // "view" -> findFromDOM produces a fresh, distinct cell view built
        // from cellText/head below; null/omitted -> no view is found. The
        // actual td/table/tr resolution comes entirely from `active.closest`
        // (as the real code calls it); `table`/`tr` here are accepted for
        // caller-side documentation only and are not otherwise consulted.
        findFromDOM?: () => "view" | null;
        table?: { rows: unknown[] } | null;
        tr?: unknown;
        posAtDOM?: () => number;
        offsetToPosLine?: number;
        lastLine?: number;
        lineText?: string;
        cellText?: string;
        head?: number;
    }): Editor {
        const {
            active,
            contains = () => true,
            findFromDOM,
            posAtDOM = () => 100,
            offsetToPosLine = 5,
            lastLine = 20,
            lineText = ESCAPED_LINE,
            cellText = "left | [^note]",
            head = 3,
        } = opts;

        const contentDOM = {
            ownerDocument: { activeElement: active },
            contains,
        };

        class ViewClass {
            static findFromDOM(): TableCellEditor | null {
                const result = findFromDOM ? findFromDOM() : null;
                if (result !== "view") return null;
                return {
                    state: {
                        doc: { toString: () => cellText },
                        selection: { main: { head, anchor: head } },
                    },
                    dispatch() {},
                };
            }
        }
        const cm = { contentDOM, constructor: ViewClass, posAtDOM };
        return {
            cm,
            offsetToPos: () => ({ line: offsetToPosLine, ch: 0 }),
            lastLine: () => lastLine,
            getLine: () => lineText,
        } as unknown as Editor;
    }

    // line 113 col 9 (both ConditionalExpression -> false duplicates, and the
    // LogicalOperator "!active && active === cm.contentDOM" variant): no
    // focused element must return null, not fall through and crash on
    // `active.closest`. contains() forced to true also catches the
    // "(!active || ...) && !contains" variant the same way it does for
    // activeTableCellEditor above.
    it("returns null (not a throw) when nothing is focused", () => {
        const editor = buildRowScenario({
            active: null,
            contains: () => true,
            table: { rows: [] },
        });
        expect(resolveTableCellCursor(editor)).toBeNull();
    });

    // line 113 col 20 (active === cm.contentDOM forced false) is NOT
    // independently testable here — see the equivalence note below.

    // line 120 (all four mutants: both ConditionalExpression -> false
    // duplicates, and both LogicalOperator variants): a td/tr that resolve
    // fine but a MISSING table ancestor must return null. activeTableCellEditor
    // doesn't re-check `table`, so a genuine cell view is found and, if the
    // guard is bypassed, execution reaches `table.rows` on a null table and
    // throws — diverging from the clean null every one of the four mutants
    // should have produced.
    it("returns null (not a throw) when there is no table ancestor", () => {
        const td = { cellIndex: 0 };
        const tr = {};
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return null;
                if (sel === "tr") return tr;
                return null;
            },
        };
        const editor = buildRowScenario({
            active,
            table: null,
            findFromDOM: () => "view",
        });
        expect(resolveTableCellCursor(editor)).toBeNull();
    });

    // line 123 col 9, ConditionalExpression -> false: td/table/tr all
    // resolve, but no cell sub-editor view is actually found (findFromDOM
    // returns null). Must return null, not fall through to
    // `cellView.state...` and throw.
    it("returns null (not a throw) when no cell sub-editor view is found", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => null,
        });
        expect(resolveTableCellCursor(editor)).toBeNull();
    });

    // line 129 col 9, ConditionalExpression -> false: the row element isn't
    // found in table.rows at all (rowIdx -1). Must return null rather than
    // computing a bogus line from -1.
    it("returns null when the row isn't found among the table's rows", () => {
        const headerRow = {};
        const bodyRow = {};
        const strangerRow = {}; // not in table.rows
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return strangerRow;
                return null;
            },
        };
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
        });
        expect(resolveTableCellCursor(editor)).toBeNull();
    });

    // line 129 col 9, EqualityOperator (rowIdx < 0 -> rowIdx <= 0) AND
    // line 130 col 31, ConditionalExpression (rowIdx === 0 -> false): both
    // are only observable on the header row (rowIdx 0). The EqualityOperator
    // mutant would wrongly reject a valid header-row match; the
    // ConditionalExpression mutant would compute the wrong source line
    // (startLine + 1 instead of startLine) for it. Rigging getLine to return
    // real content only at the correct line, and something unparsable at the
    // wrong one, makes either mutation collapse the result to null.
    it("resolves a header-row (rowIdx 0) cell to the header's own line", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return headerRow;
                return null;
            },
        };
        const startLine = 5;
        const contains = () => true;
        const contentDOM: unknown = { ownerDocument: { activeElement: active }, contains };
        const fakeView: TableCellEditor = {
            state: { doc: { toString: () => "" }, selection: { main: { head: 0, anchor: 0 } } },
            dispatch() {},
        };
        class ViewClass {
            static findFromDOM() {
                return fakeView;
            }
        }
        const cm = { contentDOM, constructor: ViewClass, posAtDOM: () => 100 };
        const editor = {
            cm,
            offsetToPos: () => ({ line: startLine, ch: 0 }),
            lastLine: () => 20,
            getLine: (line: number) => (line === startLine ? "| a | b |" : "no pipes here"),
        } as unknown as Editor;
        expect(resolveTableCellCursor(editor)).toEqual({ line: startLine, ch: 2 });
    });

    // line 131 col 9, ConditionalExpression -> false: a computed line past
    // lastLine() must return null rather than reading a nonexistent line.
    it("returns null when the resolved line is past the document's end", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            offsetToPosLine: 5,
            lastLine: 0, // computed line (5 + 2 = 7) is always past this
            lineText: "| a | b |",
        });
        expect(resolveTableCellCursor(editor)).toBeNull();
    });

    // line 138 col 9 (both ConditionalExpression -> false duplicates, and
    // the LogicalOperator "cellIndex < 0 && cellIndex >= spans.length"
    // variant): a negative cellIndex must return null, not fall through and
    // index spans[-1] (undefined), which crashes on `.from`.
    it("returns null (not a throw) when cellIndex is negative", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: -1 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            lineText: "| a | b |",
        });
        expect(resolveTableCellCursor(editor)).toBeNull();
    });

    // line 138 col 26 (ConditionalExpression -> false, and EqualityOperator
    // cellIndex >= spans.length -> cellIndex > spans.length): a cellIndex
    // exactly AT spans.length (one past the last real cell) must return
    // null, not fall through and index spans[spans.length] (undefined).
    it("returns null (not a throw) when cellIndex is exactly out of range", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        // "| a | b |" has exactly 2 cells (indices 0, 1); index 2 is out.
        const td = { cellIndex: 2 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            lineText: "| a | b |",
        });
        expect(resolveTableCellCursor(editor)).toBeNull();
    });

    // line 150 col 34, MethodExpression (trimStart -> trimEnd): the leading-
    // whitespace fallback for `start` must count LEADING whitespace, not
    // trailing. Uses an empty cellText so the idx-based branch (line 151) is
    // skipped and this fallback is what actually determines `ch`.
    it("anchors on leading whitespace, not trailing, when the cell text can't be located", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        // cellIndex 0 raw span is "  ab | c |" -> "  ab " (2 leading, 1 trailing space)
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            lineText: "|  ab | c |",
            cellText: "", // empty -> line 151's idx branch never fires
            head: 0, // empty cellText -> loop body never runs; raw stays === start
        });
        // span.from = 1; leading-ws fallback start = 2 -> ch = 1 + 2 = 3
        expect(resolveTableCellCursor(editor)).toEqual({ line: 7, ch: 3 });
    });

    // line 151 col 9 (EqualityOperator cellText.length > 0 -> >= 0, and
    // ConditionalExpression -> true): with an EMPTY cellText, both force the
    // idx-lookup block to run anyway. indexOf("") always returns 0, wrongly
    // pinning `start` to 0 instead of leaving it at the leading-whitespace
    // fallback.
    it("does not look up an empty cell text as if it were found at index 0", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            lineText: "|  ab | c |",
            cellText: "",
            head: 0,
        });
        // Same scenario as the trimStart test above: ch must be 3 (leading-ws
        // fallback), not 1 (as if cellText "" had been "found" at index 0).
        expect(resolveTableCellCursor(editor)).toEqual({ line: 7, ch: 3 });
    });

    // line 151 col 9 (ConditionalExpression -> false) and line 151 col 30
    // (BlockStatement -> {}): with a NON-EMPTY cellText that IS locatable in
    // the raw cell at an index different from the leading-whitespace count,
    // both mutants would skip the reassignment and wrongly keep the
    // whitespace-count fallback.
    it("anchors on the located cell text, not the leading-whitespace fallback, when found", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        // cellIndex 0 raw span is "  xxab  " (2 leading spaces, so the
        // whitespace-fallback would be 2); "ab" is actually located at index 4.
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            lineText: "|  xxab  | c |",
            cellText: "ab",
            head: 0,
        });
        // span.from = 1; idx-based start = 4 -> ch = 1 + 4 = 5
        expect(resolveTableCellCursor(editor)).toEqual({ line: 7, ch: 5 });
    });

    // line 153 col 13 (EqualityOperator idx >= 0 -> idx > 0, and
    // ConditionalExpression -> false): only observable at the idx === 0
    // boundary, where the cell text is found starting at the very first
    // character of the raw cell.
    it("accepts an idx of exactly 0 as a valid match", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        // cellIndex 0 raw span is "  xy  "; cellText "  xy" matches at idx 0
        // (whitespace-fallback would instead be 2).
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            lineText: "|  xy  | c |",
            cellText: "  xy",
            head: 0,
        });
        // span.from = 1; idx-based start = 0 -> ch = 1 + 0 = 1
        expect(resolveTableCellCursor(editor)).toEqual({ line: 7, ch: 1 });
    });

    // line 157 col 33 (ConditionalExpression -> true, and EqualityOperator
    // raw < rawCell.length -> raw <= rawCell.length): NOT tested here — see
    // the equivalence note below.

    // line 158 col 13 (LogicalOperator && -> ||, ConditionalExpression ->
    // true, and EqualityOperator rawCell[raw] === "\\" -> !==): a non-escape
    // character whose FOLLOWING character happens to coincidentally match
    // the next cell-text character must NOT be treated as an escape pair.
    // All three mutants make the walk consume 2 raw characters here instead
    // of 1.
    it("does not treat a coincidental next-character match as an escape pair", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        // cellIndex 0 raw span is " ab " (idx of "bz" not found -> start
        // falls back to the leading-ws count, 1). At raw=1: rawCell[1]='a'
        // (not a backslash) but rawCell[2]='b' coincidentally equals
        // cellText[0].
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            lineText: "| ab | c |",
            cellText: "bz",
            head: 1,
        });
        // span.from = 1, start = 1 (fallback), one loop step consumes 1
        // char (not 2) -> raw = 2 -> ch = 1 + 2 = 3
        expect(resolveTableCellCursor(editor)).toEqual({ line: 7, ch: 3 });
    });

    // line 158 col 38, ConditionalExpression -> true (forces just the
    // `rawCell[raw + 1] === cellText[c]` half true): a genuine backslash NOT
    // actually followed by the expected escaped character must NOT be
    // treated as an escape pair.
    it("does not treat a backslash as an escape pair when the following character doesn't match", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        // cellIndex 0 raw span is "\z"; cellText "q" isn't found in it, so
        // start falls back to 0 (no leading whitespace). rawCell[0] is a
        // real backslash, but rawCell[1] ('z') doesn't match cellText[0] ('q').
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            lineText: "|\\z| c |",
            cellText: "q",
            head: 1,
        });
        // span.from = 1, start = 0, one loop step consumes 1 char (not 2,
        // since the escape pair doesn't actually match) -> raw = 1 -> ch = 2
        expect(resolveTableCellCursor(editor)).toEqual({ line: 7, ch: 2 });
    });

    // Baseline happy path, exercising the escape-aware walk end to end (also
    // covered by test/hunt/bug-table-escape-offset.test.ts, restated here so
    // this file is self-contained).
    it("resolves a body-row cell caret through an escaped pipe", () => {
        const headerRow = {};
        const bodyRow = {};
        const table = { rows: [headerRow, bodyRow] };
        const td = { cellIndex: 0 };
        const active = {
            closest: (sel: string) => {
                if (sel === "td, th") return td;
                if (sel === "table") return table;
                if (sel === "tr") return bodyRow;
                return null;
            },
        };
        const editor = buildRowScenario({
            active,
            table,
            findFromDOM: () => "view",
            lineText: ESCAPED_LINE,
            cellText: "left | [^note]",
            head: 8,
        });
        expect(resolveTableCellCursor(editor)).toEqual({ line: 7, ch: 11 });
    });
});

// Equivalent / unit-unreachable mutants (not targeted above):
//
// - line 41 col 9, LogicalOperator "cm || active": `active` is computed
//   INSIDE nestedSubEditorOwnsFocus as `cm?.contentDOM....`, so it is falsy
//   whenever cm is falsy and cm's own truthiness whenever cm is truthy;
//   `cm || active` and `cm &&` therefore short-circuit identically for every
//   reachable input, making this mutant behaviorally equivalent.
//
// - line 83 col 25, EqualityOperator "i < lineText.length" -> "i <=
//   lineText.length": the one extra iteration this permits reads
//   lineText[lineText.length], which is always `undefined` and matches
//   neither the escape branch ("\\") nor the pipe branch ("|"), so it is a
//   provable no-op — unkillable by any input.
//
// - line 113 col 20, ConditionalExpression -> false (the `active ===
//   cm.contentDOM` disjunct in resolveTableCellCursor's own focus guard):
//   activeTableCellEditor (called moments later at line 122) re-derives
//   `active` from the same cm and re-runs the textually identical
//   `!active || active === cm.contentDOM || !contains(active)` check
//   UNMUTATED. Whenever this disjunct is genuinely true, that redundant
//   check independently returns null too, so resolveTableCellCursor ends up
//   null via its own (real) `!cellView` guard at line 123 regardless of
//   whether the line-113 copy of the check was bypassed. The mutant's effect
//   is fully masked from every observable output.
//
// - line 157 col 33, ConditionalExpression -> true and EqualityOperator
//   "raw < rawCell.length" -> "raw <= rawCell.length": both only affect how
//   far `raw` overshoots rawCell.length once the walk runs past the cell's
//   real content. The final position is always computed as
//   `Math.min(span.from + raw, span.to)`, and span.to - span.from is exactly
//   rawCell.length by construction, so any such overshoot is clamped away —
//   unobservable through resolveTableCellCursor's return value.
