import { describe, expect, it } from "vitest";

import { lintFootnotes } from "../src/linting/linter";
import {
    orphanedFootnoteDefinitionNames,
    removeOrphanedFootnoteDefinitions,
} from "../src/linting/rules/remove-orphaned-definitions";
import {
    orphanedFootnoteMarkerNames,
    removeOrphanedFootnoteMarkers,
} from "../src/linting/rules/remove-orphaned-markers";

// The symmetric orphan handling (requested 2026-08-10): markers with no
// definition and definitions with no marker each get a delete toggle, and
// while a toggle is off linting alerts about that orphan kind instead —
// orphans are never silent.

describe("orphanedFootnoteMarkerNames (the alert's list)", () => {
    it("lists markers with no definition, in first-appearance order", () => {
        const doc = "a[^9] b[^note] c[^1]\n\n[^1]: one";
        expect(orphanedFootnoteMarkerNames(doc)).toEqual(["9", "note"]);
    });

    it("a definition in any casing keeps its markers off the list", () => {
        expect(orphanedFootnoteMarkerNames("see[^Note]\n\n[^note]: n")).toEqual([]);
    });

    it("repeats of one orphan are listed once, first-seen casing", () => {
        expect(orphanedFootnoteMarkerNames("a[^Tag] b[^tag]")).toEqual(["Tag"]);
    });

    it("markers in code and invalid names don't count", () => {
        const doc = "`x[^9]` and [^my note] end";
        expect(orphanedFootnoteMarkerNames(doc)).toEqual([]);
    });

    it("the note's bare-prefix placeholder is not an orphan", () => {
        expect(orphanedFootnoteMarkerNames("mid [^ch~] naming", "ch~")).toEqual([]);
        // case-variant placeholder too — ids fold
        expect(orphanedFootnoteMarkerNames("mid [^CH~] naming", "ch~")).toEqual([]);
        // …but only the exact placeholder — a named orphan still counts
        expect(orphanedFootnoteMarkerNames("mid [^2.] x[^stray]", "2.")).toEqual([
            "stray",
        ]);
    });
});

describe("removeOrphanedFootnoteMarkers", () => {
    it("removes every occurrence of an orphaned marker, keeps referenced ones", () => {
        const doc = "keep[^1] drop[^9] again[^9] end\n\n[^1]: one";
        expect(removeOrphanedFootnoteMarkers(doc)).toBe(
            "keep[^1] drop again end\n\n[^1]: one",
        );
    });

    it("heals the spacing seam between words", () => {
        expect(removeOrphanedFootnoteMarkers("a [^9] b")).toBe("a b");
        expect(removeOrphanedFootnoteMarkers("[^9] start")).toBe("start");
    });

    it("a marker closing the line takes its leading space along", () => {
        expect(removeOrphanedFootnoteMarkers("word [^9]")).toBe("word");
    });

    it("preserves a markdown hard break after the marker", () => {
        expect(removeOrphanedFootnoteMarkers("word[^9]  \nnext")).toBe(
            "word  \nnext",
        );
    });

    it("leaves code, definitions, and invalid names alone", () => {
        const doc = [
            "```",
            "sample[^9]",
            "```",
            "prose `x[^8]` and [^my note] here",
        ].join("\n");
        expect(removeOrphanedFootnoteMarkers(doc)).toBe(doc);
    });

    it("never deletes the note's bare-prefix placeholder", () => {
        expect(removeOrphanedFootnoteMarkers("mid [^p-] naming", "p-")).toBe(
            "mid [^p-] naming",
        );
    });

    it("case-variant definitions keep their markers", () => {
        const doc = "see[^Note] end\n\n[^note]: n";
        expect(removeOrphanedFootnoteMarkers(doc)).toBe(doc);
    });

    it("is idempotent", () => {
        const once = removeOrphanedFootnoteMarkers("a[^9] b[^1]\n\n[^1]: one");
        expect(removeOrphanedFootnoteMarkers(once)).toBe(once);
    });

    it("preserves CRLF line endings", () => {
        expect(removeOrphanedFootnoteMarkers("drop[^9] x\r\nnext")).toBe(
            "drop x\r\nnext",
        );
    });
});

