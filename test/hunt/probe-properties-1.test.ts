import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/reindex-footnotes";
import { tidyFootnotes } from "../../src/tidy-footnotes";
import { moveFootnoteDefinitionsToBottom } from "../../src/move-footnotes-to-bottom";
import { footnoteAfterPunctuation } from "../../src/footnote-after-punctuation";
import { AllMarkers } from "../../src/insert-or-navigate-footnotes";
import {
    DefinitionStart,
    findDefinitionBlocks,
    maskProtectedLines,
    protectedLines,
} from "../../src/markdown-scan";

// Property battery: idempotence, content preservation, marker/definition
// pairing — run across a taxonomy of adversarial documents.

const DOCS: Record<string, string> = {
    simple: "alpha[^1] bravo[^2].\n\n[^1]: one\n[^2]: two",
    reversed: "bravo[^2] alpha[^1].\n\n[^1]: one\n[^2]: two",
    duplicateMarkers: "a[^1] b[^1] c[^2].\n\n[^1]: one\n[^2]: two",
    duplicateDefinitions: "a[^1].\n\n[^1]: first copy\n[^1]: second copy",
    markerNoDefinition: "dangling[^9] end.",
    definitionNoMarker: "prose only.\n\n[^9]: orphan body",
    namedMixed: "x[^note] y[^3] z[^note].\n\n[^3]: three\n[^note]: named body",
    prefixed: "a[^blog-2] b[^blog-1].\n\n[^blog-1]: bee one\n[^blog-2]: bee two",
    codeFence:
        "real[^2].\n\n```\nfake[^1] marker\n[^1]: fake definition\n```\n\n[^2]: def",
    tildeFence: "a[^2].\n\n~~~text\nfake[^1]\n~~~~\n\n[^2]: def",
    unclosedFence: "a[^1].\n\n[^1]: def\n\n```\nfake[^2]\n[^2]: unreachable",
    inlineCode: "use `[^1]` and ``double [^2]`` real[^3].\n\n[^3]: def",
    frontmatter: "---\ntitle: fake [^5]\n---\nbody[^2].\n\n[^2]: def",
    multiBlocks:
        "one[^2].\n\n[^2]: two body\n\nmiddle prose[^4].\n\n[^4]: four body\n\ntail.",
    defsAboveMarkers: "[^2]: two body\n[^1]: one body\n\nlater[^1] then[^2].",
    continuations:
        "one[^2] two[^1].\n\n[^1]: first\n    continued line\n\n    second para\n[^2]: second",
    punctChain: "word[^1].[^2],\n\n[^1]: one\n[^2]: two",
    selfReference: "para[^1].\n\n[^1]: see also[^1] itself",
    defOnlyReference: "para.\n\n[^1]: uses[^2] inside\n[^2]: two body",
    midlineColon: "Note[^x]: intro\n\nreal[^1].\n\n[^1]: one\n[^x]: ex body",
    blankHeavy: "a[^1]\n\n\n[^1]: one\n\n\n[^2]: orphan\n\n\ntail",
    trailingNewline: "a[^1].\n\n[^1]: def\n",
    doubleTrailing: "a[^1].\n\n[^1]: def\n\n",
    noFootnotes: "just prose\n\nsecond para",
    empty: "",
    crlf: "---\r\ntitle: fake [^5]\r\n---\r\nbody[^2].\r\n\r\n[^2]: def",
};

const TRANSFORMS: Record<string, (doc: string) => string> = {
    reindex: (d) => reindexFootnotes(d),
    reindexDeleteOrphans: (d) =>
        reindexFootnotes(d, { keepOrphanedDefinitions: false }),
    reindexRenumberNamed: (d) =>
        reindexFootnotes(d, { renumberNamedFootnotes: true }),
    moveToBottom: (d) => moveFootnoteDefinitionsToBottom(d),
    moveToBottomHeading: (d) =>
        moveFootnoteDefinitionsToBottom(d, "# Footnotes"),
    punctuation: (d) => footnoteAfterPunctuation(d),
    tidy: (d) => tidyFootnotes(d),
    tidyAllOptions: (d) =>
        tidyFootnotes(d, {
            sectionHeading: "# Footnotes",
            reindexOptions: {
                renumberNamedFootnotes: true,
                keepOrphanedDefinitions: false,
            },
        }),
};

/** Multiset (sorted list) of non-footnote, non-blank line bodies with markers stripped. */
function nonFootnoteLines(doc: string): string[] {
    const lines = doc.split("\n");
    const blocks = findDefinitionBlocks(lines, protectedLines(lines));
    const inBlock = new Set<number>();
    for (const b of blocks) {
        for (let i = b.start; i <= b.end; i++) inBlock.add(i);
    }
    return lines
        .filter((_, i) => !inBlock.has(i))
        .map((l) => l.replace(/\[\^[^[\]]+\]/g, "").trim())
        .filter((l) => l !== "")
        .sort();
}

/** The definition body each marker resolves to, in marker appearance order (marker names stripped from bodies so renames compare equal). */
function markerBodies(doc: string): string[] {
    const lines = doc.split("\n");
    const isProtected = protectedLines(lines);
    const masked = maskProtectedLines(lines);
    const blocks = findDefinitionBlocks(lines, isProtected);
    const bodyOf = new Map<string, string>();
    for (const b of blocks) {
        if (bodyOf.has(b.name)) continue;
        const text = lines
            .slice(b.start, b.end + 1)
            .join("\n")
            .replace(DefinitionStart, "")
            .replace(/\[\^[^[\]]+\]/g, "")
            .trim();
        bodyOf.set(b.name, text);
    }
    const out: string[] = [];
    for (const line of masked) {
        for (const m of line.matchAll(AllMarkers)) {
            out.push(bodyOf.get(m[1]) ?? "<undefined>");
        }
    }
    return out;
}

const cases: [string, string][] = [];
for (const t of Object.keys(TRANSFORMS)) {
    for (const d of Object.keys(DOCS)) cases.push([t, d]);
}

describe("idempotence f(f(doc)) === f(doc)", () => {
    it.each(cases)("%s on %s", (transformName, docName) => {
        const f = TRANSFORMS[transformName];
        const once = f(DOCS[docName]);
        expect(f(once)).toBe(once);
    });
});

describe("content preservation (non-footnote text survives)", () => {
    // heading variants excluded: they add a heading line by design
    const preserving = [
        "reindex",
        "reindexDeleteOrphans",
        "reindexRenumberNamed",
        "moveToBottom",
        "punctuation",
        "tidy",
    ];
    const preservationCases: [string, string][] = [];
    for (const t of preserving) {
        for (const d of Object.keys(DOCS)) preservationCases.push([t, d]);
    }
    it.each(preservationCases)("%s on %s", (transformName, docName) => {
        const f = TRANSFORMS[transformName];
        expect(nonFootnoteLines(f(DOCS[docName]))).toEqual(
            nonFootnoteLines(DOCS[docName]),
        );
    });
});

describe("marker/definition pairing preserved", () => {
    // orphan-deleting variants excluded: deleting an orphan is the policy
    const pairing = ["reindex", "reindexRenumberNamed", "moveToBottom"];
    const pairingCases: [string, string][] = [];
    for (const t of pairing) {
        for (const d of Object.keys(DOCS)) pairingCases.push([t, d]);
    }
    it.each(pairingCases)("%s on %s", (transformName, docName) => {
        const f = TRANSFORMS[transformName];
        expect(markerBodies(f(DOCS[docName]))).toEqual(
            markerBodies(DOCS[docName]),
        );
    });
});
