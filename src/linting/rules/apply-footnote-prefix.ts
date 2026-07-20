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
// footnote-prefix property stay plain-numbered — this renames them to carry
// the prefix. Plain numbered footnotes convert in first-appearance order
// (markers first, then orphaned definitions), numbered AFTER the highest
// existing prefixed footnote so nothing collides. Named and already-prefixed
// footnotes are untouched; definition ordering is reindex's job, so blocks
// stay where they are. Runs after reindex in the pipeline, which makes the
// converted numbers follow reading order. Idempotent by construction: a
// valid prefix can't end in a digit, so a prefixed name is never all-digits
// and a second pass finds nothing plain-numbered to convert.

/** Rename every plain numbered footnote to carry `prefix`. Invalid prefixes (the lint guard cancels these earlier) change nothing. */
export function applyFootnotePrefix(markdown: string, prefix: string): string {
    if (!prefix || footnotePrefixProblem(prefix) !== null) return markdown;

    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const isProtected = protectedLines(lines);
    const blocks = findDefinitionBlocks(lines, isProtected);

    // distinct plain-numbered names by first marker appearance, then
    // orphaned definitions in definition order (numbers have no casing, so
    // no case folding is needed here)
    const order: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        if (isProtected[i]) continue;
        for (const match of footnoteMarkerMatches(maskInlineRegions(lines[i]))) {
            const id = match[1];
            if (/^\d+$/.test(id) && !seen.has(id)) {
                seen.add(id);
                order.push(id);
            }
        }
    }
    for (const block of blocks) {
        if (/^\d+$/.test(block.name) && !seen.has(block.name)) {
            seen.add(block.name);
            order.push(block.name);
        }
    }
    if (order.length === 0) return markdown;

    // continue after the highest footnote already carrying the prefix
    let nextNumber = computeNextFootnoteNumber(text, prefix);
    const renames = new Map<string, string>();
    for (const name of order) {
        renames.set(name, `${prefix}${nextNumber++}`);
    }

    const rewritten = lines.map((line, i) => {
        if (isProtected[i]) return line;
        const masked = maskInlineRegions(line);
        let result = "";
        let copied = 0;
        for (const match of footnoteMarkerMatches(masked)) {
            const newName = renames.get(match[1]);
            if (newName === undefined) continue;
            const start = match.index ?? 0;
            result += line.slice(copied, start) + `[^${newName}]`;
            copied = start + match[0].length;
        }
        result += line.slice(copied);
        const definition = line.match(DefinitionStart);
        if (definition) {
            const newName = renames.get(definition[1]);
            if (newName !== undefined) {
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
        "Rename plain numbered footnotes to carry the note's footnote-prefix property, numbering after any existing prefixed footnotes.",
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
    ],
    apply: (text, options = {}) => applyFootnotePrefix(text, options.prefix ?? ""),
};