describe("lintFootnotes with removeOrphanedMarkers", () => {
    it("deletes orphans first, then reindexes the survivors", () => {
        const doc = "a[^7] b[^3] end\n\n[^3]: three";
        expect(
            lintFootnotes(doc, { removeOrphanedMarkers: true }),
        ).toBe("a b[^1] end\n\n[^1]: three");
    });

    it("one lint pass converges (idempotent with deletion on)", () => {
        const doc = "a[^7] b[^3].\n\n[^3]: three\n[^9]: orphan def";
        const options = { removeOrphanedMarkers: true };
        const once = lintFootnotes(doc, options);
        expect(lintFootnotes(once, options)).toBe(once);
    });

    it("the safe prefix rides through the pipeline", () => {
        const doc = "---\nfootnote-prefix: 2.\n---\nmid [^2.] naming";
        const out = lintFootnotes(doc, {
            removeOrphanedMarkers: true,
            orphanSafePrefix: "2.",
        });
        expect(out).toContain("[^2.]");
    });
});

describe("removeOrphanedFootnoteDefinitions", () => {
    it("removes an unreferenced definition block, continuation lines included", () => {
        const doc = "text[^1]\n\n[^1]: used\n[^9]: stray\n    continues";
        expect(removeOrphanedFootnoteDefinitions(doc)).toBe(
            "text[^1]\n\n[^1]: used",
        );
    });

    it("deletes a 25-deep chain in ONE call (no iteration cap)", () => {
        const chain = Array.from({ length: 25 }, (_, i) =>
            i === 24 ? "[^25]: end" : `[^${i + 1}]: uses[^${i + 2}]`,
        ).join("\n");
        const out = removeOrphanedFootnoteDefinitions(`para.\n\n${chain}`);
        expect(out).toBe("para.\n");
        expect(removeOrphanedFootnoteDefinitions(out)).toBe(out);
    });

    it("keeps a cycle of definitions referencing each other (reindex parity)", () => {
        const doc = "para.\n\n[^a]: uses[^b]\n[^b]: uses[^a]";
        expect(removeOrphanedFootnoteDefinitions(doc)).toBe(doc);
    });

    it("a case-variant marker keeps its definition", () => {
        const doc = "see[^Note]\n\n[^note]: n";
        expect(removeOrphanedFootnoteDefinitions(doc)).toBe(doc);
    });

    it("definition-shaped lines inside code are not definitions (or references)", () => {
        const doc = "```\n[^9]: fenced\nuses[^9]\n```\nprose";
        expect(removeOrphanedFootnoteDefinitions(doc)).toBe(doc);
    });

    it("works without reindex: lintFootnotes deletes with reindex off", () => {
        const doc = "Text[^2].\n\n[^2]: used\n[^9]: orphan";
        expect(
            lintFootnotes(doc, {
                removeOrphanedDefinitions: true,
                reindex: false,
                fixPunctuation: false,
                moveDefinitionsToBottom: false,
            }),
        ).toBe("Text[^2].\n\n[^2]: used");
    });
});

describe("orphanedFootnoteDefinitionNames (the definition-side alert)", () => {
    it("lists definitions no marker references, in definition order", () => {
        const doc = "text[^1]\n\n[^1]: used\n[^9]: stray\n[^note]: also stray";
        expect(orphanedFootnoteDefinitionNames(doc)).toEqual(["9", "note"]);
    });

    it("a case-variant marker counts as a reference", () => {
        expect(
            orphanedFootnoteDefinitionNames("see[^Note]\n\n[^note]: n"),
        ).toEqual([]);
    });

    it("a marker nested in another definition's body counts", () => {
        const doc = "text[^1]\n\n[^1]: see also[^2]\n[^2]: nested ref";
        expect(orphanedFootnoteDefinitionNames(doc)).toEqual([]);
    });

    it("definitions inside code don't count", () => {
        const doc = "```\n[^9]: fenced\n```\nprose";
        expect(orphanedFootnoteDefinitionNames(doc)).toEqual([]);
    });
});
