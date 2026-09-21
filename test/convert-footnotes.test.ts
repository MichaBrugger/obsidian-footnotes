import { describe, expect, it } from "vitest";

import { convertNormalFootnotesToInline } from "../src/commands/convert-footnotes";

// Converting a note's footnotes between the two styles (T6 of the 2026-09
// feature round; Jason's rulings 2026-09-19 to 21). Normal to inline is a
// pure transform over the whole note: every single-line definition becomes
// an "^[body]" at each of its references and its block is cut. A
// definition the inline form cannot hold is skipped and named: more than
// one line (the refuse-do-not-flatten ruling of 2026-08-20), an empty
// body, a body holding a footnote (no nesting, ADR 1), a reference inside
// another definition's body (the same), a quoted, in-item or closer-line
// definition, an orphan, a name defined twice. A definition used more than
// once becomes that many identical copies, and the result says so.

function convert(lines: string[]) {
    return convertNormalFootnotesToInline(lines.join("\n"));
}

describe("convertNormalFootnotesToInline", () => {
    it("turns a single-line definition into an inline footnote at its reference and cuts the block", () => {
        expect(convert(["text[^1] more", "", "[^1]: the note"])).toMatchObject({
            markdown: "text^[the note] more",
            converted: 1,
            references: 1,
            duplicated: 0,
            skipped: [],
        });
    });

    it("skips a definition of more than one line, by name and reason, and converts the rest", () => {
        expect(convert(["a[^1] b[^2]", "", "[^1]: one", "[^2]: first", "    second"])).toMatchObject({
            markdown: "a^[one] b[^2]\n\n[^2]: first\n    second",
            converted: 1,
            skipped: [{ name: "2", reason: "more than one line" }],
        });
    });

    it("copies a definition used more than once to every reference and counts the duplication", () => {
        expect(convert(["a[^n] b[^n]", "", "[^n]: shared"])).toMatchObject({
            markdown: "a^[shared] b^[shared]",
            converted: 1,
            references: 2,
            duplicated: 1,
        });
    });

    it("never nests: a body holding a footnote is skipped, and so is a name referenced from inside another definition's body", () => {
        const lines = ["a[^1]", "", "[^1]: see[^2]", "[^2]: two"];
        expect(convert(lines)).toMatchObject({
            markdown: lines.join("\n"),
            converted: 0,
            skipped: [
                { name: "1", reason: "its body holds a footnote" },
                { name: "2", reason: "referenced from inside another footnote" },
            ],
        });
    });

    it("skips an empty body, a quoted definition, one inside a list item, an orphan and a name defined twice", () => {
        expect(convert(["a[^e]", "", "[^e]:"]).skipped).toEqual([{ name: "e", reason: "empty" }]);
        expect(convert(["a[^q]", "", "> [^q]: quoted"]).skipped).toEqual([{ name: "q", reason: "inside a blockquote" }]);
        expect(convert(["- a[^i]", "- [^i]: in the item"]).skipped).toEqual([{ name: "i", reason: "inside a list item" }]);
        expect(convert(["text", "", "[^o]: orphan"]).skipped).toEqual([{ name: "o", reason: "nothing references it" }]);
        expect(convert(["a[^d]", "", "[^d]: one", "", "[^d]: two"]).skipped).toEqual([{ name: "d", reason: "defined more than once" }]);
    });

    it("escapes a bracket that would end the inline footnote early", () => {
        expect(convert(["a[^1]", "", "[^1]: see [note"]).markdown).toBe("a^[see \\[note]");
    });

    it("escapes a pipe when the reference sits in a table row", () => {
        expect(convert(["| a[^1] |", "| - |", "", "[^1]: x | y"]).markdown).toBe("| a^[x \\| y] |\n| - |");
    });

    it("leaves a reference inside protected text alone and converts the live one", () => {
        expect(convert(["real[^1] `x[^1]`", "", "[^1]: n"]).markdown).toBe("real^[n] `x[^1]`");
    });

    it("keeps Windows line endings", () => {
        expect(convertNormalFootnotesToInline("a[^1]\r\nb\r\n\r\n[^1]: n").markdown).toBe("a^[n]\r\nb");
    });

    it("has nothing to do on a note with a lazy label only, or on its own output", () => {
        const lazy = ["prose[^l]", "[^l]: lazy"];
        expect(convert(lazy)).toMatchObject({ markdown: lazy.join("\n"), converted: 0, skipped: [] });
        const once = convert(["a[^1] b[^2]", "", "[^1]: one", "[^2]: two"]);
        expect(convertNormalFootnotesToInline(once.markdown)).toMatchObject({ markdown: once.markdown, converted: 0 });
    });
});
