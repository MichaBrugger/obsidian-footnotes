import { beforeEach, describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";
import { resetNotices } from "../helpers/notices";

import {
    shouldJumpFromDefinitionToReference,
} from "../../src/commands/navigation";

// spec question: when the caret sits inside the brackets of a lazy label
// whose name IS defined for real further down the note, should the press
// navigate to that real definition (a jump, or the popup when it is on),
// or should it insert a new footnote?
//
// Reading one, "navigate": a lazy label's own "[^1]" is a live reference,
// ground-truthed in Reading view on 2026-09-09 and pinned in
// test/hunt/bug-lazy-label-reference-is-live. The cascade's second step says
// a reference that has a definition jumps to it, and rename already treats
// this same "[^1]" as a live reference when it decides what the caret is on.
// So the press should land on the real definition.
//
// Reading two, "insert": manual sheet 25's hotkey bullet says, of the lazy
// label line, "Hotkey on the [^p1]: line: a plain insert as well". Taken at
// face value that settles it, and inserting is what the plugin does today.
//
// Why the bullet does not settle it: in sheet 25's own fixtures the name on
// the lazy label line has no definition anywhere in the note, so both
// readings produce the same visible result there and the sheet never had to
// choose. The bullet also omits the qualifier the sheet's rename clause
// spells out, that the caret is INSIDE the brackets, which is the only
// position this question is about. And adopting the navigate reading would
// change sheet 25's own fixtures: a press inside the label's brackets there
// would stop inserting at the caret and start appending a definition for an
// as-yet-undefined name.
//
// Hunt: 2026-09-13. Lens: popup routing and the navigation cascade.
// The corruption this same gate causes is pinned separately in
// test/hunt/bug-press-inside-column-zero-lazy-label-nests; this file is only
// about which HALF of the cascade should own the press.

const mixed = ["some prose paragraph", "[^1]: lazy label, paragraph text", "", "[^1]: the real definition"];
const at = { line: 1, ch: 3 };

beforeEach(() => {
    resetNotices();
});

// RULED 2026-09-15 (Jason): the DEFINITION half owns the press. A lazy
// label is treated as the definition the user meant, so the press jumps to
// the footnote's reference in the text (none here, so it explains that and
// moves nowhere), and the reference half is never reached.
describe("a press inside a lazy label's own reference", () => {
    it("the definition half of the cascade claims it", () => {
        const doc = fakeEditor(mixed, { wholeDoc: true });
        expect(
            shouldJumpFromDefinitionToReference(mixed[1], at, fakePlugin({ enablePopupEditor: false }, doc), doc),
        ).toBe(true);
        expect(doc.moves).toEqual([]);
    });

    it("with a reference elsewhere, it jumps there", () => {
        const withUse = ["some prose paragraph", "[^1]: lazy label, paragraph text", "", "use[^1] here", "", "[^1]: the real definition"];
        const doc = fakeEditor(withUse, { wholeDoc: true });
        expect(
            shouldJumpFromDefinitionToReference(withUse[1], at, fakePlugin({ enablePopupEditor: false }, doc), doc),
        ).toBe(true);
        expect(doc.moves).toEqual([{ line: 3, ch: "use[^1]".length }]);
    });
});
