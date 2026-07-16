import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import {
    isValidFootnoteName,
    shouldCreateMatchingFootnoteDetail,
} from "../src/insert-or-navigate-footnotes";
import type FootnotePlugin from "../src/main";

// Regression (reported 2026-07-14): footnote names containing spaces are a
// common authoring mistake that Obsidian won't render. Instead of silently
// creating a broken detail for them, the plugin warns the user.

describe("isValidFootnoteName", () => {
    it("accepts alphanumeric names", () => {
        expect(isValidFootnoteName("note")).toBe(true);
        expect(isValidFootnoteName("12")).toBe(true);
    });

    it("accepts dashes and underscores", () => {
        expect(isValidFootnoteName("my-note")).toBe(true);
        expect(isValidFootnoteName("my_note")).toBe(true);
    });

    it("rejects names containing spaces", () => {
        expect(isValidFootnoteName("my note")).toBe(false);
    });

    it("rejects other whitespace too", () => {
        expect(isValidFootnoteName("a\tb")).toBe(false);
    });
});

describe("shouldCreateMatchingFootnoteDetail with an invalid name", () => {
    it("warns and stops instead of creating a detail", () => {
        const line = "alpha[^my note] bravo";
        const doc = {
            getLine: () => line,
            lineCount: () => 1,
        } as unknown as Editor;

        // returning true consumes the hotkey press; the fake editor has no
        // transaction method, so reaching the creation path would throw
        const handled = shouldCreateMatchingFootnoteDetail(
            line,
            { line: 0, ch: 7 }, // cursor inside [^my note]
            {} as FootnotePlugin,
            doc,
        );
        expect(handled).toBe(true);
    });
});
