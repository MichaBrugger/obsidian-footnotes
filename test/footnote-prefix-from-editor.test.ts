import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import { footnotePrefix, footnotePrefixFromEditor } from "../src/parsing/footnote-prefix";

import { fakeEditor } from "./helpers/fake-editor";

// Perf helper (2026-08-07): footnotePrefixFromEditor reads only the
// frontmatter block through the editor line API, replacing the per-press
// doc.getValue() the guards used to make. It must agree with the
// string-based footnotePrefix on every note shape.
//
// fakeEditor is built WITHOUT `wholeDoc` here on purpose: it disables
// getValue(), so this suite proves footnotePrefixFromEditor never falls back
// to reading the whole document - the exact perf contract this helper
// exists to enforce.

describe("footnotePrefixFromEditor", () => {
    const cases: string[][] = [
        [["---", "footnote-prefix: 2.", "---", "body"], []],
        [["---", 'footnote-prefix: "5."', "---", "body"], []],
        [["---", "title: x", "...", "body"], []],
        [["no frontmatter", "footnote-prefix: 9."], []],
        [["---", "unclosed frontmatter", "footnote-prefix: 3."], []],
        [["---\r", "footnote-prefix: 4.\r", "---\r", "crlf body"], []],
    ].map(([lines]) => lines);

    it("matches footnotePrefix on every note shape", () => {
        for (const lines of cases) {
            expect(footnotePrefixFromEditor(fakeEditor(lines))).toBe(
                footnotePrefix(lines.join("\n")),
            );
        }
    });

    it("reads the prefix without touching lines past the frontmatter", () => {
        const lines = ["---", "footnote-prefix: 2.", "---", "body"];
        let deepestRead = -1;
        const doc = {
            getLine: (n: number) => {
                deepestRead = Math.max(deepestRead, n);
                return lines[n];
            },
            lineCount: () => lines.length,
        } as unknown as Editor;
        expect(footnotePrefixFromEditor(doc)).toBe("2.");
        // the closing fence is line 2; the body must never be read
        expect(deepestRead).toBe(2);
    });
});
