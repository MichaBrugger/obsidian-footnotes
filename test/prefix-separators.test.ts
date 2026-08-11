import { describe, expect, it } from "vitest";

import {
    computeNextFootnoteNumber,
    footnotePrefix,
    footnotePrefixProblem,
} from "../src/insert-or-navigate-footnotes";
import { countEmptyFootnoteReferences, lintFootnotes } from "../src/linting/linter";
import { applyFootnotePrefix } from "../src/linting/rules/apply-footnote-prefix";
import { reindexFootnotes } from "../src/linting/rules/re-index-footnotes";

// Standing test convention (Jason, 2026-08-08): prefixes are not always
// "2." — exercise other logical separators too. The dot is the friendly
// case; dashes, tildes, equals, underscores, and especially regex-special
// characters (*, +, $) stress the escaping and string-matching paths that
// "2." never touches. Every core prefix behavior runs across the whole
// set.

const PREFIXES = ["2.", "2-", "2~", "3=", "4_", "ch2*", "n5+", "a$"];

describe.each(PREFIXES)('prefix "%s"', (prefix) => {
    it("is a valid footnote prefix", () => {
        expect(footnotePrefixProblem(prefix)).toBeNull();
    });

    it("parses back out of frontmatter", () => {
        const note = `---\nfootnote-prefix: ${prefix}\n---\nbody`;
        expect(footnotePrefix(note)).toBe(prefix);
    });

    it("autonumbering counts only its own namespace (regex escaping)", () => {
        const note = `a[^${prefix}1] b[^${prefix}7] plain[^9] other[^x.3]`;
        expect(computeNextFootnoteNumber(note, prefix)).toBe(8);
    });

    it("apply-prefix converts plain and named footnotes", () => {
        const note = `a[^1] n[^note] end\n\n[^1]: one\n[^note]: named`;
        const result = applyFootnotePrefix(note, prefix);
        expect(result).toContain(`a[^${prefix}1]`);
        expect(result).toContain(`n[^${prefix}note]`);
    });

    it("prefix-aware reindexing renumbers within the namespace", () => {
        const note = [
            `b[^${prefix}9] a[^${prefix}4] end`,
            "",
            `[^${prefix}4]: four`,
            `[^${prefix}9]: nine`,
        ].join("\n");
        const result = reindexFootnotes(note, { prefix });
        expect(result).toContain(`b[^${prefix}1] a[^${prefix}2] end`);
    });

    it("one lint converges end to end from the frontmatter property", () => {
        const note = [
            "---",
            `footnote-prefix: ${prefix}`,
            "---",
            `late[^${prefix}9] plain[^1] early[^${prefix}4] end`,
            "",
            `[^${prefix}4]: four`,
            "[^1]: plain one",
            `[^${prefix}9]: nine`,
        ].join("\n");
        const once = lintFootnotes(note, { applyNotePrefix: true });
        // apply-prefix slots the plain footnote after the existing maximum,
        // then the prefix-aware reindex renumbers the whole namespace by
        // appearance order: 1, 2, 3 left to right
        expect(once).toContain(
            `late[^${prefix}1] plain[^${prefix}2] early[^${prefix}3] end`,
        );
        // idempotent: a second lint changes nothing
        expect(lintFootnotes(once, { applyNotePrefix: true })).toBe(once);
    });

    it("the bare-prefix placeholder counts as an unnamed reference", () => {
        expect(countEmptyFootnoteReferences(`a [^${prefix}] b [^]`, prefix)).toBe(2);
    });
});
