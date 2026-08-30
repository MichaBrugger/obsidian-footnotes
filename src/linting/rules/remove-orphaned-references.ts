import {
    definitionLabelWithName,
    isValidFootnoteName,
    referenceOccurrences,
} from "../../parsing/footnote-grammar";
import {
    maskProtectedLines,
    normalizeEol,
    scanDocument,
    restoreEol,
} from "../../parsing/markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";

// Orphaned REFERENCES - the mirror image of reindex's orphaned definitions
// (requested 2026-08-10): a "[^5]" with no "[^5]:" line anywhere renders as
// literal text in Obsidian, so linting either alerts about them (the
// default) or, with the "Orphaned references" setting on Delete, removes them
// from the text. Shared exclusions, in both modes:
//  - ids are case-insensitive, so a definition in any casing counts;
//  - invalid names (spaces/backticks) are not footnotes to Obsidian either -
//    deleting "[^my note]" would destroy literal prose, so they are left
//    alone (the creation path already warns about them);
//  - the note's own bare-prefix placeholder ("[^2.]" under prefix "2.") is
//    an IN-PROGRESS footnote mid-naming, owned by the unnamed-reference alert -
//    deleting it out from under the user's caret would be data loss.

/** The definition names present in the note, case-folded - column-0 labels and blockquoted/callout ones (C22). definitionLabelWithName owns the masked-scan/raw-re-slice invariant. */
function definitionNamesFolded(lines: string[], masked: string[]): Set<string> {
    const names = new Set<string>();
    for (let i = 0; i < masked.length; i++) {
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (hit) names.add(hit.name.toLowerCase());
    }
    return names;
}

/** Whether this reference occurrence is an orphan the setting should act on. */
function isOrphan(
    name: string,
    definitions: Set<string>,
    orphanSafeFolded: string,
): boolean {
    const folded = name.toLowerCase();
    if (definitions.has(folded)) return false;
    if (!isValidFootnoteName(name)) return false;
    if (orphanSafeFolded !== "" && folded === orphanSafeFolded) return false;
    return true;
}

/**
 * Distinct names of orphaned references in first-appearance order, each in its
 * first-seen casing - the alert's list. `orphanSafePrefix` is the note's own valid
 * footnote-prefix while the prefix feature is on ("" otherwise).
 */
export function orphanedFootnoteReferenceNames(
    markdown: string,
    orphanSafePrefix = "",
    // the post-lint alerts share ONE normalize/scan/mask across all three
    // alert helpers (2026-08-11 review perf item); direct callers omit it
    precomputed?: { lines: string[]; masked: string[] },
): string[] {
    // no "[^" anywhere means no references (and no orphans) - this alert
    // scan runs on every lint (perf F4)
    if (!markdown.includes("[^")) return [];
    const lines = precomputed?.lines ?? normalizeEol(markdown).text.split("\n");
    const masked = precomputed?.masked ?? maskProtectedLines(lines);
    const definitions = definitionNamesFolded(lines, masked);
    const orphanSafeFolded = orphanSafePrefix.toLowerCase();

    const names: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < masked.length; i++) {
        for (const { name } of referenceOccurrences(lines[i], masked[i])) {
            if (!isOrphan(name, definitions, orphanSafeFolded)) continue;
            const folded = name.toLowerCase();
            if (!seen.has(folded)) {
                seen.add(folded);
                names.push(name);
            }
        }
    }
    return names;
}

/**
 * Every orphaned reference occurrence removed from the text (definitions,
 * protected regions, and the exclusions above untouched). Spacing seams
 * heal: "a [^1] b" → "a b", and a reference that was the last thing on its
 * line takes the space before it along - but spaces the line already ended
 * with (a markdown hard break) survive.
 */
export function removeOrphanedFootnoteReferences(
    markdown: string,
    orphanSafePrefix = "",
): string {
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const definitions = definitionNamesFolded(lines, masked);
    const orphanSafeFolded = orphanSafePrefix.toLowerCase();

    const out = lines.map((line, i) => {
        if (scan.isProtected[i]) return line;
        let result = "";
        let copied = 0;
        let changed = false;
        for (const { name, start, end } of referenceOccurrences(
            line,
            masked[i],
        )) {
            if (!isOrphan(name, definitions, orphanSafeFolded)) continue;
            result += line.slice(copied, start);
            copied = end;
            // seam: a space directly after the cut collapses when the cut
            // already ends on a space (or on the start of the line)
            if (
                line[copied] === " " &&
                (result === "" || result.endsWith(" "))
            ) {
                copied++;
            }
            changed = true;
        }
        if (!changed) return line;
        const tail = line.slice(copied);
        // a reference that closed the line leaves its leading space dangling;
        // a non-empty tail means any trailing spaces were already there
        return tail === "" ? result.replace(/[ \t]+$/, "") : result + tail;
    });
    if (out.every((line, i) => line === lines[i])) return markdown;

    // Deleting reference text can re-classify a DISTANT line: blanking the
    // paragraph between a definition and an indented chunk turns that chunk
    // from indented CODE into a definition CONTINUATION (Obsidian continues
    // a definition across any run of blank lines - verified against
    // metadataCache, 2026-08-10; found by the idempotence property), so the
    // next lint pass would edit text this pass promised to protect. A
    // deletion that changes ANY other line's protection classification is
    // refused outright; the orphans stay for the user to resolve.
    const scanAfter = scanDocument(out);
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] !== scanAfter.isProtected[i]) return markdown;
    }
    return restoreEol(out.join("\n"), eol);
}

/** Linter-shaped registry entry; the option is the note's safe bare prefix. */
export const removeOrphanedReferencesRule: FootnoteRule<{ orphanSafePrefix?: string }> =
    {
        id: "remove-orphaned-references",
        name: "Remove orphaned references",
        description:
            "Delete footnote references that have no definition anywhere in the note.",
        ignoreTypes: [
            IgnoreType.Code,
            IgnoreType.InlineCode,
            IgnoreType.Math,
            IgnoreType.Yaml,
            IgnoreType.HtmlComment,
        ],
        examples: [
            {
                description: "A reference with no definition is removed",
                before: "keep[^1] drop[^9] end\n\n[^1]: one",
                after: "keep[^1] drop end\n\n[^1]: one",
                options: {},
            },
            {
                description: "A definition in any casing keeps its references",
                before: "see[^Note]\n\n[^note]: n",
                after: "see[^Note]\n\n[^note]: n",
                options: {},
            },
        ],
        apply: (text, options) =>
            removeOrphanedFootnoteReferences(text, options.orphanSafePrefix ?? ""),
    };
