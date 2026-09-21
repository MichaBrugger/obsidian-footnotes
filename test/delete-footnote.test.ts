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

    it("deletes EVERY reference of a footnote cited twice (core's delete leaves the second one dangling)", () => {
        expect(del(["a[^n] b[^n] c", "", "[^n]: n"], "n")).toEqual({
            kind: "deleted",
            markdown: "a b c",
            references: 2,
            definitions: 1,
        });
    });

    it("matches the name without regard to case, as Obsidian does", () => {
        expect(del(["see [^Note] here", "", "[^note]: n"], "NOTE")).toMatchObject({
            kind: "deleted",
            markdown: "see here",
        });
    });

    it("leaves copies inside a code fence and a code span alone: they are plain text", () => {
        expect(del(["real[^x] and `[^x]` inline", "```", "fake [^x]", "```", "", "[^x]: x"], "x")).toEqual({
            kind: "deleted",
            markdown: "real and `[^x]` inline\n```\nfake [^x]\n```",
            references: 1,
            definitions: 1,
        });
    });

    it("reports nothing to delete for a name the note does not use", () => {
        expect(del(["prose[^1]", "", "[^1]: one"], "2")).toEqual({ kind: "nothing" });
    });

    it("cuts a reference that sits inside ANOTHER definition's body", () => {
        expect(del(["a[^a]", "", "[^a]: see[^b]", "[^b]: b"], "b")).toEqual({
            kind: "deleted",
            markdown: "a[^a]\n\n[^a]: see",
            references: 1,
            definitions: 1,
        });
    });

    it("takes a definition's whole body, continuation lines and blank gaps included, and does not count references inside it", () => {
        expect(del(["t[^m]", "", "[^m]: first[^m]", "    second", "", "    third[^m]", "", "after"], "m")).toEqual({
            kind: "deleted",
            markdown: "t\n\nafter",
            references: 1,
            definitions: 1,
        });
    });

    it("keeps Windows line endings", () => {
        expect(deleteFootnoteEverywhere("p[^1] q\r\nkeep\r\n\r\n[^1]: one", "1")).toMatchObject({
            kind: "deleted",
            markdown: "p q\r\nkeep",
        });
    });

    it("removes a definition written inside a blockquote together with its quoted continuation", () => {
        expect(del(["p[^q]", "", "> [^q]: quoted", "> more of it", "", "tail"], "q")).toEqual({
            kind: "deleted",
            markdown: "p\n\ntail",
            references: 1,
            definitions: 1,
        });
    });

    it("refuses a definition whose line closes a %% comment, since cutting the line would leave the comment open", () => {
        const plan = del(["p[^c] q", "", "%%", "hidden", "%% [^c]: after the closer"], "c");
        expect(plan.kind).toBe("refused");
        if (plan.kind !== "refused") throw new Error("unreachable");
        expect(plan.reason).toContain('"[^c]:"');
        expect(plan.reason).toContain("%%");
    });
});
