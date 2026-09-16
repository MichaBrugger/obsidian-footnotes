import { describe, expect, it } from "vitest";

import {
    orphanedFootnoteDefinitionNames,
    removeOrphanedFootnoteDefinitions,
} from "../src/linting/rules/remove-orphaned-definitions";
import {
    orphanedFootnoteReferenceNames,
    removeOrphanedFootnoteReferences,
} from "../src/linting/rules/remove-orphaned-references";
import { lintFootnotes } from "../src/linting/linter";
import { reindexFootnotes } from "../src/linting/rules/re-index-footnotes";

// Promoted from a parallel review's scratch probes (2026-08-10): the
// probes found the orphan rules discovering definitions via column-0
// (column-0 DefinitionStart only), while C22 made blockquoted/callout
// definitions ("> [^x]: …") live everywhere else (listed, navigable,
// punctuation-safe, and they keep their references alive in the orphan-
// REFERENCES rule via definitionLabelIn).

describe("blockquoted orphan definitions vs the new orphan rules", () => {
    it("A1: alert lists a blockquoted orphan definition (never-silent invariant)", () => {
        // "> [^9]: stray" is a live definition (C22) nothing references.
        // Toggle OFF → the alert should name it; expect ["9"].
        expect(orphanedFootnoteDefinitionNames("para.\n\n> [^9]: stray")).toEqual(["9"]);
    });

    it("A2: delete toggle removes a blockquoted orphan definition", () => {
        expect(removeOrphanedFootnoteDefinitions("para.\n\n> [^9]: stray")).toBe("para.");
    });

    it("B1: a blockquoted duplicate's label masquerades as a reference, keeping a column-0 orphan alive", () => {
        // two live definitions of "1", zero references anywhere - both orphan.
        const doc = "para.\n\n[^1]: stray\n> [^1]: quoted dup";
        expect(orphanedFootnoteDefinitionNames(doc)).toEqual(["1"]);
    });

    it("B2: same pair - deletion should at least cut the column-0 block", () => {
        const doc = "para.\n\n[^1]: stray\n> [^1]: quoted dup";
        const out = removeOrphanedFootnoteDefinitions(doc);
        expect(out).not.toBe(doc);
    });

    it("C: sanity - C22 pinned behavior still holds (blockquoted def keeps reference alive)", () => {
        const doc = "> quoted[^1]\n>\n> [^1]: def\n\nplain[^1] too";
        expect(removeOrphanedFootnoteReferences(doc)).toBe(doc);
        expect(orphanedFootnoteReferenceNames(doc)).toEqual([]);
    });

    it("D: sanity - reindex renames a blockquoted label consistently with its reference", () => {
        expect(reindexFootnotes("text[^5]\n\n> [^5]: five")).toBe(
            "text[^1]\n\n> [^1]: five",
        );
    });

    it("E: full lint - orphan-def toggle on, all definitions in a callout, one loses its reference", () => {
        const doc = "text[^1] more\n\n> [!note]- Footnotes\n> [^1]: one\n> [^2]: two";
        const out = lintFootnotes(doc, {
            removeOrphanedDefinitions: true,
            reindex: false,
            fixPunctuation: false,
            moveDefinitionsToBottom: false,
        });
        // [^2] has no reference anywhere - its definition should be deletable.
        expect(out).not.toBe(doc);
    });
});
