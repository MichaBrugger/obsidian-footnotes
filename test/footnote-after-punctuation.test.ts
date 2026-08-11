import { describe, expect, it } from "vitest";

import { footnoteAfterPunctuation } from "../src/linting/rules/footnote-after-punctuation";

// Linter's "footnote after punctuation": a reference sitting BEFORE
// punctuation swaps to sit after it ("word[^1]." → "word.[^1]"). Policy
// pinned here:
//   - the punctuation set is . , ; : ! ?
//   - a run of consecutive references moves as one unit across a run of
//     punctuation, in a single application (idempotent)
//   - definition prefixes ("[^x]:" at line start) are never touched, but
//     the definition's content is corrected like any other text
//   - code blocks, inline code, and frontmatter are invisible

describe("footnoteAfterPunctuation", () => {
    it("moves a reference after a period", () => {
        expect(footnoteAfterPunctuation("word[^1].")).toBe("word.[^1]");
    });

    it("moves named references too", () => {
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

    it("moves a run of references as one unit", () => {
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

    it("corrects references inside definition content", () => {
        expect(footnoteAfterPunctuation("[^1]: see also[^2].")).toBe(
            "[^1]: see also.[^2]",
        );
    });

    it("ignores references inside inline code", () => {
        const text = "use `x[^1].` as-is";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    // Bug (2026-08-11 review, both reviewers): the rule's hand-rolled regex
    // didn't know the grammar's exclusions — an escaped "\[^1]" is literal
    // prose per CommonMark, and "^[…]" opens an inline footnote whose
    // bracket belongs to it. Swapping either turns text the user typed on
    // purpose into a live reference (which orphan-deletion then eats) or
    // guts the inline footnote. The swap must see references through
    // referenceOccurrences, the one home of those exclusions.
    it("never moves an escaped literal reference (grammar exclusions)", () => {
        const text = "prose \\[^1]. tail";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    it("never tears the tail reference out of an inline footnote", () => {
        const text = "see ^[^1]. end";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    it("moves the live reference on a line while leaving the escaped one", () => {
        expect(
            footnoteAfterPunctuation("real[^1]. and a literal \\[^1]. end"),
        ).toBe("real.[^1] and a literal \\[^1]. end");
    });

    it("an escaped caret before the bracket is a real reference and still moves", () => {
        // "\^" is a literal caret, so the "[^x]" after it is NOT inline-
        // footnote content — same branch as footnoteReferenceMatches
        expect(footnoteAfterPunctuation("odd \\^[^x]. end")).toBe(
            "odd \\^.[^x] end",
        );
    });

    it("a reference run broken by an escaped reference only moves the live part", () => {
        // the old regex treated "[^2]" inside "\[^2]" as continuing the
        // run; the escaped shape must break it
        const text = "word[^1]\\[^2]. end";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    it("ignores fenced code blocks and frontmatter", () => {
        const text = "---\ntitle: x[^1].\n---\n```\ncode[^2].\n```\nreal[^3].";
        expect(footnoteAfterPunctuation(text)).toBe(
            "---\ntitle: x[^1].\n---\n```\ncode[^2].\n```\nreal.[^3]",
        );
    });

    it("leaves references not followed by punctuation alone", () => {
        const text = "word[^1] and[^2] more";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    it("is idempotent", () => {
        const messy = "a[^1][^2]?! b[^note]... c.[^3]\n\n[^1]: d[^4],";
        const once = footnoteAfterPunctuation(messy);
        expect(footnoteAfterPunctuation(once)).toBe(once);
    });

    it("is idempotent on an interleaved reference/punctuation chain", () => {
        // hunt 2026-07-17: the first pass turns "word[^1].[^2]," into
        // "word.[^1],[^2]"; a second pass must not swap [^1] with the comma
        // that belongs to [^2] and drift the punctuation away from its text
        const doc = "word[^1].[^2],\n\n[^1]: one\n[^2]: two";
        const once = footnoteAfterPunctuation(doc);
        expect(footnoteAfterPunctuation(once)).toBe(once);
    });
});

describe("footnoteAfterPunctuation and single-line HTML comments", () => {
    // found live 2026-07-17: "<!-- [^66]: x -->" had its colon swapped to
    // ":[^66]" — the rule masked inline code but not one-line comments
    it("never touches a reference-colon pair inside a comment", () => {
        const text = "<!-- [^66]: a commented-out definition -->";
        expect(footnoteAfterPunctuation(text)).toBe(text);
    });

    it("still fixes real references on a line that also has a comment", () => {
        const input = "word[^1]. <!-- [^9]: leave me -->";
        const expected = "word.[^1] <!-- [^9]: leave me -->";
        expect(footnoteAfterPunctuation(input)).toBe(expected);
    });
});

// CJK punctuation joins the shared class (Jason, 2026-08-10)
describe("CJK punctuation", () => {
    it("swaps a reference across a CJK full stop", () => {
        expect(footnoteAfterPunctuation("中文[^1]。")).toBe("中文。[^1]");
    });

    it("a reference already after CJK punctuation is settled", () => {
        const doc = "中文。[^1] more";
        expect(footnoteAfterPunctuation(doc)).toBe(doc);
    });

    it("mixed ASCII and CJK punctuation swap as one run", () => {
        expect(footnoteAfterPunctuation("wait[^1]？!")).toBe("wait？![^1]");
    });
});
