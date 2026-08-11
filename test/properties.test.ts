import fc from "fast-check";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFootnoteFromMarkdown } from "mdast-util-gfm-footnote";
import { mathFromMarkdown } from "mdast-util-math";
import { gfmFootnote } from "micromark-extension-gfm-footnote";
import { math } from "micromark-extension-math";
import { describe, expect, it } from "vitest";

import { docArb } from "./arbitraries";
import { inlineFootnoteSpanAt, sanitizeInlineFootnoteContent } from "../src/inline-footnotes";
import { endOfWordOffset } from "../src/cursor-motion";
import { footnoteReferenceMatches } from "../src/footnote-grammar";
import { lintFootnotes, LintOptions } from "../src/linting/linter";
import {
    findDefinitionBlocks,
    maskProtectedLines,
    maskedLineAt,
    normalizeEol,
    protectedLines,
} from "../src/markdown-scan";

// Property-based tests (fast-check, adopted 2026-08-10): instead of
// hand-picked cases, every property is asserted over RANDOMLY GENERATED
// documents and option combos; failures shrink to a minimal repro
// automatically. These are the invariants the hunt sessions kept pinning
// one counterexample at a time — idempotence, protected-region
// preservation, and conservation — made permanent.
//
// Runs per property default to 200; crank it for a deep soak:
//   $env:FC_NUM_RUNS = "5000"; npx vitest run test/properties.test.ts
fc.configureGlobal({ numRuns: Number(process.env.FC_NUM_RUNS ?? 200) });

// soaks legitimately run for minutes — vitest's 5s default timeout is for
// hangs, not for 5000 double-parses (the oracle "failed" a soak purely by
// exceeding it); scale the ceiling with the run count
const SOAK_TIMEOUT = Math.max(30_000, Number(process.env.FC_NUM_RUNS ?? 200) * 60);
const soakIt = (name: string, fn: () => void) => it(name, fn, SOAK_TIMEOUT);

// The document generator lives in ./arbitraries.ts so the sample-corpus
// script can render the same docs in Obsidian for human review.

const optionsArb: fc.Arbitrary<LintOptions> = fc.record({
    fixPunctuation: fc.boolean(),
    moveDefinitionsToBottom: fc.boolean(),
    reindex: fc.boolean(),
    reindexOptions: fc.record({
        renumberNamedFootnotes: fc.boolean(),
        keepOrphanedDefinitions: fc.boolean(),
    }),
    removeOrphanedReferences: fc.boolean(),
    removeOrphanedDefinitions: fc.boolean(),
    orphanSafePrefix: fc.constantFrom("", "2."),
    applyNotePrefix: fc.boolean(),
    sectionHeading: fc.constantFrom("", "# Footnotes", "---\n## Footnotes"),
});

// options with every deletion pathway off — the conservation properties
const keepingOptionsArb: fc.Arbitrary<LintOptions> = optionsArb.map(
    (options) => ({
        ...options,
        removeOrphanedReferences: false,
        removeOrphanedDefinitions: false,
        reindexOptions: {
            ...options.reindexOptions,
            keepOrphanedDefinitions: true,
        },
    }),
);

// options with only DEFINITION deletion off — since definition blocks span
// regions their continuations open (Sol bug #3 fix), deleting an orphaned
// definition legitimately deletes its embedded protected math/comment
// lines; reference deletion never touches protected lines, so it stays on
const definitionKeepingOptionsArb: fc.Arbitrary<LintOptions> = optionsArb.map(
    (options) => ({
        ...options,
        removeOrphanedDefinitions: false,
        reindexOptions: {
            ...options.reindexOptions,
            keepOrphanedDefinitions: true,
        },
    }),
);

// ---------- helpers ----------

function definitionCount(text: string): number {
    const lines = normalizeEol(text).text.split("\n");
    return findDefinitionBlocks(lines, protectedLines(lines)).length;
}

function referenceCount(text: string): number {
    const masked = maskProtectedLines(normalizeEol(text).text.split("\n"));
    return masked.reduce(
        (sum, line) => sum + footnoteReferenceMatches(line).length,
        0,
    );
}

// ---------- differential oracle (remark/micromark) ----------
// An INDEPENDENT markdown implementation as referee: micromark with the
// GFM-footnote and math extensions parses the document before and after
// lint, and the footnote structure it sees must match. Comparing
// before-vs-after under the SAME parser cancels out parser-vs-plugin
// opinion differences — any change in what remark sees was introduced by
// lint itself.

interface OracleNode {
    type: string;
    identifier?: string;
    children?: OracleNode[];
}

interface FootnoteShape {
    definitions: number;
    references: number;
    /** references whose identifier has a matching definition */
    resolved: number;
}

function footnoteShape(markdown: string): FootnoteShape {
    const tree = fromMarkdown(markdown, {
        extensions: [gfmFootnote(), math()],
        mdastExtensions: [gfmFootnoteFromMarkdown(), mathFromMarkdown()],
    }) as OracleNode;
    const defined = new Set<string>();
    const referenced: string[] = [];
    let definitions = 0;
    const stack: OracleNode[] = [tree];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) break;
        // mdast stores `identifier` already case-normalized
        if (node.type === "footnoteDefinition" && node.identifier !== undefined) {
            definitions++;
            defined.add(node.identifier);
        }
        if (node.type === "footnoteReference" && node.identifier !== undefined) {
            referenced.push(node.identifier);
        }
        if (node.children) stack.push(...node.children);
    }
    return {
        definitions,
        references: referenced.length,
        resolved: referenced.filter((id) => defined.has(id)).length,
    };
}

