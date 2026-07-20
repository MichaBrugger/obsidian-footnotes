import {
    footnoteMarkerMatches,
    footnotePrefixProblem,
} from "../../insert-or-navigate-footnotes";
import {
    DefinitionStart,
    findDefinitionBlocks,
    maskInlineRegions,
    normalizeEol,
    protectedLines,
    removeLineRanges,
    restoreEol,
} from "../../markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";

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
    /**
     * The note's own footnote-prefix: names matching `<prefix><digits>` are
     * NUMBERED footnotes of that namespace, renumbered `<prefix>1..n` by
     * appearance with their own counter — the same reordering behavior as
     * plain numbered footnotes (QOL, 2026-07-18). Other prefixes stay
     * named. Invalid prefixes (digit-ending) are ignored defensively.
     */
    prefix?: string;
}

/**
 * Distinct marker names by first appearance in the (unprotected) text,
 * folded to lowercase — footnote ids are case-insensitive in Obsidian, so
 * "[^Note]" and "[^note]" are one footnote for ordering and identity. A
 * definition's own "[^id]:" label is not a reference (footnoteMarkerMatches
 * excludes it positionally), but a marker nested in a definition body is.
 */
function markerAppearanceOrder(
    lines: string[],
    isProtected: boolean[],
): string[] {
    const order: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        if (isProtected[i]) continue;
        for (const match of footnoteMarkerMatches(maskInlineRegions(lines[i]))) {
            const id = match[1].toLowerCase();
            if (!seen.has(id)) {
                seen.add(id);
                order.push(id);
            }
        }
    }
    return order;
}

/** All markers on the line rewritten through `renames` (code spans and the definition label skipped; ids matched case-insensitively); the map is complete, so swaps can't collide. */
function rewriteMarkers(line: string, renames: Map<string, string>): string {
    const masked = maskInlineRegions(line);
    let out = "";
    let copied = 0;
    for (const match of footnoteMarkerMatches(masked)) {
        const newName = renames.get(match[1].toLowerCase());
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
    // A single pass can leave the result not-yet-stable, so re-run to a
    // fixpoint — this makes one call idempotent (f(f(x)) === f(x)):
    //  - permuting definition blocks changes the appearance order of markers
    //    NESTED in their bodies, which a second pass would renumber (churn);
    //  - with orphan deletion on, cutting an orphan can strand a definition
    //    that only the orphan's body referenced (a transitive orphan), which
    //    a second pass would delete — destroying user text on the later run.
    // Both converge in a couple of iterations; the cap only guards a
    // theoretical non-convergent document (best-effort, never loops forever).
    let current = markdown;
    for (let i = 0; i < 20; i++) {
        const next = reindexOnce(current, options);
        if (next === current) return current;
        current = next;
    }
    return current;
}

function reindexOnce(
    markdown: string,
    options: ReindexOptions = {},
): string {
    const keepOrphans = options.keepOrphanedDefinitions ?? true;
    const renumberNamed = options.renumberNamedFootnotes ?? false;
    // the namespace prefix, kept in its original casing for output but
    // matched case-insensitively (ids are case-folded throughout)
    const prefixOut =
        options.prefix && footnotePrefixProblem(options.prefix) === null
            ? options.prefix
            : "";
    const prefixFolded = prefixOut.toLowerCase();
    const isPrefixedNumbered = (name: string) =>
        prefixFolded !== "" &&
        name.startsWith(prefixFolded) &&
        /^\d+$/.test(name.slice(prefixFolded.length));

    const { text, eol } = normalizeEol(markdown);
    let lines = text.split("\n");
    let isProtected = protectedLines(lines);
    let blocks = findDefinitionBlocks(lines, isProtected);
    let markerOrder = markerAppearanceOrder(lines, isProtected);

    if (!keepOrphans) {
        // markerOrder is lowercased (ids are case-insensitive), so a
        // definition referenced only with different casing is NOT an orphan
        const referenced = new Set(markerOrder);
        const orphans = blocks.filter(
            (block) => !referenced.has(block.name.toLowerCase()),
        );
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
    // all names are canonical (lowercased) here so case-variant markers and
    // definitions share one identity throughout ordering and numbering
    const order = [...markerOrder];
    const seen = new Set(order);
    for (const block of blocks) {
        const name = block.name.toLowerCase();
        if (!seen.has(name)) {
            seen.add(name);
            order.push(name);
        }
    }

    // numbered names → their new number, in appearance order; the prefix
    // namespace runs its own independent counter; named footnotes only
    // consume a number when they're being renumbered too
    const renames = new Map<string, string>();
    let nextNumber = 1;
    let nextPrefixed = 1;
    for (const name of order) {
        if (isPrefixedNumbered(name)) {
            renames.set(name, `${prefixOut}${nextPrefixed++}`);
        } else if (renumberNamed || /^\d+$/.test(name)) {
            renames.set(name, String(nextNumber++));
        }
    }

    const rewritten = lines.map((line, i) => {
        if (isProtected[i]) return line;
        let result = rewriteMarkers(line, renames);
        const definition = line.match(DefinitionStart);
        if (definition) {
            const newName = renames.get(definition[1].toLowerCase());
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
                (orderIndex.get(a.block.name.toLowerCase()) ?? 0) -
                    (orderIndex.get(b.block.name.toLowerCase()) ?? 0) || a.i - b.i,
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

/** Linter-shaped wrapper: id matches Linter's rule filename. */
export const reIndexFootnotesRule: FootnoteRule<ReindexOptions> = {
    id: "re-index-footnotes",
    name: "Re-index footnotes",
    description:
        "Renumber numbered footnotes 1..n by first marker appearance and reorder their definitions to match.",
    ignoreTypes: [
        IgnoreType.Code,
        IgnoreType.InlineCode,
        IgnoreType.Math,
        IgnoreType.Yaml,
    ],
    examples: [
        {
            description: "Renumbers by first marker appearance",
            before: "bravo[^2] alpha[^1].\n\n[^1]: one\n[^2]: two",
            after: "bravo[^1] alpha[^2].\n\n[^1]: two\n[^2]: one",
        },
        {
            description: "Closes gaps in the numbering",
            before: "a[^3] b[^7].\n\n[^3]: three\n[^7]: seven",
            after: "a[^1] b[^2].\n\n[^1]: three\n[^2]: seven",
        },
    ],
    apply: (text, options = {}) => reindexFootnotes(text, options),
};
