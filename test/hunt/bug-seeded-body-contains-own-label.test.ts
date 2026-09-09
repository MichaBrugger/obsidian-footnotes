import { beforeEach, describe, expect, it } from "vitest";

import { resetNotices, messages } from "../helpers/notices";
import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";

import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";

// BUG (review A4, Jason confirmed live 2026-09-08): converting a selection
// whose text contains its own future label ("[^1]: " inside a code span,
// say) was refused with the protected-text toast. convertMainSelection
// located the label line with lastIndexOf on the SEEDED change text, so a
// label-shaped string in the body won instead of the real label; the
// verification then looked at a continuation line, found no definition
// block starting there, and refused the whole press. The label offset is
// now taken from seedDefinitionBody, which computes it against the
// UNSEEDED text where lastIndexOf is correct.

function convert(lines: string[]) {
    const last = lines.length - 1;
    const doc = fakeEditor(lines, {
        cursor: { line: 0, ch: 0 },
        selection: { anchor: { line: 0, ch: 0 }, head: { line: last, ch: lines[last].length } },
        edits: true,
        wholeDoc: true,
    });
    const plugin = fakePlugin(
        {
            insertAtEndOfWord: false,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            enableRemoveBlankLastLines: true,
        },
        doc,
    );
    return { doc, plugin };
}

describe("a selection whose body contains the new footnote's own label converts", () => {
    beforeEach(resetNotices);

    it("converts exactly like the same body with a different label inside it", async () => {
        const control = convert(["a", "`[^7]: x`"]);
        await insertAutonumFootnote(control.plugin);
        // the control must itself have converted, or the comparison proves nothing
        expect(control.doc.lines[0]).toBe("[^1]");
        const expected = control.doc.lines.map((l) => l.replace("`[^7]: x`", "`[^1]: x`"));

        const { doc, plugin } = convert(["a", "`[^1]: x`"]);
        await insertAutonumFootnote(plugin);
        expect(messages()).toEqual([]);
        expect(doc.lines).toEqual(expected);
    });
});
