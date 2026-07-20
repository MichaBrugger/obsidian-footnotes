import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../src/linting/rules/re-index-footnotes";
import { lintFootnotes } from "../src/linting/linter";

// QOL (2026-07-18): footnotes carrying the note's own footnote-prefix are
// NUMBERED footnotes, not named ones — reindexing renumbers and reorders
// them within the prefix namespace exactly like plain numbered footnotes.
// Only names matching <prefix><digits> count; other prefixes stay named.

describe("reindexFootnotes with a prefix namespace", () => {
    it("renumbers prefixed footnotes by first appearance", () => {
        const input = "b[^2-5] a[^2-2] end\n\n[^2-2]: two\n[^2-5]: five";
        const expected = "b[^2-1] a[^2-2] end\n\n[^2-1]: five\n[^2-2]: two";
        expect(reindexFootnotes(input, { prefix: "2-" })).toBe(expected);
    });

    it("closes gaps within the namespace", () => {
        const input = "a[^2-3] b[^2-9] end\n\n[^2-3]: three\n[^2-9]: nine";
        const expected = "a[^2-1] b[^2-2] end\n\n[^2-1]: three\n[^2-2]: nine";
        expect(reindexFootnotes(input, { prefix: "2-" })).toBe(expected);
    });

    it("keeps plain and prefixed sequences independent", () => {
        const input =
            "x[^5] y[^2-9] end\n\n[^5]: five\n[^2-9]: nine";
        const expected =
            "x[^1] y[^2-1] end\n\n[^1]: five\n[^2-1]: nine";
        expect(reindexFootnotes(input, { prefix: "2-" })).toBe(expected);
    });

    it("leaves names with a DIFFERENT prefix alone", () => {
        const input = "a[^3-1] b[^2-7] end\n\n[^3-1]: other\n[^2-7]: mine";
        const expected = "a[^3-1] b[^2-1] end\n\n[^3-1]: other\n[^2-1]: mine";
        expect(reindexFootnotes(input, { prefix: "2-" })).toBe(expected);
    });

    it("numbers a prefixed orphan after the referenced ones", () => {
        const input = "t[^2-8] end\n\n[^2-8]: used\n[^2-3]: orphan";
        const expected = "t[^2-1] end\n\n[^2-1]: used\n[^2-2]: orphan";
        expect(reindexFootnotes(input, { prefix: "2-" })).toBe(expected);
    });

    it("without the prefix option, prefixed names stay named (unchanged behavior)", () => {
        const text = "b[^2-5] a[^2-2] end\n\n[^2-5]: five\n[^2-2]: two";
        expect(reindexFootnotes(text)).toBe(text);
    });

    it("ignores an invalid prefix defensively", () => {
        const text = "a[^101] end\n\n[^101]: x";
        // digit-ending prefix: treated as no prefix, [^101] is plain numbered
        expect(reindexFootnotes(text, { prefix: "10" })).toBe(
            "a[^1] end\n\n[^1]: x",
        );
    });

    it("matches the prefix case-insensitively but keeps its casing", () => {
        const input = "a[^ch-4] end\n\n[^ch-4]: four";
        const expected = "a[^Ch-1] end\n\n[^Ch-1]: four";
        expect(reindexFootnotes(input, { prefix: "Ch-" })).toBe(expected);
    });
});

describe("lintFootnotes prefix awareness (prefixAware)", () => {
    it("unifies plain and prefixed footnotes into one reading-order sequence", () => {
        // the L11 scenario: plain strays adopt the prefix, then the WHOLE
        // namespace renumbers by appearance — including the pre-existing
        // [^2.5], which is a numbered footnote now, not a named one
        const input =
            "---\nfootnote-prefix: 2.\n---\nb[^2] a[^1] pre[^2.5] end\n\n[^1]: one\n[^2]: two\n[^2.5]: already prefixed";
        const expected =
            "---\nfootnote-prefix: 2.\n---\nb[^2.1] a[^2.2] pre[^2.3] end\n\n[^2.1]: two\n[^2.2]: one\n[^2.3]: already prefixed";
        expect(
            lintFootnotes(input, { applyNotePrefix: true, prefixAware: true }),
        ).toBe(expected);
    });

    it("reorders prefixed footnotes even without the apply step", () => {
        const input =
            "---\nfootnote-prefix: 2.\n---\nb[^2.5] a[^2.2] end\n\n[^2.2]: two\n[^2.5]: five";
        const expected =
            "---\nfootnote-prefix: 2.\n---\nb[^2.1] a[^2.2] end\n\n[^2.1]: five\n[^2.2]: two";
        expect(lintFootnotes(input, { prefixAware: true })).toBe(expected);
    });

    it("without prefixAware, prefixed footnotes keep their old named behavior", () => {
        const input =
            "---\nfootnote-prefix: 2.\n---\nb[^2.5] a[^2.2] end\n\n[^2.2]: two\n[^2.5]: five";
        const expected =
            "---\nfootnote-prefix: 2.\n---\nb[^2.5] a[^2.2] end\n\n[^2.5]: five\n[^2.2]: two";
        expect(lintFootnotes(input, {})).toBe(expected);
    });

    it("is idempotent with everything on", () => {
        const messy =
            "---\nfootnote-prefix: 2.\n---\nc[^9], b[^2.4] a[^1]\n\n[^1]: one\n[^9]: nine\n[^2.4]: pre";
        const options = { applyNotePrefix: true, prefixAware: true };
        const once = lintFootnotes(messy, options);
        expect(lintFootnotes(once, options)).toBe(once);
    });
});
