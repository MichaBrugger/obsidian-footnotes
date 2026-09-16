// Imported from the Kimi K3 cycle 1 hunt of 2026-09-16 (OpenCode worktree); 2 of 5 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { beforeEach, describe, expect, it } from "vitest";

import { fakePlugin } from "../helpers/fake-plugin";
import { messages, resetNotices } from "../helpers/notices";

import { countEmptyFootnoteReferences, noticeLintAlerts } from "../../src/linting/lint-alerts";

// The unnamed-reference alert counts "[^]" by plain substring search on
// the masked twin. Masking blots code, comments, and math, but NOT
// backslash escapes - so an escaped "\[^]", which Obsidian renders as the
// literal characters "[^]" (CommonMark: a backslash before "[" makes it
// ordinary text), is counted as an abandoned placeholder. Everywhere
// else the plugin reads escapes: footnoteReferenceMatches skips "\[^x]"
// (bug-escaped-marker), computeNextFootnoteNumber skips it, the creation
// guards skip it. Only this alert disagrees.
//
// What the user sees: they wrote about footnote syntax in their note
// (escaped, on purpose, so it renders literally), and every lint nags
// them that "This note has an unnamed footnote reference ([^]). Give it
// a name or delete it." There is nothing to name or delete.
//
// Source of truth: CommonMark's backslash-escape rule as already adopted
// by the plugin itself (footnote-grammar.ts: "A '[' with a backslash in
// front of it is literal text under the CommonMark rules") plus
// ADR-0002's alert accuracy promise (alerts name real problems).
//
// Settings involved: none - the empty-reference alert always speaks.

describe("the unnamed-reference alert and backslash escapes", () => {
    beforeEach(resetNotices);

    it("an escaped \\[^] is literal text, not an abandoned placeholder", () => {
        expect(countEmptyFootnoteReferences("a \\[^] b")).toBe(0);
    });

    it("the alert stays quiet for an escaped \\[^]", () => {
        noticeLintAlerts(fakePlugin({}), "a \\[^] b");
        expect(messages().some((m) => m.includes("unnamed footnote reference"))).toBe(false);
    });

    it("control: an escaped backslash before a real placeholder still counts", () => {
        // "\\\\[^]" is an escaped backslash followed by a live "[^]"
        expect(countEmptyFootnoteReferences("a \\\\[^] b")).toBe(1);
    });

    it("control: a plain placeholder counts", () => {
        expect(countEmptyFootnoteReferences("a [^] b")).toBe(1);
    });

    it("control: a placeholder inside inline code does not count (#41)", () => {
        expect(countEmptyFootnoteReferences("a `[^]` b")).toBe(0);
    });
});
