import { describe, expect, it } from "vitest";

import { listExistingFootnoteDefinitions } from "../src/editor/doc-context";
import { shouldJumpFromDefinitionToReference, shouldJumpFromReferenceToDefinition } from "../src/commands/navigation";
import { removeOrphanedFootnoteReferences } from "../src/linting/rules/remove-orphaned-references";

import { fakeEditor } from "./helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";

// C22 (Jason, 2026-08-10): footnote creation, navigation, and linting work
// correctly inside blockquotes/callouts. A "> [^1]: def" label is a live
// definition: it is listed (so the hotkey navigates instead of appending a
// duplicate), it survives the punctuation swap (pinned in
// test/hunt/spec-blockquoted-definition-punctuation), and its references
// are never "orphans".

const fakePlugin = sharedFakePlugin({ enablePopupEditor: false });

describe("definitions inside blockquotes/callouts (C22)", () => {
    const CALLOUT = ["> [!note]", "> body[^1] here", "> [^1]: def"];

    it("a callout definition is listed", () => {
        const doc = fakeEditor(CALLOUT, { wholeDoc: true });
        expect(listExistingFootnoteDefinitions(doc)).toEqual(["1"]);
    });

    it("pressing on the reference navigates to the callout definition (no duplicate)", () => {
        const doc = fakeEditor(CALLOUT, { wholeDoc: true });
        const handled = shouldJumpFromReferenceToDefinition(
            CALLOUT[1],
            { line: 1, ch: 8 }, // inside [^1]
            fakePlugin,
            doc,
        );
        expect(handled).toBe(true);
        expect(doc.moves).toEqual([{ line: 2, ch: CALLOUT[2].length }]);
    });

    it("pressing on the callout definition jumps back to the first reference", () => {
        const doc = fakeEditor(CALLOUT, { wholeDoc: true });
        const handled = shouldJumpFromDefinitionToReference(
            CALLOUT[2],
            { line: 2, ch: 5 },
            fakePlugin,
            doc,
        );
        expect(handled).toBe(true);
        // "> body[^1]" - the reference ends at ch 10
        expect(doc.moves).toEqual([{ line: 1, ch: 10 }]);
    });

    it("a callout definition with no reference reports instead of jumping to itself", () => {
        const lines = ["> [^lone]: nobody points here"];
        const doc = fakeEditor(lines, { wholeDoc: true });
        const handled = shouldJumpFromDefinitionToReference(
            lines[0],
            { line: 0, ch: 4 },
            fakePlugin,
            doc,
        );
        expect(handled).toBe(true); // the Notice path - press consumed
        expect(doc.moves).toEqual([]);
    });

    it("references whose only definition is blockquoted are not orphans", () => {
        const doc = "> quoted[^1]\n> [^1]: def\nplain[^1] too";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
    });
});
