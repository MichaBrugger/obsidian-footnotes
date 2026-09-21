import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";

import FootnotePlugin from "../../src/main";
import {
    definedMoreThanOnce,
    popupRouteFor,
    shouldJumpFromReferenceToDefinition,
} from "../../src/commands/navigation";

// Jason's manual pass, sheet 03 (2026-09-09): with the popup on, pressing
// the hotkey inside "[^dup]" opened the popup on the FIRST "[^dup]:"
// definition, while Obsidian renders the LAST one (and the jump, with the
// popup off, goes to the last one). The popup's embed is resolved by
// Obsidian's own subpath lookup, which picks the first match, and that
// cannot be steered. So a footnote defined more than once skips the popup
// and jumps to the definition that renders; the duplicate lint alert
// already tells the user how to fix the note. (The live half - the popup
// really staying shut - is a smoke test; the unit suite has no embed
// registry to open one with.)

const LINES = ["dup here[^dup] and one[^one]", "", "[^one]: single", "[^dup]: body", "[^dup]: another body"];

/** A plugin whose popup is on AND can bind: the registry shape popupEditingAvailable looks for. */
function pluginWithPopup(): FootnotePlugin {
    const plugin = fakePlugin({ enablePopupEditor: true });
    (plugin as unknown as { app: unknown }).app = {
        embedRegistry: { embedByExtension: { md: () => ({}) } },
    };
    return plugin;
}

describe("a duplicated footnote and the popup", () => {
    it("definedMoreThanOnce counts definitions of one name, any casing", () => {
        expect(definedMoreThanOnce(["one", "dup", "dup"], "dup")).toBe(true);
        expect(definedMoreThanOnce(["one", "Dup", "dup"], "DUP")).toBe(true);
        expect(definedMoreThanOnce(["one", "dup"], "dup")).toBe(false);
        expect(definedMoreThanOnce([], "dup")).toBe(false);
    });

    it("the popup route is taken for a footnote defined once, never for a duplicated one", () => {
        const plugin = pluginWithPopup();
        expect(popupRouteFor(plugin, ["one", "dup", "dup"], "one")).toBe(true);
        expect(popupRouteFor(plugin, ["one", "dup", "dup"], "dup")).toBe(false);
        // and never while the popup is off
        expect(popupRouteFor(fakePlugin({ enablePopupEditor: false }), ["one"], "one")).toBe(false);
    });

    it("a press inside the duplicated reference lands on the LAST definition, the one Obsidian renders", () => {
        const doc = fakeEditor(LINES, { cursor: { line: 0, ch: 10 }, wholeDoc: true });
        const handled = shouldJumpFromReferenceToDefinition(LINES[0], { line: 0, ch: 10 }, fakePlugin({}, doc), doc);
        expect(handled).toBe(true);
        expect(doc.getCursor()).toEqual({ line: 4, ch: LINES[4].length });
    });
});
