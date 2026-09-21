import { describe, expect, it } from "vitest";

import { deleteFootnoteEverywhere } from "../src/commands/delete-footnote";

// Deleting a footnote everywhere (T4, Jason's rulings 2026-09-19 to 21):
// the definition and EVERY reference to it go in one step, whichever end
// the caret was on. Obsidian's own right-click "Delete footnote and
// reference" removes only the one reference clicked, so a footnote cited
// twice keeps a dangling reference (Jason's report 2026-09-19). The
// transform probed here is pure markdown-to-markdown; the command is thin
// wiring over it.

function del(lines: string[], name: string) {
    return deleteFootnoteEverywhere(lines.join("\n"), name);
}

describe("deleteFootnoteEverywhere", () => {
    it("removes the reference and the definition and closes the gap", () => {
        expect(del(["prose[^1] more", "", "[^1]: one"], "1")).toEqual({
            kind: "deleted",
            markdown: "prose more",
            references: 1,
            definitions: 1,
        });
    });
});
