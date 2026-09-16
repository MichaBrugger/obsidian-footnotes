// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { lineDiffChanges, mapFoldLines } from "../../src/editor/document-diff";

// What a user sees: a folded section reaches the end of the note, and a lint
// rewrites the section's last line(s). After the lint the fold is gone or has
// shrunk, even though the section is still there with the same heading and
// still has body lines. mapFoldLines' removed() test treats an edit covering
// [line start, end of note) as "the line was removed", but that is also the
// shape of a whole-line REPLACEMENT at EOF (the last line has no trailing
// newline to spare it). The same replacement one line higher keeps the fold.
//
// mapFoldLines' own contract: "a fold whose last line was removed ends on the
// line before the removal" - these lines were REPLACED, not removed.

describe("mapFoldLines when a lint rewrites the folded section's last line at EOF", () => {
    it("a wholesale replacement of the fold's last line keeps the fold over the same lines", () => {
        const before = "# H\nfoo\nbar";
        const after = "# H\nfoo\nBAZ";
        // the section still has three lines; the fold should still cover them
        expect(mapFoldLines([{ from: 0, to: 2 }], lineDiffChanges(before, after), before)).toEqual([
            { from: 0, to: 2 },
        ]);
    });

    it("the same replacement one line higher keeps the fold (contrast pin)", () => {
        const before = "# H\nfoo\nbar\ntail";
        const after = "# H\nfoo\nBAZ\ntail";
        expect(mapFoldLines([{ from: 0, to: 2 }], lineDiffChanges(before, after), before)).toEqual([
            { from: 0, to: 2 },
        ]);
    });

    it("two folded body lines rewritten into one at EOF shrink the fold to the surviving line, not to nothing", () => {
        const before = "# H\na\nb";
        const after = "# H\nc";
        // the section still has a body line; the fold should cover it
        expect(mapFoldLines([{ from: 0, to: 2 }], lineDiffChanges(before, after), before)).toEqual([
            { from: 0, to: 1 },
        ]);
    });
});
