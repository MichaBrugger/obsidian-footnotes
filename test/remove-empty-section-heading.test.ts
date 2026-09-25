import { describe, expect, it } from "vitest";

import { deleteFootnote } from "../src/commands/delete-footnote";
import { convertNormalToInlineCommand } from "../src/commands/convert-footnotes";
import { lintFootnotes } from "../src/linting/linter";
import { removeEmptySectionHeading } from "../src/linting/rules/remove-empty-section-heading";
import { fakeEditor } from "./helpers/fake-editor";
import { fakePlugin } from "./helpers/fake-plugin";
import { resetNotices } from "./helpers/notices";

// Jason's ask, 2026-09-25: when a plugin action leaves nothing under the
// footnote section heading, an option removes the heading too. Off by
// default, since templates carry a References heading that should stay
// even while empty; quick writers turn it on. One rule, applied after the
// normal-to-inline conversion, Delete footnote everywhere, and the lint.

describe("removeEmptySectionHeading: the pure rule", () => {
    it("removes the heading, and the blank run above it, when nothing but blank lines follows", () => {
        expect(removeEmptySectionHeading("Body text.\n\n# Footnotes\n\n", "# Footnotes")).toBe("Body text.");
        expect(removeEmptySectionHeading("Body text.\n\n# Footnotes", "# Footnotes")).toBe("Body text.");
    });

    it("leaves a heading that still has a definition under it", () => {
        const note = "Body[^1].\n\n# Footnotes\n\n[^1]: one";
        expect(removeEmptySectionHeading(note, "# Footnotes")).toBe(note);
    });

    it("leaves a heading that prose or another heading follows: that is not a footnote section", () => {
        const note = "Body.\n\n# Footnotes\n\nNot a footnote.\n";
        expect(removeEmptySectionHeading(note, "# Footnotes")).toBe(note);
        const next = "Body.\n\n# Footnotes\n\n# Next section\n";
        expect(removeEmptySectionHeading(next, "# Footnotes")).toBe(next);
    });

    it("does nothing without a configured heading, or when the note has none", () => {
        expect(removeEmptySectionHeading("Body.\n\n# Footnotes\n", "")).toBe("Body.\n\n# Footnotes\n");
        expect(removeEmptySectionHeading("Body.\n", "# Footnotes")).toBe("Body.\n");
    });

    it("removes a multi-line heading whole, divider included", () => {
        expect(removeEmptySectionHeading("Body.\n\n---\n## Notes\n", "---\n## Notes")).toBe("Body.");
    });

    it("ignores a look-alike heading inside a code fence", () => {
        const note = "Body.\n\n```\n# Footnotes\n```\n";
        expect(removeEmptySectionHeading(note, "# Footnotes")).toBe(note);
    });

    it("keeps the note's own line endings", () => {
        expect(removeEmptySectionHeading("Body.\r\n\r\n# Footnotes\r\n", "# Footnotes")).toBe("Body.");
        expect(removeEmptySectionHeading("A.\r\nB.\r\n\r\n# Footnotes\r\n", "# Footnotes")).toBe("A.\r\nB.");
    });
});

describe("the rule follows the Remove empty section heading setting", () => {
    it("lint: with the option on, the heading goes once the last orphaned definition is deleted; off, it stays", () => {
        const note = "Body.\n\n# Footnotes\n\n[^1]: orphan";
        const on = lintFootnotes(note, { sectionHeading: "# Footnotes", removeOrphanedDefinitions: true, removeEmptySectionHeading: true });
        expect(on).toBe("Body.");
        const off = lintFootnotes(note, { sectionHeading: "# Footnotes", removeOrphanedDefinitions: true });
        expect(off).toBe("Body.\n\n# Footnotes");
    });

    it("Delete footnote everywhere: the heading goes with the last footnote when the setting is on", async () => {
        resetNotices();
        const doc = fakeEditor(["a[^n] b", "", "# Footnotes", "", "[^n]: n"], {
            wholeDoc: true,
            edits: true,
            cursor: { line: 0, ch: 3 },
            selection: { anchor: { line: 0, ch: 3 }, head: { line: 0, ch: 3 } },
        });
        await deleteFootnote(fakePlugin({ enableFootnoteSectionHeading: true, footnoteSectionHeading: "# Footnotes", removeEmptySectionHeading: true }, doc));
        expect(doc.lines).toEqual(["a b"]);
    });

    it("Delete footnote everywhere: the heading stays by default", async () => {
        resetNotices();
        const doc = fakeEditor(["a[^n] b", "", "# Footnotes", "", "[^n]: n"], {
            wholeDoc: true,
            edits: true,
            cursor: { line: 0, ch: 3 },
            selection: { anchor: { line: 0, ch: 3 }, head: { line: 0, ch: 3 } },
        });
        await deleteFootnote(fakePlugin({ enableFootnoteSectionHeading: true, footnoteSectionHeading: "# Footnotes" }, doc));
        expect(doc.lines).toEqual(["a b", "", "# Footnotes"]);
    });

    it("Convert normal footnotes to inline footnotes: the heading goes when every definition became inline", async () => {
        resetNotices();
        const doc = fakeEditor(["a[^n] b", "", "# Footnotes", "", "[^n]: n"], {
            wholeDoc: true,
            edits: true,
            cursor: { line: 0, ch: 0 },
            selection: { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } },
        });
        await convertNormalToInlineCommand(fakePlugin({ enableFootnoteSectionHeading: true, footnoteSectionHeading: "# Footnotes", removeEmptySectionHeading: true }, doc));
        expect(doc.lines).toEqual(["a^[n] b"]);
    });
});
