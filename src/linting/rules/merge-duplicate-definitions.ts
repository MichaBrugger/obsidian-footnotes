import {
    definitionLabelIn,
    DocumentScan,
    findDefinitionBlocks,
    normalizeEol,
    removeLineRanges,
    restoreEol,
    scanDocument,
} from "../../parsing/markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";

// Duplicate footnote definitions - two or more "[^x]:" blocks for the same
// (case-folded) name. Ground-truthed in the live reading view 2026-08-12:
// Obsidian renders ONLY the LAST definition; every earlier one is dead
// text that silently loses. Jason's policy (2026-08-12): while the "Merge
// duplicate definitions" toggle is off, linting ALERTS about them
// (duplicates are never silent - same contract as orphans); with it on,
// this rule merges the later bodies INTO the first block, in document
// order, so no text is ever lost. The merged bodies land as INDENTED
// continuation lines - Jason's sketch had the second body unindented (a
// lazy continuation Obsidian would render too), but that shape is not part
// of the definition block (the A4 family: move-to-bottom would strand it),
// while the indented form renders identically and stays one block.

/**
 * Distinct names defined more than once (first-appearance order, first-seen
 * casing) - the alert's list. Only column-0 definition BLOCKS count;
 * blockquoted labels are out of scope, like everywhere in the orphan family.
 */
export function duplicateFootnoteDefinitionNames(
    markdown: string,
    // the post-lint alerts share ONE normalize/scan pass across the alert
    // helpers (2026-08-11 review perf item); direct callers omit it
    precomputed?: { lines: string[]; scan: DocumentScan },
): string[] {
    // no "[^" anywhere means no definitions (and no duplicates) - this
    // alert scan runs on every lint (perf F4)
    if (!markdown.includes("[^")) return [];
    const lines = precomputed?.lines ?? normalizeEol(markdown).text.split("\n");
    const scan = precomputed?.scan ?? scanDocument(lines);
    const blocks = findDefinitionBlocks(lines, scan.isProtected, scan);
    const counts = new Map<string, number>();
    for (const block of blocks) {
        const folded = block.name.toLowerCase();
        counts.set(folded, (counts.get(folded) ?? 0) + 1);
    }
    const names: string[] = [];
    const seen = new Set<string>();
    for (const block of blocks) {
        const folded = block.name.toLowerCase();
        if ((counts.get(folded) ?? 0) < 2 || seen.has(folded)) continue;
        seen.add(folded);
        names.push(block.name);
    }
    return names;
}

/**
 * Every later duplicate merged into its name's FIRST definition block: the
 * duplicate's label-line body becomes an indented continuation line and its
 * own continuation lines (blank runs included) follow verbatim, so the
 * merged block renders every body in document order. The first block keeps
 * its casing. Protected regions never count as definitions, and the cut
 * seams heal through removeLineRanges like every other block deletion.
 */
export function mergeDuplicateFootnoteDefinitions(markdown: string): string {
    if (!markdown.includes("[^")) return markdown;
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const scan = scanDocument(lines);
    const blocks = findDefinitionBlocks(lines, scan.isProtected, scan);

    const groups = new Map<string, typeof blocks>();
    for (const block of blocks) {
        const folded = block.name.toLowerCase();
        const group = groups.get(folded);
        if (group) group.push(block);
        else groups.set(folded, [block]);
    }

    // appended continuation lines per base block's END line, plus the
    // duplicate ranges to cut
    const appendAfter = new Map<number, string[]>();
    const doomed: { start: number; end: number }[] = [];
    for (const group of groups.values()) {
        if (group.length < 2) continue;
        const base = group[0];
        const appended = appendAfter.get(base.end) ?? [];
        for (const duplicate of group.slice(1)) {
            const label = definitionLabelIn(lines[duplicate.start]);
            const body = label
                ? lines[duplicate.start].slice(label.labelEnd).trim()
                : "";
            if (body !== "") appended.push(`    ${body}`);
            for (let i = duplicate.start + 1; i <= duplicate.end; i++) {
                appended.push(lines[i]);
            }
            doomed.push({ start: duplicate.start, end: duplicate.end });
        }
        if (appended.length > 0) appendAfter.set(base.end, appended);
    }
    if (doomed.length === 0) return markdown;

    // splice the appended lines into the base's last line BEFORE the cut -
    // removeLineRanges treats lines as opaque strings, so a multi-line
    // "line" rides through it and unfolds at the final join
    const mutated = lines.slice();
    for (const [end, appended] of appendAfter) {
        mutated[end] = [mutated[end], ...appended].join("\n");
    }
    const out = removeLineRanges(mutated, doomed);
    // cutting a duplicate at EOF can leave the blank line that used to
    // separate it - never mint MORE trailing blank lines than the note had
    let trailingBefore = 0;
    for (let i = lines.length - 1; i >= 0 && lines[i] === ""; i--) {
        trailingBefore++;
    }
    let trailingAfter = 0;
    for (let i = out.length - 1; i >= 0 && out[i] === ""; i--) {
        trailingAfter++;
    }
    while (trailingAfter > trailingBefore) {
        out.pop();
        trailingAfter--;
    }
    const result = out.join("\n");
    // byte-identical no-op on mixed-EOL notes (spec-mixed-eol-noop-rewrite)
    return result === text ? markdown : restoreEol(result, eol);
}

/** Linter-shaped wrapper: id matches the settings toggle's rule. */
export const mergeDuplicateDefinitionsRule: FootnoteRule = {
    id: "merge-duplicate-definitions",
    name: "Merge duplicate definitions",
    description:
        "Merge every later definition of an already-defined footnote into the first one, keeping each body as a continuation line (Obsidian renders only the last definition otherwise).",
    ignoreTypes: [
        IgnoreType.Code,
        IgnoreType.InlineCode,
        IgnoreType.Math,
        IgnoreType.Yaml,
    ],
    examples: [
        {
            description:
                "A second definition merges into the first as a continuation",
            before: "use[^d] here\n\n[^d]: first\n\n[^d]: second\n\ntail prose",
            after: "use[^d] here\n\n[^d]: first\n    second\n\ntail prose",
        },
    ],
    apply: (text) => mergeDuplicateFootnoteDefinitions(text),
};
