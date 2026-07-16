import { AllMarkers } from "./insert-or-navigate-footnotes";
import {
    DefinitionBlock,
    DefinitionStart,
    findDefinitionBlocks,
    maskInlineCode,
    protectedLines,
} from "./markdown-scan";

// The reindex algorithm: a pure markdown → markdown transform, no Editor.
// Policy (pinned in test/reindex-footnotes.test.ts): numbered footnotes are
// renumbered 1..n by first marker appearance and their definitions reordered
// to match; named footnotes keep their names but slot into the definition
// ordering; orphaned definitions are kept (numbered after everything
// referenced); code and frontmatter are invisible to all of it.

/** Distinct footnote names by first marker appearance, then orphaned definition names in definition order. */
function appearanceOrder(
    lines: string[],
    isProtected: boolean[],
    blocks: DefinitionBlock[],
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
    for (const block of blocks) {
        if (!seen.has(block.name)) {
            seen.add(block.name);
            order.push(block.name);
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
 * everything between them stays where it was.
 */
export function reindexFootnotes(markdown: string): string {
    const lines = markdown.split("\n");
    const isProtected = protectedLines(lines);
    const blocks = findDefinitionBlocks(lines, isProtected);
    const order = appearanceOrder(lines, isProtected, blocks);

    // numbered names → their new number, in appearance order; named
    // footnotes never consume a number
    const renames = new Map<string, string>();
    let nextNumber = 1;
    for (const name of order) {
        if (/^\d+$/.test(name)) {
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
    return out.join("\n");
}
