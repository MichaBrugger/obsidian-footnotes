import { beforeEach, describe, expect, it } from "vitest";

import { fakeEditor } from "./helpers/fake-editor";
import { fakePlugin } from "./helpers/fake-plugin";
import { messages, resetNotices } from "./helpers/notices";
import { insertAutonumFootnote } from "../src/commands/insert-or-navigate-footnotes";
import { shouldJumpFromReferenceToDefinition } from "../src/commands/navigation";
import { planFootnoteRename } from "../src/commands/rename-footnote";
import { listExistingFootnoteDefinitions } from "../src/editor/doc-context";
import { reindexFootnotes } from "../src/linting/rules/re-index-footnotes";
import {
    orphanedFootnoteReferenceNames,
    removeOrphanedFootnoteReferences,
} from "../src/linting/rules/remove-orphaned-references";
import { inItemDefinitionLabels } from "../src/parsing/list-item-definitions";
import { definitionStartLines, maskProtectedLines, scanDocument } from "../src/parsing/markdown-scan";

// Jason's ruling 1 (2026-09-20, option b): a footnote definition INSIDE a
// list item, written right after the marker ("- [^la]: text") or indented
// to the item's margin ("    [^lb]: text" under "- item"), renders as a
// definition in Reading view (probed in the rulings note). The plugin reads
// labels from the left margin only, so until now the orphan alert nagged
// about the reference and the numbered key appended a second definition
// (with the popup on, the popup then showed the in-item text, since
// Obsidian resolves the name itself). Option (b) recognizes such
// definitions only where they misfired: the orphan-reference alert and
// its deletion, the hotkey's navigate-or-create decision, and the readers
// that would otherwise half-rename them (reindex leaves their names
// alone, the rename command refuses). They are never moved and never form
// blocks. Option (a), modelling them everywhere, waits for more such cases.

const NOTE = [
    "- [^la]: a definition written right after the list marker",
    "- item two",
    "",
    "- item three",
    "",
    "    [^lb]: a definition indented to the item's margin (four spaces)",
    "",
    "Uses: alpha[^la] and bravo[^lb].",
];

const facts = (lines: string[]) => {
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);
    return { scan, masked, starts };
};

const labelsIn = (lines: string[]) => {
    const { scan, masked, starts } = facts(lines);
    return inItemDefinitionLabels(lines, scan, masked, starts);
};

describe("definitions inside list items: the reader", () => {
    it("finds a label right after the marker and one indented to the item's margin", () => {
        // labelEnd is where the label's colon ends on its line: after
        // "- [^la]:" and after "    [^lb]:"
        expect(labelsIn(NOTE)).toEqual([
            { line: 0, name: "la", labelEnd: 8 },
            { line: 5, name: "lb", labelEnd: 10 },
        ]);
    });

    it("control: a column-0 label directly under an item line is lazy prose, not an in-item definition", () => {
        // sheet 25's rule: a label directly under a line of prose (a list
        // item line included) is paragraph text
        expect(labelsIn(["- item", "[^x]: under the item"])).toEqual([]);
    });

    it("control: an indented label under a column-0 definition is that definition's continuation", () => {
        expect(labelsIn(["[^1]: body", "", "    [^2]: continuation text"])).toEqual([]);
    });

    it("control: a label in a fenced code block inside an item is dead", () => {
        expect(labelsIn(["- item", "", "  ```", "  [^c]: code", "  ```"])).toEqual([]);
    });

    it("control: a column-0 paragraph after a blank line ends the item, so a label indented under it is not in the item", () => {
        expect(labelsIn(["- item", "", "prose", "", "    [^d]: chunk"])).toEqual([]);
    });
});

describe("definitions inside list items: the alert, the deletion, and the definition list", () => {
    it("the orphan-reference alert names neither reference", () => {
        expect(orphanedFootnoteReferenceNames(NOTE.join("\n"))).toEqual([]);
    });

    it("orphan-reference deletion leaves both references alone", () => {
        expect(removeOrphanedFootnoteReferences(NOTE.join("\n"))).toBe(NOTE.join("\n"));
    });

    it("the definition list the hotkey consults holds both names", () => {
        const doc = fakeEditor(NOTE, { wholeDoc: true, cursor: { line: 7, ch: 13 } });
        expect(listExistingFootnoteDefinitions(doc)).toEqual(["la", "lb"]);
    });
});

describe("definitions inside list items: the hotkey navigates instead of appending", () => {
    beforeEach(resetNotices);

    it("the reference to the marker-line definition jumps to the end of that line", () => {
        const doc = fakeEditor(NOTE, { wholeDoc: true, cursor: { line: 7, ch: 13 } });
        const handled = shouldJumpFromReferenceToDefinition(
            NOTE[7],
            { line: 7, ch: 13 }, // inside [^la]
            fakePlugin(),
            doc,
        );
        expect(handled).toBe(true);
        expect(doc.moves).toEqual([{ line: 0, ch: NOTE[0].length }]);
    });

    it("the reference to the indented definition jumps to the end of that line", () => {
        const at = NOTE[7].indexOf("[^lb]") + 2;
        const doc = fakeEditor(NOTE, { wholeDoc: true, cursor: { line: 7, ch: at } });
        expect(
            shouldJumpFromReferenceToDefinition(NOTE[7], { line: 7, ch: at }, fakePlugin(), doc),
        ).toBe(true);
        expect(doc.moves).toEqual([{ line: 5, ch: NOTE[5].length }]);
    });

    it("the numbered key on the reference appends no second definition", async () => {
        const doc = fakeEditor(NOTE, { wholeDoc: true, edits: true, cursor: { line: 7, ch: 13 } });
        await insertAutonumFootnote(fakePlugin({}, doc));
        expect(doc.lines).toEqual(NOTE);
        expect(doc.moves).toEqual([{ line: 0, ch: NOTE[0].length }]);
        expect(messages()).toEqual([]);
    });
});

describe("definitions inside list items: never renamed", () => {
    it("reindex leaves a name defined inside an item alone and hands its number to nobody else", () => {
        const doc = ["- [^3]: in an item", "", "use[^9] and[^3]", "", "[^9]: nine"].join("\n");
        expect(reindexFootnotes(doc)).toBe(
            ["- [^3]: in an item", "", "use[^1] and[^3]", "", "[^1]: nine"].join("\n"),
        );
    });

    it("reindex with named footnotes renumbered still leaves the in-item names alone", () => {
        expect(reindexFootnotes(NOTE.join("\n"), { renumberNamedFootnotes: true })).toBe(NOTE.join("\n"));
    });

    it("the rename command refuses a name whose definition sits inside an item, and says why", () => {
        const doc = fakeEditor(NOTE, { wholeDoc: true, cursor: { line: 7, ch: 13 } });
        const plan = planFootnoteRename(doc, "la", "renamed");
        expect(plan.kind).toBe("invalid");
        if (plan.kind === "invalid") expect(plan.reason).toContain("list item");
    });

    it("a new name that an in-item definition already holds is a collision", () => {
        const doc = fakeEditor(
            [...NOTE, "", "other[^o]", "", "[^o]: plain"],
            { wholeDoc: true, cursor: { line: 9, ch: 7 } },
        );
        expect(planFootnoteRename(doc, "o", "lb").kind).toBe("collision");
    });
});
