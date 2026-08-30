import { describe, expect, it } from "vitest";

import { listExistingFootnoteDefinitions } from "../../src/editor/doc-context";
import { computeNextFootnoteNumber } from "../../src/parsing/footnote-grammar";
import { footnoteAfterPunctuation } from "../../src/linting/rules/footnote-after-punctuation";
import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

import { fakeEditor } from "../helpers/fake-editor";

// BUG: the opener/closer lines of a multi-line HTML comment are protected
// whole-line, so live text before "<!--" or after "-->" is invisible:
// computeNextFootnoteNumber misses references there, and reindex renumbers the
// definitions but not those references (pairing severed).
// Hunt: 2026-08-09. Lens: contexts.
// Root cause: protectedLines marks the whole boundary line protected.

describe("fixed 2026-08-10: multi-line comment boundary lines keep live text live", () => {
    it("a reference before an inline comment opener still counts", () => {
        expect(
            computeNextFootnoteNumber("a[^7] <!-- draft\n--> done[^6]"),
        ).toBe(8);
    });

    it("a reference after an inline comment closer still counts", () => {
        expect(
            computeNextFootnoteNumber("a <!-- draft\n--> done[^7]"),
        ).toBe(8);
    });

    it(
        "reindex renumbers references and definitions consistently across comment boundary lines",
        () => {
            const input = "x[^9] <!-- hidden\n--> y[^8]\n\n[^8]: eight\n[^9]: nine";
            // the definitions also REORDER to appearance order ([^9] is
            // used first), matching reindex's pinned policy - the hunt's
            // original expectation kept them in place, which contradicted it
            const expected =
                "x[^1] <!-- hidden\n--> y[^2]\n\n[^1]: nine\n[^2]: eight";
            expect(reindexFootnotes(input)).toBe(expected);
        },
    );

    it("punctuation swap still applies before an inline comment opener", () => {
        expect(footnoteAfterPunctuation("a[^1]. <!-- draft\n--> b")).toBe(
            "a.[^1] <!-- draft\n--> b",
        );
    });

    it("autonumbering sees a reference sitting before the comment opener", () => {
        const doc = "a [^5] <!-- draft\nstill comment\n--> done";
        expect(computeNextFootnoteNumber(doc)).toBe(6);
    });

    it("a definition whose body opens a comment is still a definition", () => {
        const lines = ["text [^5]", "", "[^5]: body <!-- open", "cont -->"];
        expect(listExistingFootnoteDefinitions(fakeEditor(lines))).toEqual(["5"]);
    });
});
