import {
    definitionLabelIn,
    DocumentScan,
    findDefinitionBlocks,
    normalizeEol,
    removeLineRanges,
    scanDocument,
} from "../../parsing/markdown-scan";
import { rewriteDocument } from "../rewrite-document";
import { FootnoteRule } from "../rule";

// Duplicate footnote definitions: two or more "[^x]:" definition blocks for
// the same name, treating upper and lower case as the same.
//
// Checked against the live Reading view on 2026-08-12: Obsidian renders
// ONLY the LAST definition of a name. Every earlier one is dead text that
// disappears without a word.
//
// Jason's policy (2026-08-12). While the "Merge duplicate definitions"
// toggle is off, the lint reports duplicates but leaves them alone;
// duplicates are never passed over in silence, the same promise orphans
// get. With the toggle on, this rule merges the later bodies INTO the first
// definition block, in the order they appear in the note, so no text is
// ever thrown away.
//
// The merged bodies arrive as INDENTED continuation lines. Jason's original
// sketch left the second body unindented, which Obsidian would render just
// as well. The trouble is that an unindented line is not part of the
// definition block, so move-to-bottom would leave it stranded behind (the
// A4 family of bugs). The indented form looks identical when rendered and
// stays one block.

/**
 * The list the alert reads out: each name that is defined more than once,
 * once each, in the order the names first appear, spelled with the case
 * they were first seen with.
 *
 * Only definition blocks at the left margin count. A label inside a
 * blockquote IS a real definition as far as the orphan rules are concerned
 * (C22), but merging into or out of a quoted block would need continuation
 * lines that know about quote markers. So duplicates involving a quoted
 * definition are neither merged nor reported here.
 */
export function duplicateFootnoteDefinitionNames(
    markdown: string,
    // The alerts all share ONE pass of normalizing the line endings and
    // scanning the note, done once and handed round (2026-08-11 review, a
    // speed fix). Anything calling this on its own leaves it out.
    precomputed?: { lines: string[]; scan: DocumentScan },
): string[] {
    // No "[^" anywhere in the note means no definitions, and so no
    // duplicates. Worth checking first, because this runs on every single
    // lint (speed fix F4).
    if (!markdown.includes("[^")) return [];
    const lines = precomputed?.lines ?? normalizeEol(markdown).text.split("\n");
    const scan = precomputed?.scan ?? scanDocument(lines);
    const blocks = findDefinitionBlocks(lines, scan);
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
 * Merge every later duplicate into the FIRST definition block for that name.
 *
 * What was written after the duplicate's label becomes an indented
 * continuation line, and the duplicate's own continuation lines follow it
 * exactly as they were, blank lines included. The merged block therefore
 * renders every body, in the order they appeared in the note. The first
 * block keeps the case its name was written with.
 *
 * Anything inside protected text is never a definition. Where a duplicate is
 * cut out, the lines close up through removeLineRanges, the same as any
 * other definition block deletion.
 */
export function mergeDuplicateFootnoteDefinitions(markdown: string): string {
    if (!markdown.includes("[^")) return markdown;
    return rewriteDocument(markdown, (text, { lines, scan, blocks }) => {

        const groups = new Map<string, typeof blocks>();
        for (const block of blocks) {
            const folded = block.name.toLowerCase();
            const group = groups.get(folded);
            if (group) group.push(block);
            else groups.set(folded, [block]);
        }

        // Two things are collected here: the continuation lines to add,
        // keyed by the LAST line of the block they are joining, and the
        // ranges of lines the duplicates occupy, to be cut out.
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
        if (doomed.length === 0) return text;

        // Glue the new lines onto the first block's last line BEFORE
        // cutting the duplicates out. removeLineRanges does not look inside
        // a line, so one entry holding several lines joined together passes
        // through it untouched and comes apart again at the final join.
        const mutated = lines.slice();
        for (const [end, appended] of appendAfter) {
            mutated[end] = [mutated[end], ...appended].join("\n");
        }
        const out = removeLineRanges(mutated, doomed);
        // Cutting a duplicate at the very end of the note can leave behind
        // the blank line that used to separate it. Never hand back more
        // blank lines at the end than the note started with.
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
        return out.join("\n");
    });
}

/** This rule's catalogue entry. The id matches the settings toggle's rule. */
export const mergeDuplicateDefinitionsRule: FootnoteRule = {
    id: "merge-duplicate-definitions",
    name: "Merge duplicate definitions",
    description:
        "Merge every later definition of an already-defined footnote into the first one, keeping each body as a continuation line (Obsidian renders only the last definition otherwise).",
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
