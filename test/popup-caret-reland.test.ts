import { describe, expect, it } from "vitest";

import { fakeEditor } from "./helpers/fake-editor";

import {
    positionAfterReference,
    referenceOrdinalAtCursor,
} from "../src/commands/create-footnote";

// The popup arm's semantic caret re-land (Jason's report 2026-08-27): the
// pre-popup creation lint's minimal-diff rewrite maps a caret inside its
// changed span to the span's START — the first renumbered footnote — so
// the caret's identity is captured as an occurrence ORDINAL before the
// lint and restored on the (possibly renamed) id afterwards. Same-id
// occurrence order is stable across the lint rules, which is what makes
// the ordinal a durable identity where raw coordinates are not.

describe("referenceOrdinalAtCursor", () => {
    it("identifies the caret's own occurrence among several of the same id", () => {
        const doc = fakeEditor(["a[^1] b[^1] c[^1]", "", "[^1]: one"]);
        // caret immediately after the SECOND [^1] (afterReference parks it there)
        expect(
            referenceOrdinalAtCursor(doc, "1", { line: 0, ch: "a[^1] b[^1]".length }),
        ).toBe(1);
    });

    it("counts the caret INSIDE a reference as that occurrence", () => {
        const doc = fakeEditor(["a[^1] b[^1]", "", "[^1]: one"]);
        expect(
            referenceOrdinalAtCursor(doc, "1", { line: 0, ch: "a[^1] b[^".length }),
        ).toBe(1);
    });

    it("counts occurrences across earlier lines", () => {
        const doc = fakeEditor(["a[^x]", "b[^x] c[^x]", "", "[^x]: body"]);
        expect(
            referenceOrdinalAtCursor(doc, "x", { line: 1, ch: "b[^x] c[^x]".length }),
        ).toBe(2);
    });

    it("falls back to 0 when the caret touches no occurrence", () => {
        const doc = fakeEditor(["a[^1] far away", "", "[^1]: one"]);
        expect(
            referenceOrdinalAtCursor(doc, "1", { line: 0, ch: "a[^1] far".length }),
        ).toBe(0);
    });

    it("skips code-span fakes and matches names case-insensitively", () => {
        const doc = fakeEditor(["`[^Note]` real[^note] here", "", "[^note]: n"]);
        expect(
            referenceOrdinalAtCursor(doc, "Note", {
                line: 0,
                ch: "`[^Note]` real[^note]".length,
            }),
        ).toBe(0);
    });
});

describe("positionAfterReference", () => {
    it("lands just past the ordinal-th occurrence in document order", () => {
        const doc = fakeEditor(["a[^2] b[^2]", "c[^2]", "", "[^2]: two"]);
        expect(positionAfterReference(doc, "2", 2)).toEqual({
            line: 1,
            ch: "c[^2]".length,
        });
    });

    it("never lands on the definition label (it is not a reference)", () => {
        const doc = fakeEditor(["only[^9] one", "", "[^9]: body"]);
        // ordinal 1 would have to be the "[^9]:" label — there is no such occurrence
        expect(positionAfterReference(doc, "9", 1)).toBeNull();
    });

    it("round-trips an ordinal across a lint-style rename", () => {
        // pre-lint: caret after the new [^6], second occurrence of nothing —
        // the only [^6]; post-lint the id is [^2] and everything renumbered
        const before = fakeEditor(["zeta[^5] qu[^6]ick", "", "[^5]: five", "[^6]: "]);
        const ordinal = referenceOrdinalAtCursor(before, "6", {
            line: 0,
            ch: "zeta[^5] qu[^6]".length,
        });
        const after = fakeEditor(["zeta[^1] qu[^2]ick", "", "[^1]: five", "[^2]: "]);
        expect(positionAfterReference(after, "2", ordinal)).toEqual({
            line: 0,
            ch: "zeta[^1] qu[^2]".length,
        });
    });
});
