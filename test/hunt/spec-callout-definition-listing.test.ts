import { Editor } from "obsidian";
import { describe, expect, it } from "vitest";

import { listExistingFootnoteDefinitions } from "../../src/insert-or-navigate-footnotes";

// spec question: does Obsidian treat a definition inside a callout/blockquote
// ("> [^1]: def") as live? (Same Obsidian-semantics question as
// spec-blockquoted-definition-punctuation.)
// Hunt: 2026-08-09. Lens: contexts.
// listExistingFootnoteDefinitions anchors DefinitionStart at column 0, so it
// can't see the callout definition and the hotkey on "> body[^1]" would
// append a duplicate definition; a user working inside the callout would
// expect the existing one to be found and reused.

function fakeEditor(lines: string[]) {
    return {
        getLine: (n: number) => lines[n] ?? "",
        getValue: () => lines.join("\n"),
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
    } as unknown as Editor;
}

describe("spec question: definition listing vs. callouts", () => {
    it.fails("a definition inside a callout is listed", () => {
        expect(
            listExistingFootnoteDefinitions(
                fakeEditor(["> [!note]", "> body[^1]", "> [^1]: def"]),
            ),
        ).toEqual(["1"]);
    });
});
