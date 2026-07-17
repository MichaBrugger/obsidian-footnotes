import { AllMarkers } from "./insert-or-navigate-footnotes";
import {
    DefinitionStart,
    findDefinitionBlocks,
    maskInlineCode,
    normalizeEol,
    protectedLines,
    removeLineRanges,
    restoreEol,
} from "./markdown-scan";

// The reindex algorithm: a pure markdown → markdown transform, no Editor.
// Policy (pinned in test/reindex-footnotes.test.ts): numbered footnotes are
// renumbered 1..n by first marker appearance and their definitions reordered
// to match; named footnotes keep their names (unless renumberNamedFootnotes)
// but slot into the definition ordering; orphaned definitions are kept and
// numbered after everything referenced (unless keepOrphanedDefinitions is
// off); code and frontmatter are invisible to all of it.

export interface ReindexOptions {
    /** Keep definitions no marker references, numbering them after everything referenced (default). Off deletes them. */
    keepOrphanedDefinitions?: boolean;
    /** Give named footnotes numbers by appearance order instead of preserving their names (default off). */
    renumberNamedFootnotes?: boolean;
}

/** Distinct marker names by first appearance in the (unprotected) text. */
function markerAppearanceOrder(
    lines: string[],
    isProtected: boolean[],
): string[] {
    const order: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        if (isProtected[i]) continue;
        for (const match of maskInlineCode(lines[i]).matchAll(AllMarkers)) {
            if (!seen.has(match[1])) {
                seen.add(match[1]);
                order.push(match[1]);
            }
        }
    }
    return order;
}

/** All markers on the line rewritten through `renames` (code spans skipped); the map is complete, so swaps can't collide. */
function rewriteMarkers(line: string, renames: Map<string, string>): string {
    const masked = maskInlineCode(line);
    let out = "";
    let copied = 0;
    for (const match of masked.matchAll(AllMarkers)) {
        const newName = renames.get(match[1]);
        if (newName === undefined) continue;
        const start = match.index ?? 0;
        out += line.slice(copied, start) + `[^${newName}]`;
        copied = start + match[0].length;
    }
    return out + line.slice(copied);
}

/**
 * Reindex every footnote in `markdown`: numbered footnotes become 1..n by
 * order of first marker appearance (all repeats follow), named footnotes
 * keep their names, and definition blocks are reordered into the same
 * appearance order by permuting them among their existing positions —
 * everything between them stays where it was. `options` selects the two
 * alternative policies: deleting orphaned definitions instead of keeping
 * them, and renumbering named footnotes instead of preserving them.
 */
export function reindexFootnotes(
    markdown: string,
    options: ReindexOptions = {},
): string {
    const keepOrphans = options.keepOrphanedDefinitions ?? true;
    const renumberNamed = options.renumberNamedFootnotes ?? false;

    const { text, eol } = normalizeEol(markdown);
    let lines = text.split("\n");
    let isProtected = protectedLines(lines);
    let blocks = findDefinitionBlocks(lines, isProtected);
    let markerOrder = markerAppearanceOrder(lines, isProtected);

    if (!keepOrphans) {
        const referenced = new Set(markerOrder);
        const orphans = blocks.filter((block) => !referenced.has(block.name));
        if (orphans.length > 0) {
            // cut the orphan blocks out, then re-derive everything — line
            // numbers shifted, and a cut can even change fence pairing
            lines = removeLineRanges(lines, orphans);
            isProtected = protectedLines(lines);
            blocks = findDefinitionBlocks(lines, isProtected);
            markerOrder = markerAppearanceOrder(lines, isProtected);
        }
    }

    // referenced names first (by first marker appearance), then whatever
    // orphaned definitions remain, in definition order
    const order = [...markerOrder];
    const seen = new Set(order);
    for (const block of blocks) {
        if (!seen.has(block.name)) {
            seen.add(block.name);
            order.push(block.name);
        }
    }

    // numbered names → their new number, in appearance order; named
    // footnotes only consume a number when they're being renumbered too
    const renames = new Map<string, string>();
    let nextNumber = 1;
    for (const name of order) {
        if (renumberNamed || /^\d+$/.test(name)) {
            renames.set(name, String(nextNumber++));
        }
    }

    const rewritten = lines.map((line, i) => {
        if (isProtected[i]) return line;
        let result = rewriteMarkers(line, renames);
        const definition = line.match(DefinitionStart);
        if (definition) {
            const newName = renames.get(definition[1]);
            if (newName !== undefined) {
                result = `[^${newName}]:` + result.slice(definition[0].length);
            }
        }
        return result;
    });

    // permute definition blocks among their existing slots so they read in
    // appearance order; a stable sort keeps duplicate definitions together
    const orderIndex = new Map(order.map((name, i) => [name, i]));
    const sorted = blocks
        .map((block, i) => ({ block, i }))
        .sort(
            (a, b) =>
                (orderIndex.get(a.block.name) ?? 0) -
                    (orderIndex.get(b.block.name) ?? 0) || a.i - b.i,
        )
        .map((entry) => entry.block);

    const slotAtLine = new Map(blocks.map((block, i) => [block.start, i]));
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const slot = slotAtLine.get(i);
        if (slot === undefined) {
            out.push(rewritten[i]);
            continue;
        }
        const block = sorted[slot];
        for (let j = block.start; j <= block.end; j++) out.push(rewritten[j]);
        i = blocks[slot].end;
    }
    return restoreEol(out.join("\n"), eol);
}
