// Imported from the Kimi K3 cycle 4 hunt of 2026-09-16 (OpenCode worktree); 3 of 5 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { beforeEach, describe, expect, it } from "vitest";

import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

import { countEmptyFootnoteReferences, noticeLintAlerts } from "../../src/linting/lint-alerts";

// The unnamed-reference alert counts "[^]" occurrences on the masked lines
// by a plain indexOf. An inline footnote's body is ordinary text, so a
// "[^]" written INSIDE one is counted too - even though every other reader
// in the plugin knows that text is the inline footnote's body:
// footnoteReferenceMatches skips a "[^…]" sitting after a "^["
// (bug-inline-footnote-double-parse: "^[^literal]" is inline-footnote
// text, not a reference), and inlineFootnoteSpanAt carves the span out.
//
// Two shapes fire the false alert. "^[^]" is a complete inline footnote
// with the single character "^" as its body (Reading view renders it);
// the "[^]" at its heart is counted as an abandoned placeholder. And
// "^[see [^] here]" is a complete inline footnote whose balanced "[^]"
// renders as literal text. Neither is an unnamed reference the user left
// behind, and nothing the user can write - short of never using these
// bodies - makes the alert go away. It fires on every lint, forever.
//
// What the user sees: "This note has an unnamed footnote reference
// ("[^]"). Give it a name or delete it." after every lint, pointing at a
// live inline footnote. A false alert trains them to ignore the real one.
// The never-silent policy (ADR-0002) speaks for REAL placeholders; a cry
// of wolf is its own kind of wrong.
//
// Source of truth: the plugin's own reference grammar (the "^[" exclusion
// in footnoteReferenceMatches, src/parsing/footnote-grammar.ts) + Obsidian
// rendering "^[^]" as an inline footnote with body "^".
//
// Settings involved: none - the unnamed-reference alert always speaks.

describe("the unnamed-reference alert inside inline footnote bodies", () => {
    beforeEach(resetNotices);

    it("a '^[^]' inline footnote (body is a single caret) counts no placeholder", () => {
        expect(countEmptyFootnoteReferences("note ^[^] here")).toBe(0);
    });

    it("a '[^]' inside a longer inline footnote body counts no placeholder", () => {
        expect(countEmptyFootnoteReferences("note ^[see [^] here] done")).toBe(0);
    });

    it("control: a real abandoned [^] counts", () => {
        expect(countEmptyFootnoteReferences("note [^] here")).toBe(1);
    });

    it("control: a [^] inside a code span does not count (masked)", () => {
        expect(countEmptyFootnoteReferences("note `[^]` here")).toBe(0);
    });

    it("the lint shows no unnamed-reference alert for the inline shapes", () => {
        noticeLintAlerts(fakePlugin({}), "note ^[^] here");
        expect(messages().some((m) => m.includes("unnamed footnote reference"))).toBe(false);
    });
});
