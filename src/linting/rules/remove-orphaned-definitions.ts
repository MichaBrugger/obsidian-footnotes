import { footnoteReferenceMatches } from "../../insert-or-navigate-footnotes";
import {
    DefinitionBlock,
    definitionLabelIn,
    DocumentScan,
    findDefinitionBlocks,
    maskProtectedLines,
    normalizeEol,
    removeLineRanges,
    restoreEol,
    scanDocument,
} from "../../markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";

// Orphaned DEFINITION deletion as its own rule (2026-08-10): it used to live
// inside reindex (the keepOrphanedDefinitions option, which reindexFootnotes
// still honors for direct callers), but the lint pipeline runs this instead —
// the "Delete orphaned definitions" toggle works with reindexing off, and the
// two orphan settings mirror each other. Deletion is transitive over a
// reference graph, so a chain of definitions each kept alive only by the
// previous one's body dies in ONE call at any depth (the 20-iteration
// fixpoint cap never applies here); definitions that reference each other in
// a cycle count as referenced and survive, exactly like the reindex policy.

interface ReferenceScan {
    blocks: DefinitionBlock[];
    /** folded name → reference count from lines OUTSIDE every definition block */
    liveRefs: Map<string, number>;
    /** per block: the folded names its own lines reference */
    blockRefs: string[][];
}

function scanReferences(
    lines: string[],
    scan: DocumentScan,
): ReferenceScan {
    const blocks = findDefinitionBlocks(lines, scan.isProtected);

    // document-aware masked twin: protected lines are all-NUL (no matches),
    // and comment portions of boundary lines are invisible
    const maskedLines = maskProtectedLines(lines, scan);

    // C22 follow-through (parallel-review probe, 2026-08-10): a
    // blockquoted/callout label ("> [^x]: …") is a LIVE definition — as a
    // single-line block, since blockquoted continuations aren't a thing —
    // and NO definition label of either shape counts as a reference (a
    // label defines; treating it as a reference kept orphans alive)
    const labelStartAt = new Array<number>(lines.length).fill(-1);
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i]) continue;
        const label = definitionLabelIn(maskedLines[i]);
        if (!label) continue;
        labelStartAt[i] = label.nameStart - 2;
        if (label.nameStart > 2) {
            blocks.push({
                name: lines[i].slice(label.nameStart, label.nameEnd),
                start: i,
                end: i,
            });
        }
    }
    blocks.sort((a, b) => a.start - b.start);

    const blockAtLine = new Array<number>(lines.length).fill(-1);
    blocks.forEach((block, i) => {
        for (let line = block.start; line <= block.end; line++) {
            blockAtLine[line] = i;
        }
    });

    const liveRefs = new Map<string, number>();
    const blockRefs: string[][] = blocks.map(() => []);
    for (let i = 0; i < lines.length; i++) {
        for (const match of footnoteReferenceMatches(maskedLines[i])) {
            const start = match.index ?? 0;
            // column-0 labels are excluded by footnoteReferenceMatches;
            // blockquoted ones read as mid-line references — skip them here
            if (start === labelStartAt[i]) continue;
            // re-slice the original for the name (a code span masks to NULs)
            const name = lines[i]
                .slice(start + 2, start + match[0].length - 1)
                .toLowerCase();
            if (blockAtLine[i] === -1) {
                liveRefs.set(name, (liveRefs.get(name) ?? 0) + 1);
            } else {
                blockRefs[blockAtLine[i]].push(name);
            }
        }
    }
    return { blocks, liveRefs, blockRefs };
}

/**
 * The blocks the reference graph can't keep alive: repeatedly kill every
 * definition whose (folded) name has zero remaining references, retiring the
 * dead block's own body references as it goes. Duplicate definitions of one
 * name share a fate. Terminates because every round kills at least one block.
 */
function deadBlocks(scan: ReferenceScan): DefinitionBlock[] {
    const { blocks, liveRefs, blockRefs } = scan;
    const refCount = new Map(liveRefs);
    for (const refs of blockRefs) {
        for (const name of refs) {
            refCount.set(name, (refCount.get(name) ?? 0) + 1);
        }
    }
    const alive = new Set(blocks.map((_, i) => i));
    let changed = true;
    while (changed) {
        changed = false;
        for (const i of [...alive]) {
            if ((refCount.get(blocks[i].name.toLowerCase()) ?? 0) > 0) continue;
            alive.delete(i);
            for (const name of blockRefs[i]) {
                refCount.set(name, (refCount.get(name) ?? 0) - 1);
            }
            changed = true;
        }
    }
    return blocks.filter((_, i) => !alive.has(i));
}

/**
 * Distinct names of definitions nothing references (each in its own
 * casing, definition order) — the alert's list. Single-level on purpose: a
 * definition referenced only from an orphan's body is still "referenced",
 * matching the message's wording; fixing the listed orphan surfaces it on
 * the next lint.
 */
export function orphanedFootnoteDefinitionNames(markdown: string): string[] {
    // no "[^" anywhere means no definitions (and no orphans) — this alert
    // scan runs on every lint (perf F4)
    if (!markdown.includes("[^")) return [];
    const lines = normalizeEol(markdown).text.split("\n");
    const scan = scanReferences(lines, scanDocument(lines));
    const referenced = new Set(scan.liveRefs.keys());
    for (const refs of scan.blockRefs) {
        for (const name of refs) referenced.add(name);
    }
    const names: string[] = [];
    const seen = new Set<string>();
    for (const block of scan.blocks) {
        const folded = block.name.toLowerCase();
        if (referenced.has(folded) || seen.has(folded)) continue;
        seen.add(folded);
        names.push(block.name);
    }
    return names;
}

/** The definition blocks the reference graph can't keep alive (transitive — see module note). Shared with reindex's keepOrphanedDefinitions:false path, so both deletion routes agree at any chain depth. */
export function orphanedDefinitionBlocks(
    lines: string[],
    scan: DocumentScan,
): DefinitionBlock[] {
    return deadBlocks(scanReferences(lines, scan));
}

/** Every unreferenced definition block removed (transitively — see module note). Protected regions and everything referenced stay put. */
export function removeOrphanedFootnoteDefinitions(markdown: string): string {
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const dead = orphanedDefinitionBlocks(lines, scanDocument(lines));
    if (dead.length === 0) return markdown;
    return restoreEol(removeLineRanges(lines, dead).join("\n"), eol);
}

/** Linter-shaped registry entry. */
export const removeOrphanedDefinitionsRule: FootnoteRule = {
    id: "remove-orphaned-definitions",
    name: "Remove orphaned definitions",
    description:
        "Delete footnote definitions that nothing references, including chains only kept alive by each other's bodies.",
    ignoreTypes: [
        IgnoreType.Code,
        IgnoreType.InlineCode,
        IgnoreType.Math,
        IgnoreType.Yaml,
        IgnoreType.HtmlComment,
    ],
    examples: [
        {
            description: "An unreferenced definition is removed",
            before: "text[^1]\n\n[^1]: used\n[^9]: stray",
            after: "text[^1]\n\n[^1]: used",
        },
        {
            description: "A definition only an orphan's body references dies with it",
            before: "text\n\n[^a]: uses[^b]\n[^b]: chained",
            after: "text\n",
        },
    ],
    apply: (text) => removeOrphanedFootnoteDefinitions(text),
};
