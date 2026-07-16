import { describe, expect, it } from "vitest";

import { footnoteAfterPunctuation } from "../src/footnote-after-punctuation";

// Linter's "footnote after punctuation": a marker sitting BEFORE
// punctuation swaps to sit after it ("word[^1]." → "word.[^1]"). Policy
// pinned here:
//   - the punctuation set is . , ; : ! ?
//   - a run of consecutive markers moves as one unit across a run of
//     punctuation, in a single application (idempotent)
//   - definition prefixes ("[^x]:" at line start) are never touched, but
//     the definition's content is corrected like any other text
//   - code blocks, inline code, and frontmatter are invisible

describe("footnoteAfterPunctuation", () => {
    it("moves a marker after a period", () => {
        expect(footnoteAfterPunctuation("word[^1].")).toBe("word.[^1]");
    });

    it("moves named markers too", () => {
        expect(footnoteAfterPunctuation("word[^note],")).toBe("word,[^note]");
    });

    it("leaves an already-correct document unchanged", () => {
        const text = "word.[^1] and more,[^2]\n\n[^1]: one\n[^2]: two";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    it("handles every punctuation mark in the set", () => {
        expect(footnoteAfterPunctuation("a[^1]. b[^2], c[^3]; d[^4]: e[^5]! f[^6]?"))
            .toBe("a.[^1] b,[^2] c;[^3] d:[^4] e![^5] f?[^6]");
    });

    it("moves a run of markers as one unit", () => {
        expect(footnoteAfterPunctuation("word[^1][^2].")).toBe(
            "word.[^1][^2]",
        );
    });

    it("crosses a run of punctuation in one pass", () => {
        expect(footnoteAfterPunctuation("wait[^1]?!")).toBe("wait?![^1]");
        expect(footnoteAfterPunctuation("so[^1]...")).toBe("so...[^1]");
    });

    it("never touches a definition prefix", () => {
        const text = "[^1]: the definition text";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    it("corrects markers inside definition content", () => {
        expect(footnoteAfterPunctuation("[^1]: see also[^2].")).toBe(
            "[^1]: see also.[^2]",
        );
    });

    it("ignores markers inside inline code", () => {
        const text = "use `x[^1].` as-is";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    it("ignores fenced code blocks and frontmatter", () => {
        const text = "---\ntitle: x[^1].\n---\n```\ncode[^2].\n```\nreal[^3].";
        expect(footnoteAfterPunctuation(text)).toBe(
            "---\ntitle: x[^1].\n---\n```\ncode[^2].\n```\nreal.[^3]",
        );
    });

    it("leaves markers not followed by punctuation alone", () => {
        const text = "word[^1] and[^2] more";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    it("is idempotent", () => {
        const messy = "a[^1][^2]?! b[^note]... c.[^3]\n\n[^1]: d[^4],";
        const once = footnoteAfterPunctuation(messy);
        expect(footnoteAfterPunctuation(once)).toBe(once);
    });
});
