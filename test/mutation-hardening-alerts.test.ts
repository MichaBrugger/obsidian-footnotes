import { beforeEach, describe, expect, it } from "vitest";

import { noticeCalls } from "./mocks/obsidian";

import FootnotePlugin from "../src/main";
import {
    countEmptyFootnoteReferences,
    noticeLintAlerts,
    orphanSafePrefixFor,
} from "../src/linting/lint-alerts";

// Mutation hardening for the post-lint alert tail (Stryker re-baseline
// 2026-08-12: lint-alerts scored 19.79% - the merge-duplicates work pinned
// the NAME lists but nobody asserted the notices themselves, so every
// gating condition and message literal survived). These pin the exact
// texts and the exact conditions each alert fires under.

function fakePlugin(settings: Partial<FootnotePlugin["settings"]>): FootnotePlugin {
    return {
        settings: {
            enableFootnotePrefix: false,
            lintDeleteOrphanedReferences: false,
            lintDeleteOrphanedDefinitions: false,
            lintMergeDuplicateDefinitions: false,
            ...settings,
        },
    } as unknown as FootnotePlugin;
}

beforeEach(() => {
    noticeCalls.length = 0;
});

const messages = () => noticeCalls.map((args) => args[0] as string);
const messageShown = (text: string) => messages().includes(text);
const anyMessageContaining = (part: string) =>
    messages().some((text) => text.includes(part));

describe("countEmptyFootnoteReferences", () => {
    it("counts every [^] occurrence, per line and per needle", () => {
        expect(countEmptyFootnoteReferences("a [^] b [^]\n[^] c")).toBe(3);
    });

    it("ignores [^] inside protected text", () => {
        expect(
            countEmptyFootnoteReferences("```\n[^]\n```\nlive [^] here"),
        ).toBe(1);
    });

    it("counts the bare-prefix placeholder only when a prefix is given", () => {
        expect(countEmptyFootnoteReferences("x [^3.] y", "3.")).toBe(1);
        expect(countEmptyFootnoteReferences("x [^3.] y")).toBe(0);
    });

    it("has no secret default needle", () => {
        // the prefix default is "" - a mutated default would count this
        expect(countEmptyFootnoteReferences("a [^Stryker was here!] b")).toBe(0);
    });
});

describe("orphanSafePrefixFor", () => {
    const withPrefix = '---\nfootnote-prefix: "3."\n---\nbody';

    it("returns the note's valid prefix while the feature is on", () => {
        expect(
            orphanSafePrefixFor(
                fakePlugin({ enableFootnotePrefix: true }),
                withPrefix,
            ),
        ).toBe("3.");
    });

    it("returns nothing while the feature is off", () => {
        expect(orphanSafePrefixFor(fakePlugin({}), withPrefix)).toBe("");
    });

    it("returns nothing for an invalid prefix", () => {
        // a trailing digit is invalid ("3" + autonumber "1" reads as 31)
        expect(
            orphanSafePrefixFor(
                fakePlugin({ enableFootnotePrefix: true }),
                '---\nfootnote-prefix: "3"\n---\nbody',
            ),
        ).toBe("");
    });

    it("returns nothing when the note has no prefix property", () => {
        expect(
            orphanSafePrefixFor(
                fakePlugin({ enableFootnotePrefix: true }),
                "plain body",
            ),
        ).toBe("");
    });
});

describe("the unnamed-reference alert", () => {
    it("singular, with the plain hint", () => {
        noticeLintAlerts(fakePlugin({}), "left [^] behind");
        expect(
            messageShown(
                'This note has an unnamed footnote reference ("[^]"). Give it a name or delete it.',
            ),
        ).toBe(true);
    });

    it("plural, with the count", () => {
        noticeLintAlerts(fakePlugin({}), "left [^] and [^] behind");
        expect(
            messageShown(
                'This note has 2 unnamed footnote references ("[^]"). Give them names or delete them.',
            ),
        ).toBe(true);
    });

    it("mentions the bare prefix in the hint while the feature is on", () => {
        noticeLintAlerts(
            fakePlugin({ enableFootnotePrefix: true }),
            '---\nfootnote-prefix: "3."\n---\nleft [^3.] behind',
        );
        expect(
            messageShown(
                'This note has an unnamed footnote reference ("[^]" or the bare prefix "[^3.]"). Give it a name or delete it.',
            ),
        ).toBe(true);
    });

    it("does not count the bare prefix while the feature is off", () => {
        noticeLintAlerts(
            fakePlugin({}),
            '---\nfootnote-prefix: "3."\n---\nfine [^3.] here\n\n[^3.]: named on purpose',
        );
        expect(anyMessageContaining("unnamed")).toBe(false);
    });

    it("stays silent when the note has none", () => {
        noticeLintAlerts(fakePlugin({}), "fine [^x] here\n\n[^x]: d");
        expect(anyMessageContaining("unnamed")).toBe(false);
    });
});

