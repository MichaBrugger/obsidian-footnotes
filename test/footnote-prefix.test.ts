import { describe, expect, it } from "vitest";

import { footnotePrefix, footnotePrefixProblem } from "../src/parsing/footnote-prefix";
import { computeNextFootnoteNumber } from "../src/parsing/footnote-grammar";
import { lintBlockedByPrefix } from "../src/linting/linter";

// Issue #31: notes that are chapters of a larger document need their
// numbered footnotes namespaced (e.g. [^2.1] in chapter 2) so the combined
// export has no colliding numbers. The prefix comes from a per-note
// frontmatter property `footnote-prefix`; the autonumbered command then
// counts and creates only references carrying that prefix.

describe("footnotePrefix", () => {
    it("returns empty for a note without frontmatter", () => {
        expect(footnotePrefix("plain text")).toBe("");
    });

    it("returns empty when frontmatter has no footnote-prefix", () => {
        expect(footnotePrefix("---\ntitle: t\n---\nbody")).toBe("");
    });

    // Bug #11 (2026-08-11 review, Kimi; ground-truthed via metadataCache):
    // Obsidian surfaces NO properties from an unclosed "---" block, so a
    // footnote-prefix in one must not namespace footnotes — the plugin was
    // minting prefixed ids from a setting the user cannot see
    it("ignores a footnote-prefix inside UNCLOSED frontmatter", () => {
        expect(footnotePrefix("---\nfootnote-prefix: 2.\nbody")).toBe("");
    });

    it("ignores an unclosed block even when the property is its last line", () => {
        expect(footnotePrefix("---\nfootnote-prefix: 2.")).toBe("");
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
    it("counts only references carrying the prefix", () => {
        expect(computeNextFootnoteNumber("a[^2.1] b[^2.3]", "2.")).toBe(4);
    });

    it("plain numbered references do not count under a prefix", () => {
        expect(computeNextFootnoteNumber("a[^9] b[^2.1]", "2.")).toBe(2);
    });

    it("prefixed references do not count without the prefix", () => {
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

    it("counts prefixed definitions as reserving their number", () => {
        expect(computeNextFootnoteNumber("[^2.7]: orphan", "2.")).toBe(8);
    });
});

describe("footnotePrefixProblem (QOL: prefix validation)", () => {
    it("accepts a normal prefix", () => {
        expect(footnotePrefixProblem("2.")).toBeNull();
        expect(footnotePrefixProblem("ch-")).toBeNull();
        expect(footnotePrefixProblem("arXiv:")).toBeNull();
    });

    it("accepts empty (it clears the property)", () => {
        expect(footnotePrefixProblem("")).toBeNull();
    });

    it("rejects spaces and brackets", () => {
        expect(footnotePrefixProblem("a b")).toMatch(/spaces, backticks, or brackets/);
        expect(footnotePrefixProblem("a[b]")).toMatch(/spaces, backticks, or brackets/);
        expect(footnotePrefixProblem("a`b`")).toMatch(/spaces, backticks, or brackets/);
    });

    it("rejects a trailing digit: [^101] would be ambiguous", () => {
        expect(footnotePrefixProblem("10")).toMatch(/end in a number/);
        expect(footnotePrefixProblem("ch2")).toMatch(/end in a number/);
    });

    it("allows digits that are not trailing", () => {
        expect(footnotePrefixProblem("2a-")).toBeNull();
        expect(footnotePrefixProblem("10.")).toBeNull();
    });
});

describe("lintBlockedByPrefix (QOL: lint cancels on bad prefix)", () => {
    it("does not block without a prefix property", () => {
        expect(lintBlockedByPrefix("plain[^1] note\n\n[^1]: x")).toBeNull();
    });

    it("does not block a valid prefix", () => {
        expect(
            lintBlockedByPrefix("---\nfootnote-prefix: 2.\n---\nbody"),
        ).toBeNull();
    });

    it("blocks a digit-ending prefix with the alert text", () => {
        expect(
            lintBlockedByPrefix("---\nfootnote-prefix: 10\n---\nbody"),
        ).toMatch(/canceled.*"10"/);
    });
});
