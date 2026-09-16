// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 5 of 6 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { lineDiffChanges, mapFoldLines } from "../../src/editor/document-diff";
import { lintFootnotes } from "../../src/linting/linter";

// What a user sees: their "## Footnotes" section (or any heading) is folded,
// and a lint rewrites two or more of its lines in one edit — a reindex that
// renumbers adjacent definition lines, say. After the lint the fold has
// shrunk or vanished: lines that were hidden now show, though the section
// has exactly the lines it had before.
//
// Two mechanisms, both in mapFoldLines, both only when one replacement hunk
// covers several whole lines mid-document (an edit reaching EOF is the
// already-pinned bug-diff-fold-eof-replacement):
//
// A. A hunk replacing lines s..e-1 mid-document spans
//    [starts[s], starts[e]-1), so removed() flags every covered line except
//    the last (its next line's start lies inside the edit) as "removed" —
//    but those lines were REPLACED, not removed. A fold ending on such a
//    line is cut back to the line before the hunk, or dropped when that is
//    the heading itself.
// B. For the hunk's LAST covered line removed() reads "not removed", and
//    mapOffset then collapses the fold's end to the hunk's START line. The
//    fold loses every line of the hunk but the first, even when the
//    replacement has exactly as many lines as it replaced.
//
// mapFoldLines' own contract: "a fold whose last line was removed ends on
// the line before the removal" — these lines were REPLACED, not removed.

describe("mapFoldLines when one lint edit replaces several folded lines mid-document", () => {
    it("two folded body lines replaced by two lines keep the fold over both", () => {
        const before = "# H\na\nb\ntail";
        const after = "# H\nx\ny\ntail";
        // the section still has a heading and two body lines; the fold
        // should still cover lines 0-2
        expect(mapFoldLines([{ from: 0, to: 2 }], lineDiffChanges(before, after), before)).toEqual([
            { from: 0, to: 2 },
        ]);
    });

    it("a reindex of two adjacent definition lines under a folded heading keeps the fold over both", () => {
        const before = "body[^2]\n\n## Footnotes\n[^2]: two\n[^1]: one";
        const after = "body[^1]\n\n## Footnotes\n[^1]: two\n[^2]: one";
        expect(mapFoldLines([{ from: 2, to: 4 }], lineDiffChanges(before, after), before)).toEqual([
            { from: 2, to: 4 },
        ]);
    });

    it("the real lint pipeline produces the same failure through the public write-back path", () => {
        const before = "body[^2]\n\n## Footnotes\n[^2]: two\n[^1]: one";
        const after = lintFootnotes(before);
        // the pipeline also separates the heading from the definitions with
        // a blank line, so the section spans lines 2-5 afterwards
        expect(after).toBe("body[^1]\n\n## Footnotes\n\n[^1]: two\n[^2]: one");
        expect(mapFoldLines([{ from: 2, to: 4 }], lineDiffChanges(before, after), before)).toEqual([
            { from: 2, to: 5 },
        ]);
    });

    it("a fold ending on a covered non-last line of the hunk is dropped whole", () => {
        // removed() flags line 1 (its next line's start lies inside the
        // hunk) but NOT line 2 (the hunk stops one char short of line 3):
        // an arbitrary asymmetry, since both lines were replaced alike.
        // A fold that already ended on line 1 — say a previous lint shrunk
        // it there — is dropped outright on the next pass.
        const before = "# H\na\nb\ntail";
        const after = "# H\nx\ny\ntail";
        expect(mapFoldLines([{ from: 0, to: 1 }], lineDiffChanges(before, after), before)).toEqual([
            { from: 0, to: 1 },
        ]);
    });

    it("two folded lines replaced by ONE shrink the fold to the surviving line (contrast pin)", () => {
        const before = "# H\na\nb\ntail";
        const after = "# H\nx\ntail";
        expect(mapFoldLines([{ from: 0, to: 2 }], lineDiffChanges(before, after), before)).toEqual([
            { from: 0, to: 1 },
        ]);
    });

    // spec question: when a replacement adds lines to the section (1 -> 2
    // here), should the fold grow to cover them? The pinned EOF tests
    // establish that it SHRINKS with the section (2 -> 1 ends on the
    // surviving line), so the symmetric reading is that it grows too. The
    // collapse-to-edit-start in mapOffset can only ever keep the old end.
    it("one folded line replaced by two: the fold grows with the section", () => {
        const before = "# H\na\ntail";
        const after = "# H\nx\ny\ntail";
        expect(mapFoldLines([{ from: 0, to: 1 }], lineDiffChanges(before, after), before)).toEqual([
            { from: 0, to: 2 },
        ]);
    });
});
