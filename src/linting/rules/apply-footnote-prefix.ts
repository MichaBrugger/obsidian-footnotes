import {
    computeNextFootnoteNumber,
    footnoteMarkerMatches,
    footnotePrefixProblem,
} from "../../insert-or-navigate-footnotes";
import {
    DefinitionStart,
    findDefinitionBlocks,
    maskInlineRegions,
    normalizeEol,
    protectedLines,
    restoreEol,
} from "../../markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";

// QOL rule (2026-07-18): footnotes written before the note got its
// footnote-prefix property stay unprefixed — this renames them to carry
// the prefix. Plain numbered footnotes convert in first-appearance order
// (markers first, then orphaned definitions), numbered AFTER the highest
// existing prefixed footnote so nothing collides. Named footnotes keep
// their name behind the prefix ("[^note]" → "[^2.note]", A6 bug
// 2026-07-20) — except when the prefixed name already exists as another
// footnote, which the rename would silently merge. Already-prefixed
// footnotes are untouched; definition ordering is reindex's job, so blocks
// stay where they are. Runs BEFORE reindex in the pipeline, so converted
// footnotes renumber into reading order in the same lint. Idempotent by
// construction: everything this touches ends up carrying the prefix, and
// prefixed names are exactly what a second pass skips.

/** Rename every footnote not yet carrying `prefix` to carry it. Invalid prefixes (the lint guard cancels these earlier) change nothing. */
export function applyFootnotePrefix(markdown: string, prefix: string): string {
    if (!prefix || footnotePrefixProblem(prefix) !== null) return markdown;
    const prefixFolded = prefix.toLowerCase();

    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const isProtected = protectedLines(lines);
    const blocks = findDefinitionBlocks(lines, isProtected);

    // one scan collects both: distinct plain-numbered names by first marker
    // appearance then orphaned definitions (numbers have no casing, so no
    // folding needed for `order`), and every id in the note (folded) for
    // the named-rename collision guard below
    const order: string[] = [];
    const seen = new Set<string>();
    const existingIds = new Set<string>();
    const record = (id: string) => {
        existingIds.add(id.toLowerCase());
        if (/^\d+$/.test(id) && !seen.has(id)) {
            seen.add(id);
            order.push(id);
        }
    };
    for (let i = 0; i < lines.length; i++) {
        if (isProtected[i]) continue;
        for (const match of footnoteMarkerMatches(maskInlineRegions(lines[i]))) {
            // re-slice the original: a code span inside the name masks to
            // NULs in match[1], and the rewrite below compares original ids
            const start = match.index ?? 0;
            record(lines[i].slice(start + 2, start + match[0].length - 1));
        }
    }
    for (const block of blocks) {
        record(block.name);
    }

    // plain numbers continue after the highest footnote already carrying
    // the prefix
    let nextNumber = computeNextFootnoteNumber(text, prefix);
    const numberedRenames = new Map<string, string>();
    for (const name of order) {
        numberedRenames.set(name, `${prefix}${nextNumber++}`);
    }

    // the new id for `id`, or null to leave it alone. Named ids keep each
    // occurrence's own casing — ids are case-insensitive, so "[^Note]" and
    // "[^note]:" still name one footnote after both gain the prefix.
    const renameFor = (id: string): string | null => {
        const numbered = numberedRenames.get(id);
        if (numbered !== undefined) return numbered;
        if (/^\d+$/.test(id)) return null; // masked/unsafe digit runs
        const folded = id.toLowerCase();
        if (folded.startsWith(prefixFolded)) return null; // already carries it
        if (existingIds.has(prefixFolded + folded)) return null; // would merge two footnotes
        return `${prefix}${id}`;
    };

    const rewritten = lines.map((line, i) => {
        if (isProtected[i]) return line;
        const masked = maskInlineRegions(line);
        let result = "";
        let copied = 0;
        for (const match of footnoteMarkerMatches(masked)) {
            const start = match.index ?? 0;
            // re-slice the original for the id: a code span inside the
            // name masks to NULs in match[1]
            const id = line.slice(start + 2, start + match[0].length - 1);
            const newName = renameFor(id);
            if (newName === null) continue;
            result += line.slice(copied, start) + `[^${newName}]`;
            copied = start + match[0].length;
        }
        result += line.slice(copied);
        const definition = line.match(DefinitionStart);
        if (definition) {
            const newName = renameFor(definition[1]);
            if (newName !== null) {
                result = `[^${newName}]:` + result.slice(definition[0].length);
            }
        }
        return result;
    });
    return restoreEol(rewritten.join("\n"), eol);
}

/** Linter-shaped registry entry; the prefix comes in as the rule's option. */
export const applyFootnotePrefixRule: FootnoteRule<{ prefix?: string }> = {
    id: "apply-footnote-prefix",
    name: "Apply footnote prefix",
    description:
        "Rename footnotes to carry the note's footnote-prefix property: plain numbered ones are numbered after any existing prefixed footnotes, named ones keep their name behind the prefix.",
    ignoreTypes: [
        IgnoreType.Code,
        IgnoreType.InlineCode,
        IgnoreType.Math,
        IgnoreType.Yaml,
        IgnoreType.HtmlComment,
    ],
    examples: [
        {
            description: "Prefixes plain footnotes in appearance order",
            before: "b[^2] a[^1] end\n\n[^1]: one\n[^2]: two",
            after: "b[^3.1] a[^3.2] end\n\n[^3.2]: one\n[^3.1]: two",
        },
        {
            description: "Named footnotes keep their name behind the prefix",
            before: "x[^note] end\n\n[^note]: n",
            after: "x[^3.note] end\n\n[^3.note]: n",
        },
    ],
    apply: (text, options = {}) => applyFootnotePrefix(text, options.prefix ?? ""),
};
