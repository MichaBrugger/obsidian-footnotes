import { describe, expect, it } from "vitest";

import { carriedDefinitions } from "../src/commands/carry-footnotes";

// Carrying footnote definitions along on copy, cut and paste (issue #59;
// Jason's rulings 2026-09-21 and 22). The first seam: which definition
// blocks a selection needs. A reference inside the selection whose
// definition sits outside it needs that definition carried; a reference
// inside a carried definition's body needs its own definition too, all the
// way down; a definition the selection already contains travels with the
// text and is not carried again. What has no definition to carry (an
// orphan, a lazy label, a definition inside a list item, which the plugin
// does not model) is reported as missing so the toast can say so.

function carry(lines: string[], from: { line: number; ch: number }, to: { line: number; ch: number }) {
    return carriedDefinitions(lines.join("\n"), from, to);
}

describe("carriedDefinitions", () => {
    it("carries the definition of a reference inside the selection when its block lies outside", () => {
        expect(carry(["a[^1] b", "", "[^1]: one"], { line: 0, ch: 0 }, { line: 0, ch: 7 })).toEqual({
            carried: [{ name: "1", lines: ["[^1]: one"] }],
            missing: [],
        });
    });

    it("does not carry a definition the selection already contains", () => {
        expect(carry(["a[^1] b", "", "[^1]: one"], { line: 0, ch: 0 }, { line: 2, ch: 9 })).toEqual({
            carried: [],
            missing: [],
        });
    });

    it("follows references inside a carried body, in first-reference order, and stops there", () => {
        expect(
            carry(["a[^a] z[^z]", "", "[^a]: see[^b]", "[^b]: bee", "[^c]: cee", "[^z]: zed"], { line: 0, ch: 0 }, { line: 0, ch: 11 }),
        ).toEqual({
            carried: [
                { name: "a", lines: ["[^a]: see[^b]"] },
                { name: "b", lines: ["[^b]: bee"] },
                { name: "z", lines: ["[^z]: zed"] },
            ],
            missing: [],
        });
    });

    it("carries a multi-line block whole and a quoted definition with its quoted continuation", () => {
        expect(carry(["a[^m]", "", "[^m]: first", "    second"], { line: 0, ch: 0 }, { line: 0, ch: 5 }).carried).toEqual([
            { name: "m", lines: ["[^m]: first", "    second"] },
        ]);
        expect(carry(["a[^q]", "", "> [^q]: quoted", "> more"], { line: 0, ch: 0 }, { line: 0, ch: 5 }).carried).toEqual([
            { name: "q", lines: ["> [^q]: quoted", "> more"] },
        ]);
    });

    it("reports a reference with nothing to carry: an orphan, a lazy label, an in-item definition", () => {
        expect(carry(["a[^x]"], { line: 0, ch: 0 }, { line: 0, ch: 5 })).toEqual({ carried: [], missing: ["x"] });
        expect(carry(["a[^l]", "[^l]: lazy"], { line: 0, ch: 0 }, { line: 0, ch: 5 }).missing).toEqual(["l"]);
        expect(carry(["- a[^i]", "- [^i]: in the item"], { line: 0, ch: 0 }, { line: 0, ch: 7 }).missing).toEqual(["i"]);
    });

    it("ignores a reference in protected text and one the selection cuts through", () => {
        expect(carry(["`x[^p]` y[^q]", "", "[^p]: p", "[^q]: q"], { line: 0, ch: 0 }, { line: 0, ch: 13 }).carried).toEqual([
            { name: "q", lines: ["[^q]: q"] },
        ]);
        expect(carry(["a[^1] b", "", "[^1]: one"], { line: 0, ch: 0 }, { line: 0, ch: 3 }).carried).toEqual([]);
    });

    it("carries the last of duplicate definitions, the one Obsidian renders, and keeps the note's line endings out of the lines", () => {
        expect(carry(["a[^d]", "", "[^d]: one", "", "[^d]: two"], { line: 0, ch: 0 }, { line: 0, ch: 5 }).carried).toEqual([
            { name: "d", lines: ["[^d]: two"] },
        ]);
        expect(carriedDefinitions("a[^1]\r\n\r\n[^1]: one", { line: 0, ch: 0 }, { line: 0, ch: 5 }).carried).toEqual([
            { name: "1", lines: ["[^1]: one"] },
        ]);
    });
});
