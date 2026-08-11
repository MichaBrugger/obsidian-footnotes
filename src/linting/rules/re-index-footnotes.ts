import {
    footnotePrefixProblem,
    referenceOccurrences,
} from "../../insert-or-navigate-footnotes";
import {
    DefinitionStart,
    findDefinitionBlocks,
    maskProtectedLines,
    normalizeEol,
    scanDocument,
    removeLineRanges,
    restoreEol,
} from "../../markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";
import { orphanedDefinitionBlocks } from "./remove-orphaned-definitions";

// The reindex algorithm: a pure markdown → markdown transform, no Editor.
// Policy (pinned in test/reindex-footnotes.test.ts): numbered footnotes are
// renumbered 1..n by first reference appearance and their definitions reordered
// to match; named footnotes keep their names (unless renumberNamedFootnotes)
// but slot into the definition ordering; orphaned definitions are kept and
// numbered after everything referenced (unless keepOrphanedDefinitions is
// off); code and frontmatter are invisible to all of it.

export interface ReindexOptions {
    /** Keep definitions nothing references, numbering them after everything referenced (default). Off deletes them. */
    keepOrphanedDefinitions?: boolean;
    /** Give named footnotes numbers by appearance order instead of preserving their names (default off). With an active `prefix` they renumber into its namespace. */
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
 * Distinct reference names by first appearance in the (unprotected) text,
 * folded to lowercase — footnote ids are case-insensitive in Obsidian, so
 * "[^Note]" and "[^note]" are one footnote for ordering and identity. A
 * definition's own "[^id]:" label is not a reference (footnoteReferenceMatches
 * excludes it positionally), but a reference nested in a definition body is.
 */
function referenceAppearanceOrder(
    lines: string[],
    maskedLines: string[],
): string[] {
    const order: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        // protected lines are all-NUL in the masked twin — no matches;
        // referenceOccurrences re-slices raw names (bug-masked-name-identity)
        for (const { name } of referenceOccurrences(lines[i], maskedLines[i])) {
            const id = name.toLowerCase();
            if (!seen.has(id)) {
                seen.add(id);
                order.push(id);
            }
        }
    }
    return order;
}

/** All references on the line rewritten through `renames` (code spans and the definition label skipped; ids matched case-insensitively); the map is complete, so swaps can't collide. `masked` is the line's document-aware masked twin. */
function rewriteReferences(
    line: string,
    masked: string,
    renames: Map<string, string>,
): string {
    let out = "";
    let copied = 0;
    for (const { name, start, end } of referenceOccurrences(line, masked)) {
        const newName = renames.get(name.toLowerCase());
        if (newName === undefined) continue;
        out += line.slice(copied, start) + `[^${newName}]`;
        copied = end;
    }
    return out + line.slice(copied);
}

/**
 * Reindex every footnote in `markdown`: numbered footnotes become 1..n by
 * order of first reference appearance (all repeats follow), named footnotes
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
    // A single pass can leave the result not-yet-stable — permuting
    // definition blocks changes the appearance order of references NESTED in
    // their bodies, which the next pass renumbers — so re-run to a fixpoint.
    // Some documents have NO fixpoint: permutation and nested renumbering
    // can chase each other in a genuine cycle (bug-reindex-cycle, period 3),
    // and with lint-on-save that rewrote the note on every save forever.
    // Detecting a repeat and returning one canonical member of the cycle
    // (the lexicographically smallest — any fixed choice works) restores
    // idempotence: re-running from the canon walks the same cycle and picks
    // the same canon. Orphan deletion is transitive within ONE pass (see
    // orphanedDefinitionBlocks), so it never drives the iteration. The cap
    // is a pure safety net for a cycle longer than it (never observed).
    let current = markdown;
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) {
        const next = reindexOnce(current, options);
        if (next === current) return current;
        const cycleStart = seen.indexOf(next);
        if (cycleStart !== -1) {
            let canonical = next;
            for (const state of seen.slice(cycleStart + 1)) {
                if (state < canonical) canonical = state;
            }
            if (current < canonical) canonical = current;
            return canonical;
        }
        seen.push(current);
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
    let scan = scanDocument(lines);
    let maskedLines = maskProtectedLines(lines, scan);
    let blocks = findDefinitionBlocks(lines, scan.isProtected, scan);
    let referenceOrder = referenceAppearanceOrder(lines, maskedLines);

    if (!keepOrphans) {
        // the shared reference-graph deletion: transitive chains of any
        // depth die in THIS pass (the outer fixpoint used to expose one
        // link per iteration and its cap returned mid-chain on 21+-deep
        // chains — bug-reindex-orphan-cap), while definitions referencing
        // each other in a cycle count as referenced and survive
        const orphans = orphanedDefinitionBlocks(lines, scan);
        if (orphans.length > 0) {
            // cut the orphan blocks out, then re-derive everything — line
            // numbers shifted, and a cut can even change fence pairing
            lines = removeLineRanges(lines, orphans);
            scan = scanDocument(lines);
            maskedLines = maskProtectedLines(lines, scan);
            blocks = findDefinitionBlocks(lines, scan.isProtected, scan);
            referenceOrder = referenceAppearanceOrder(lines, maskedLines);
        }
    }

    // referenced names first (by first reference appearance), then whatever
    // orphaned definitions remain, in definition order
    // all names are canonical (lowercased) here so case-variant references and
    // definitions share one identity throughout ordering and numbering
    const order = [...referenceOrder];
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
    // consume a number when they're being renumbered too — and with an
    // active prefix they renumber INTO its namespace (they're this note's
    // footnotes), which also keeps the lint pipeline idempotent: a plain
    // number here would be re-prefixed by the next apply-prefix pass
    const renames = new Map<string, string>();
    let nextNumber = 1;
    let nextPrefixed = 1;
    for (const name of order) {
        if (isPrefixedNumbered(name)) {
            renames.set(name, `${prefixOut}${nextPrefixed++}`);
        } else if (/^\d+$/.test(name)) {
            renames.set(name, String(nextNumber++));
        } else if (renumberNamed) {
            renames.set(
                name,
                prefixOut
                    ? `${prefixOut}${nextPrefixed++}`
                    : String(nextNumber++),
            );
        }
    }

    const rewritten = lines.map((line, i) => {
        if (scan.isProtected[i]) return line;
        let result = rewriteReferences(line, maskedLines[i], renames);
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
    const joined = out.join("\n");
    // byte-identical no-op on mixed-EOL notes (spec-mixed-eol-noop-rewrite)
    return joined === text ? markdown : restoreEol(joined, eol);
}

/** Linter-shaped wrapper: id matches Linter's rule filename. */
export const reIndexFootnotesRule: FootnoteRule<ReindexOptions> = {
    id: "re-index-footnotes",
    name: "Re-index footnotes",
    description:
        "Renumber numbered footnotes 1..n by first reference appearance and reorder their definitions to match.",
    ignoreTypes: [
        IgnoreType.Code,
        IgnoreType.InlineCode,
        IgnoreType.Math,
        IgnoreType.Yaml,
    ],
    examples: [
        {
            description: "Renumbers by first reference appearance",
            before: "bravo[^2] alpha[^1].\n\n[^1]: one\n[^2]: two",
            after: "bravo[^1] alpha[^2].\n\n[^1]: two\n[^2]: one",
            options: {},
        },
        {
            description: "Closes gaps in the numbering",
            before: "a[^3] b[^7].\n\n[^3]: three\n[^7]: seven",
            after: "a[^1] b[^2].\n\n[^1]: three\n[^2]: seven",
            options: {},
        },
    ],
    apply: (text, options) => reindexFootnotes(text, options),
};
