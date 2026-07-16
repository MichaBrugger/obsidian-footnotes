import { describe, expect, it } from "vitest";

import {
    computeNextFootnoteNumber,
    footnotePrefix,
} from "../src/insert-or-navigate-footnotes";

// Issue #31: notes that are chapters of a larger document need their
// numbered footnotes namespaced (e.g. [^2.1] in chapter 2) so the combined
// export has no colliding numbers. The prefix comes from a per-note
// frontmatter property `footnote-prefix`; the autonumbered command then
// counts and creates only markers carrying that prefix.

describe("footnotePrefix", () => {
    it("returns empty for a note without frontmatter", () => {
        expect(footnotePrefix("plain text")).toBe("");
    });

    it("returns empty when frontmatter has no footnote-prefix", () => {
        expect(footnotePrefix("---\ntitle: t\n---\nbody")).toBe("");
    });

    it("reads the prefix from frontmatter", () => {
        expect(footnotePrefix("---\nfootnote-prefix: 2.\n---\nbody")).toBe(
            "2.",
        );
    });

    it("strips surrounding quotes", () => {
        expect(
            footnotePrefix('---\nfootnote-prefix: "2."\n---\nbody'),
        ).toBe("2.");
        expect(
            footnotePrefix("---\nfootnote-prefix: 'ch-'\n---\nbody"),
        ).toBe("ch-");
    });

    it("ignores a footnote-prefix line in the body", () => {
        expect(footnotePrefix("body first\nfootnote-prefix: 2.\n")).toBe("");
        expect(
            footnotePrefix("---\ntitle: t\n---\nfootnote-prefix: 2.\n"),
        ).toBe("");
    });

    it("returns empty for an empty value", () => {
        expect(footnotePrefix("---\nfootnote-prefix:\n---\nbody")).toBe("");
    });
});

describe("computeNextFootnoteNumber with a prefix", () => {
    it("counts only markers carrying the prefix", () => {
        expect(computeNextFootnoteNumber("a[^2.1] b[^2.3]", "2.")).toBe(4);
    });

    it("plain numbered markers do not count under a prefix", () => {
        expect(computeNextFootnoteNumber("a[^9] b[^2.1]", "2.")).toBe(2);
    });

    it("prefixed markers do not count without the prefix", () => {
        expect(computeNextFootnoteNumber("a[^9] b[^2.1]")).toBe(10);
    });

    it("treats the prefix literally, not as a regex", () => {
        // "2." must not match "2x" via the dot
        expect(computeNextFootnoteNumber("a[^2x1]", "2.")).toBe(1);
    });

    it("still ignores code blocks", () => {
        expect(
            computeNextFootnoteNumber("```\nfake[^2.9]\n```", "2."),
        ).toBe(1);
    });

    it("counts prefixed details as reserving their number", () => {
        expect(computeNextFootnoteNumber("[^2.7]: orphan", "2.")).toBe(8);
    });
});