// The one KNOWN parser disagreement, found by this very property on its
// first run (2026-08-10): micromark's math extension lets a "$" inside a
// reference name open a math span — in "[^a$1] x[^ch-2]. $m$" the two
// dollars pair up and swallow the [^ch-2] reference — while Obsidian keeps
// such names as footnotes (verified live; dollarInsideReference implements
// that). Renaming [^a$1] during reindex then changes what remark sees for
// reasons that are micromark's opinion, not a lint bug. The oracle recuses
// itself from documents with a "$" inside a footnote name; every other
// property still covers them.
const oracleDocArb = docArb.filter((doc) => !/\[\^[^\]\n]*\$/.test(doc));

describe("differential oracle over random documents", () => {
    soakIt("remark sees the same footnote structure before and after lint (deletions off)", () => {
        fc.assert(
            fc.property(oracleDocArb, keepingOptionsArb, (doc, options) => {
                const before = footnoteShape(doc);
                const after = footnoteShape(lintFootnotes(doc, options));
                expect(after).toEqual(before);
            }),
        );
    });
});

// ---------- transform invariants ----------

describe("lint invariants over random documents", () => {
    soakIt("lint is idempotent for every document and option combo", () => {
        fc.assert(
            fc.property(docArb, optionsArb, (doc, options) => {
                const once = lintFootnotes(doc, options);
                expect(lintFootnotes(once, options)).toBe(once);
            }),
        );
    });

    soakIt("lint never writes NUL bytes (mask leakage)", () => {
        fc.assert(
            fc.property(docArb, optionsArb, (doc, options) => {
                expect(lintFootnotes(doc, options)).not.toContain("\0");
            }),
        );
    });

    soakIt("protected line contents survive lint as a multiset", () => {
        fc.assert(
            fc.property(docArb, definitionKeepingOptionsArb, (doc, options) => {
                const out = lintFootnotes(doc, options);
                const linesIn = normalizeEol(doc).text.split("\n");
                const protectedIn = protectedLines(linesIn);
                const counts = new Map<string, number>();
                for (const line of normalizeEol(out).text.split("\n")) {
                    counts.set(line, (counts.get(line) ?? 0) + 1);
                }
                for (let i = 0; i < linesIn.length; i++) {
                    if (!protectedIn[i]) continue;
                    const left = counts.get(linesIn[i]) ?? 0;
                    expect(left, `protected line lost: ${JSON.stringify(linesIn[i])}`).toBeGreaterThan(0);
                    counts.set(linesIn[i], left - 1);
                }
            }),
        );
    });

    soakIt("definitions and references are conserved while every deletion is off", () => {
        fc.assert(
            fc.property(docArb, keepingOptionsArb, (doc, options) => {
                const out = lintFootnotes(doc, options);
                expect(definitionCount(out)).toBe(definitionCount(doc));
                expect(referenceCount(out)).toBe(referenceCount(doc));
            }),
        );
    });
});

// ---------- scanner invariants ----------

describe("scanner invariants over random documents", () => {
    soakIt("masking preserves every line's length", () => {
        fc.assert(
            fc.property(docArb, (doc) => {
                const lines = normalizeEol(doc).text.split("\n");
                const masked = maskProtectedLines(lines);
                for (let i = 0; i < lines.length; i++) {
                    expect(masked[i].length).toBe(lines[i].length);
                }
            }),
        );
    });

    soakIt("maskedLineAt agrees with the full masked twin on every line", () => {
        fc.assert(
            fc.property(docArb, fc.nat(60), (doc, pick) => {
                const lines = normalizeEol(doc).text.split("\n");
                if (lines.length === 0) return;
                const i = pick % lines.length;
                expect(maskedLineAt(lines, i)).toBe(
                    maskProtectedLines(lines)[i],
                );
            }),
        );
    });
});

// ---------- editor-side invariants ----------

describe("editor helper invariants", () => {
    soakIt("sanitized clipboard text always forms a closed inline footnote", () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 60 }), (raw) => {
                const content = sanitizeInlineFootnoteContent(raw);
                if (content === "") return;
                const line = `^[${content}]`;
                // the span must close exactly at the wrapper's own bracket
                expect(inlineFootnoteSpanAt(line, 1)).toEqual({
                    open: 0,
                    close: line.length - 1,
                });
            }),
        );
    });

    soakIt("endOfWordOffset stays in range and never splits a surrogate pair", () => {
        fc.assert(
            fc.property(
                fc.string({ maxLength: 30, unit: "grapheme" }),
                fc.nat(40),
                (text, pick) => {
                    const offset = text.length === 0 ? 0 : pick % (text.length + 1);
                    const end = endOfWordOffset(text, offset);
                    expect(end).toBeLessThanOrEqual(text.length);
                    // when the function MOVES the caret, it must land on a
                    // code point boundary (an untouched garbage offset is
                    // returned as-is by contract)
                    if (end === offset) return;
                    expect(end).toBeGreaterThan(offset - 2);
                    const at = text.charCodeAt(end);
                    const before = text.charCodeAt(end - 1);
                    const splitsPair =
                        at >= 0xdc00 &&
                        at <= 0xdfff &&
                        before >= 0xd800 &&
                        before <= 0xdbff;
                    expect(splitsPair).toBe(false);
                },
            ),
        );
    });
});
