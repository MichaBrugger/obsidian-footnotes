import { describe, expect, it } from "vitest";

import { lintFootnotes } from "../../src/linting/linter";

// BUG: with a note prefix of "2." and the Apply-footnote-prefix lint rule
// on, an orphaned NUMBERED definition inside a blockquote
// ("> [^5]: an orphan inside a quote") does not adopt the prefix, and
// reindex then renumbers it into the plain namespace as "> [^1]:".
//
// What the user would see: every other footnote in the note comes out of
// the lint as [^2.1], [^2.2] and so on, while the quoted one comes out as
// a bare [^1], sitting outside the namespace the whole note is supposed to
// share. That bare [^1] is exactly the collision the prefix feature exists
// to prevent: merge this chapter with another and the two [^1] footnotes
// are one footnote. Nothing warns about it, and the note settles in that
// state, so a second lint will not repair it either.
//
// Hunt: 2026-09-13. Lens: interactions.
//
// Source of truth:
//   - the C22 ruling (Jason, 2026-08-10) recorded in
//     test/blockquote-definitions.test.ts: a "> [^1]: def" label is a live
//     definition, not decoration.
//   - README around line 158, and manual-test sheet 15: every plain
//     footnote adopts the prefix and the whole namespace renumbers.
//   - the rule's own contract: plain numbered footnotes are converted "in
//     the order they first appear: references first, then any orphaned
//     definitions".
//
// Cause: the rule's `order` walk picks up references line by line, then
// collects the orphans from view.blocks. A quoted label forms no block
// (findDefinitionBlocks skips it), so a quoted orphan never reaches
// `order` and never gets a prefixed number. A quoted definition that HAS a
// reference is fine, because its name arrives through the reference walk
// instead. A NAMED quoted orphan is fine too, because named footnotes are
// renamed wherever their text appears rather than through `order`.

const prefixed = {
    fixPunctuation: true,
    fixLazyDefinitions: true,
    moveDefinitionsToBottom: true,
    reindex: true,
    applyNotePrefix: true,
};

const noteWith = (label: string) =>
    [
        "---",
        "footnote-prefix: 2.",
        "---",
        "",
        "prose with no reference",
        "",
        label,
    ].join("\n");

describe("apply-prefix and an orphaned numbered definition inside a blockquote", () => {
    it.fails("the quoted orphan adopts the note's prefix like any other number", () => {
        const after = lintFootnotes(
            noteWith("> [^5]: an orphan inside a quote"),
            prefixed,
        );
        expect(after).toContain("> [^2.1]: an orphan inside a quote");
        // and it must not be left numbered in the plain namespace, where it
        // collides with the next chapter's [^1]
        expect(after).not.toContain("> [^1]:");
    });

    it("a NAMED quoted orphan does adopt the prefix", () => {
        const after = lintFootnotes(
            noteWith("> [^note]: a named orphan inside a quote"),
            prefixed,
        );
        expect(after).toContain("> [^2.note]: a named orphan inside a quote");
    });

    it("a two-space-indented numbered orphan does adopt the prefix", () => {
        // the same footnote one step away from a blockquote: indented
        // labels DO form a definition block, so this one is found
        const after = lintFootnotes(
            noteWith("  [^5]: an indented orphan"),
            prefixed,
        );
        expect(after).toContain("  [^2.1]: an indented orphan");
    });

    it("a quoted definition that HAS a reference adopts the prefix", () => {
        // proof that it is the orphan path specifically: this one arrives
        // through the reference walk instead of through the blocks
        const doc = [
            "---",
            "footnote-prefix: 2.",
            "---",
            "",
            "see[^5] here",
            "",
            "> [^5]: inside a quote",
        ].join("\n");
        const after = lintFootnotes(doc, prefixed);
        expect(after).toContain("see[^2.1] here");
        expect(after).toContain("> [^2.1]: inside a quote");
    });
});
