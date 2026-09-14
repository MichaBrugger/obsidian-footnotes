// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { applyFootnotePrefix } from "../../src/linting/rules/apply-footnote-prefix";

// What a user would see: with footnote-prefix "p." set, running the lint
// turns their "[^note]" reference into "[^p.note]", which now resolves to a
// blockquoted definition that used to be a DIFFERENT footnote. Two footnotes
// silently merged into one.
//
// The rule's own contract (apply-footnote-prefix.ts): "The exception is when
// that prefixed name is already some other footnote in the note, because the
// rename would then quietly merge two footnotes into one; such a name is
// left alone." A label inside a blockquote ("> [^p.note]: ...") IS a real
// definition everywhere else in the plugin (C22: orphan rules, reindex,
// rename, navigation all count it), but the collision guard here collects
// names only from references and column-0 definition BLOCKS, so a name that
// exists only as a quoted definition is invisible to it.

describe("apply-prefix collision guard vs quoted definitions", () => {
    it.fails("does not rename a reference onto a name a blockquoted definition already owns", () => {
        const input = "text[^note] here\n\n> [^p.note]: quoted definition";
        const out = applyFootnotePrefix(input, "p.");
        // "p.note" is taken by the quoted definition, so "note" must be
        // left alone, exactly as it is when the colliding definition sits
        // at column 0 (pinned below for contrast)
        expect(out).toBe(input);
    });

    it("the column-0 twin of the same collision IS left alone (contrast pin)", () => {
        const input = "text[^note] here\n\n[^p.note]: plain definition";
        const out = applyFootnotePrefix(input, "p.");
        expect(out).toBe(input);
    });

    it.fails("two quoted definitions of different names stay different", () => {
        const input = "> [^note]: one\n\n> [^p.note]: two";
        const out = applyFootnotePrefix(input, "p.");
        expect(out).toBe(input);
    });
});
