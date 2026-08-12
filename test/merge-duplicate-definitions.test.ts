import { describe, expect, it } from "vitest";

import { lintFootnotes } from "../src/linting/linter";
import {
    duplicateFootnoteDefinitionNames,
    mergeDuplicateFootnoteDefinitions,
} from "../src/linting/rules/merge-duplicate-definitions";

// Duplicate definitions, Jason's policy (2026-08-12): Obsidian renders only
// the LAST definition of a name (ground-truthed live, case-insensitively),
// so earlier ones are dead text. With "Merge duplicate definitions" on, the
// later bodies merge INTO the first block in document order as indented
// continuation lines — indentation on purpose: a lazy unindented
// continuation renders the same but is not part of the definition block,
// so move-to-bottom would strand it. With the toggle off, lint alerts
// (duplicates are never silent, like orphans).

describe("mergeDuplicateFootnoteDefinitions", () => {
    it("merges a later duplicate into the first as an indented continuation", () => {
        expect(
            mergeDuplicateFootnoteDefinitions(
                "use[^d] here\n\n[^d]: first body\n\n[^d]: second body",
            ),
        ).toBe("use[^d] here\n\n[^d]: first body\n    second body");
    });

    it("keeps clean seams around a mid-document duplicate", () => {
        expect(
            mergeDuplicateFootnoteDefinitions(
                "use[^d] here\n\n[^d]: first\n\n[^d]: second\n\ntail prose",
            ),
        ).toBe("use[^d] here\n\n[^d]: first\n    second\n\ntail prose");
    });

    it("brings the duplicate's continuation lines along", () => {
        expect(
            mergeDuplicateFootnoteDefinitions(
                "u[^m]\n\n[^m]: first\n    more first\n\n[^m]: second\n    more second\n\ntail",
            ),
        ).toBe(
            "u[^m]\n\n[^m]: first\n    more first\n    second\n    more second\n\ntail",
        );
    });

    it("merges three definitions in document order", () => {
        expect(
            mergeDuplicateFootnoteDefinitions(
                "x[^t]\n\n[^t]: one\n\n[^t]: two\n\n[^t]: three",
            ),
        ).toBe("x[^t]\n\n[^t]: one\n    two\n    three");
    });

    it("duplicate names fold case; the first block keeps its casing", () => {
        expect(
            mergeDuplicateFootnoteDefinitions(
                "see[^Note]\n\n[^note]: lower\n\n[^Note]: upper",
            ),
        ).toBe("see[^Note]\n\n[^note]: lower\n    upper");
    });

    it("an empty duplicate body is simply removed", () => {
        expect(
            mergeDuplicateFootnoteDefinitions("a[^e]\n\n[^e]: kept\n\n[^e]: "),
        ).toBe("a[^e]\n\n[^e]: kept");
    });

    it("a blank-separated second paragraph of the duplicate survives the merge", () => {
        expect(
            mergeDuplicateFootnoteDefinitions(
                "r[^p]\n\n[^p]: base\n\n[^p]: second\n\n    second para",
            ),
        ).toBe("r[^p]\n\n[^p]: base\n    second\n\n    second para");
    });

    it("a definition-shaped line inside a fence is not a duplicate", () => {
        const text = "u[^f]\n\n[^f]: real\n\n```\n[^f]: fake\n```";
        expect(mergeDuplicateFootnoteDefinitions(text)).toBe(text);
    });

    it("no duplicates: the input comes back byte-identical, mixed EOL included", () => {
        const text = "a[^1]\r\n\r\n[^1]: one\nb[^2]";
        expect(mergeDuplicateFootnoteDefinitions(text)).toBe(text);
    });

    it("is idempotent", () => {
        const once = mergeDuplicateFootnoteDefinitions(
            "use[^d]\n\n[^d]: first\n\n[^d]: second\n\ntail",
        );
        expect(mergeDuplicateFootnoteDefinitions(once)).toBe(once);
    });

    it("restores CRLF endings", () => {
        expect(
            mergeDuplicateFootnoteDefinitions(
                "use[^d]\r\n\r\n[^d]: a\r\n\r\n[^d]: b",
            ),
        ).toBe("use[^d]\r\n\r\n[^d]: a\r\n    b");
    });
});

describe("duplicateFootnoteDefinitionNames (the alert's list)", () => {
    it("lists duplicated names once, first-seen casing, first-appearance order", () => {
        expect(
            duplicateFootnoteDefinitionNames(
                "[^b]: one\n[^A]: two\n[^a]: three\n[^b]: four",
            ),
        ).toEqual(["b", "A"]);
    });

    it("ignores definition-shaped lines inside code", () => {
        expect(
            duplicateFootnoteDefinitionNames("[^x]: real\n```\n[^x]: fake\n```"),
        ).toEqual([]);
    });

    it("returns empty for a note with unique definitions", () => {
        expect(
            duplicateFootnoteDefinitionNames("[^1]: one\n[^2]: two"),
        ).toEqual([]);
    });
});

describe("lint pipeline integration", () => {
    it("merges when the option is on, before everything else", () => {
        expect(
            lintFootnotes("use[^d].\n\n[^d]: first\n\n[^d]: second", {
                mergeDuplicateDefinitions: true,
            }),
        ).toBe("use.[^d]\n\n[^d]: first\n    second");
    });

    it("keeps duplicates when the option is off (default)", () => {
        const out = lintFootnotes("use[^d]\n\n[^d]: first\n\n[^d]: second", {});
        expect(out.match(/\[\^d\]:/g)?.length).toBe(2);
    });
});