describe("the orphaned-reference alert", () => {
    it("singular, naming the reference", () => {
        noticeLintAlerts(fakePlugin({}), "see [^lost]");
        expect(
            messageShown(
                "This note has a footnote reference with no definition ([^lost]). Write its definition or delete the reference.",
            ),
        ).toBe(true);
    });

    it("plural, naming them all up to three", () => {
        noticeLintAlerts(fakePlugin({}), "see [^a] [^b] [^c]");
        expect(
            messageShown(
                "This note has 3 footnote references with no definition ([^a], [^b], [^c]). Write their definitions or delete the references.",
            ),
        ).toBe(true);
    });

    it("elides past three names with an ellipsis", () => {
        noticeLintAlerts(fakePlugin({}), "see [^a] [^b] [^c] [^d]");
        expect(
            messageShown(
                "This note has 4 footnote references with no definition ([^a], [^b], [^c], …). Write their definitions or delete the references.",
            ),
        ).toBe(true);
    });

    it("stays silent while the delete toggle is on (deletion owns it)", () => {
        noticeLintAlerts(
            fakePlugin({ lintDeleteOrphanedReferences: true }),
            "see [^lost]",
        );
        expect(anyMessageContaining("with no definition")).toBe(false);
    });
});

describe("the orphaned-definition alert", () => {
    it("singular, naming the definition", () => {
        noticeLintAlerts(fakePlugin({}), "[^unused]: nothing points here");
        expect(
            messageShown(
                "This note has a footnote definition nothing references ([^unused]). Add its reference in the text or delete the definition.",
            ),
        ).toBe(true);
    });

    it("plural, naming them", () => {
        noticeLintAlerts(fakePlugin({}), "[^u1]: a\n[^u2]: b");
        expect(
            messageShown(
                "This note has 2 footnote definitions nothing references ([^u1], [^u2]). Add their references in the text or delete the definitions.",
            ),
        ).toBe(true);
    });

    it("stays silent while the delete toggle is on", () => {
        noticeLintAlerts(
            fakePlugin({ lintDeleteOrphanedDefinitions: true }),
            "[^unused]: nothing points here",
        );
        expect(anyMessageContaining("nothing references")).toBe(false);
    });
});

describe("the duplicate-definition alert", () => {
    it("singular, naming the footnote", () => {
        noticeLintAlerts(fakePlugin({}), "see [^d]\n\n[^d]: one\n\n[^d]: two");
        expect(
            messageShown(
                'This note defines [^d] more than once. Obsidian renders only the last definition. Merge them, or turn on "Merge duplicate definitions".',
            ),
        ).toBe(true);
    });

    it("plural, naming them", () => {
        noticeLintAlerts(
            fakePlugin({}),
            "see [^d] and [^e]\n\n[^d]: one\n\n[^d]: two\n\n[^e]: one\n\n[^e]: two",
        );
        expect(
            messageShown(
                'This note defines 2 footnotes more than once ([^d], [^e]). Obsidian renders only each one\'s last definition. Merge them, or turn on "Merge duplicate definitions".',
            ),
        ).toBe(true);
    });

    it("stays silent while the merge toggle is on (merging owns it)", () => {
        noticeLintAlerts(
            fakePlugin({ lintMergeDuplicateDefinitions: true }),
            "see [^d]\n\n[^d]: one\n\n[^d]: two",
        );
        expect(anyMessageContaining("more than once")).toBe(false);
    });
});

describe("the shared gate", () => {
    it("a note without any [^ raises no alert at all", () => {
        noticeLintAlerts(fakePlugin({}), "plain prose, nothing here");
        expect(noticeCalls).toEqual([]);
    });

    it("a note whose footnotes are all healthy raises no alert either", () => {
        // kills the empty-names early-return mutants: without them the
        // plural branches would toast "This note has 0 …"
        noticeLintAlerts(fakePlugin({}), "fine [^x] here\n\n[^x]: d");
        expect(noticeCalls).toEqual([]);
    });
});
