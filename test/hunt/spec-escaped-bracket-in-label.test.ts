import { describe, expect, it } from "vitest";

import { removeOrphanedFootnoteReferences } from "../../src/linting/rules/remove-orphaned-references";

// spec question: how should a backslash-escaped "]" inside a footnote name
// be read, as in the line "[^a\\]b]: body"?
//
// Reading one, the CommonMark reading: a label may hold an escaped "]", and
// the escape is consumed as part of the name. micromark's label factory does
// exactly this, so the line is one definition whose name is "a\]b". Obsidian
// builds on the same family of parsers, but its actual behaviour here has
// not been checked in a live note, so this stays a question rather than a
// verdict.
//
// Reading two, the simpler reading the plugin uses: a name is one or more
// characters that are neither whitespace nor "]", so the first "]" closes a
// reference named "a\", and the rest of the line, "b]: body", is plain text.
//
// What the user would see today: the line is read as an orphaned reference
// named "a\", so with "Delete orphaned references" on, the lint cuts "[^a\]"
// out of the middle of the line and leaves "b]: body" sitting there. Under
// EITHER reading that is wrong. Reading one says the line is a definition
// and orphaned-reference deletion should not touch it at all; reading two
// says the surrounding text is prose, and the plugin's own policy is that
// prose is never destroyed. So the line must come back unchanged whichever
// way the question is settled.
//
// Hunt: 2026-09-13. Lens: grammar.
//
// Source of truth: micromark-factory-label (the label factory shared by the
// GFM footnote extension, micromark-extension-gfm-footnote 2.1.0) consumes a
// backslash escape inside a label; the plugin's own policy in
// src/linting/rules/remove-orphaned-references.ts that a deletion must never
// destroy ordinary prose.

describe("spec question: an escaped ] inside a label", () => {
    it.fails("orphan deletion does not chop a [^a\\]b]: line in half", () => {
        const before = "Alpha.\n\n[^a\\]b]: body\n";
        expect(removeOrphanedFootnoteReferences(before)).toBe(before);
    });
});
