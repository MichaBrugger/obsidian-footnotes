import { Notice } from "obsidian";

import type FootnotePlugin from "../main";
import { footnotePrefix, footnotePrefixProblem } from "../parsing/footnote-prefix";
import {
    definitionLabelIn,
    DocumentScan,
    findDefinitionBlocks,
    maskProtectedLines,
    normalizeEol,
    scanDocument,
} from "../parsing/markdown-scan";
import { referenceOccurrences } from "../parsing/footnote-grammar";
import { inlineFootnoteSpanAt } from "../commands/inline-footnotes";
import { duplicateFootnoteDefinitionNames } from "./rules/merge-duplicate-definitions";
import { orphanedFootnoteDefinitionNames } from "./rules/remove-orphaned-definitions";
import { orphanedFootnoteReferenceNames } from "./rules/remove-orphaned-references";

// The post-lint alert tail: every lint entry point reports what the rules
// could not (or were not allowed to) fix - empty "[^]" placeholders,
// orphans while their delete toggles are off, duplicates while merging is
// off. Alerts are reporting, not lint RULES; the rules-stay-independent
// mandate (2026-08-07) is about the transform pipeline, which lives in
// linter.ts. Split out of linter.ts 2026-08-12.

/**
 * Occurrences of unnamed footnote references outside code and frontmatter: the
 * abandoned empty "[^]", plus - when `prefix` is given - its prefix-era twin,
 * the untouched bare-prefix placeholder ("[^3.]" under prefix "3."). Both
 * are footnotes the user started and never named; the rules can't fix them
 * ("[^]" is invisible to the reference regexes, and a bare prefix is
 * indistinguishable from a deliberate name), so the lint paths alert
 * instead - the user should name or delete the fragment ASAP.
 */
export function countEmptyFootnoteReferences(
    markdown: string,
    prefix = "",
    // the post-lint alerts share ONE normalize/mask pass across all the
    // alert helpers (2026-08-11 review perf item); direct callers omit it
    masked?: string[],
): number {
    const needles = prefix ? ["[^]", `[^${prefix}]`] : ["[^]"];
    // masking only ever REMOVES needle occurrences, so a raw miss is
    // definitive - this runs on every lint, and most notes have no "[^]"
    // (perf F4: skip the whole-document masking pass)
    if (!needles.some((needle) => markdown.includes(needle))) return 0;
    let count = 0;
    const lines =
        masked ?? maskProtectedLines(normalizeEol(markdown).text.split("\n"));
    for (const line of lines) {
        for (const needle of needles) {
            for (
                let i = 0;
                (i = line.indexOf(needle, i)) !== -1;
                i += needle.length
            ) {
                count++;
            }
        }
    }
    return count;
}

/** The bare-prefix placeholder the alert should also count: the note's own valid prefix, only while the feature is on. */
export function orphanSafePrefixFor(
    plugin: FootnotePlugin,
    markdown: string,
): string {
    if (!plugin.settings.enableFootnotePrefix) return "";
    const prefix = footnotePrefix(markdown);
    return prefix && footnotePrefixProblem(prefix) === null ? prefix : "";
}

function noticeEmptyReferences(
    plugin: FootnotePlugin,
    markdown: string,
    prefix: string,
    masked: string[],
) {
    const count = countEmptyFootnoteReferences(markdown, prefix, masked);
    if (count === 0) return;
    const hint = prefix ? `"[^]" or the bare prefix "[^${prefix}]"` : '"[^]"';
    new Notice(
        count === 1
            ? `This note has an unnamed footnote reference (${hint}). Give it a name or delete it.`
            : `This note has ${count} unnamed footnote references (${hint}). Give them names or delete them.`,
        8000,
    );
}

/** `"[^a]", "[^b]", …` - at most three names spelled out, each in quotes like every other toast that names a footnote (Jason's consistency ask 2026-09-04), an ellipsis for the rest. */
function referenceList(names: string[]): string {
    const shown = names.slice(0, 3).map((name) => `"[^${name}]"`).join(", ");
    return names.length > 3 ? `${shown}, …` : shown;
}

// the alert half of "Delete orphaned references": while the toggle is off,
// linting reports them instead - orphans are never silent
function noticeOrphanedReferences(
    plugin: FootnotePlugin,
    markdown: string,
    prefix: string,
    precomputed: { lines: string[]; masked: string[] },
) {
    if (plugin.settings.lintDeleteOrphanedReferences) return;
    const names = orphanedFootnoteReferenceNames(markdown, prefix, precomputed);
    if (names.length === 0) return;
    new Notice(
        names.length === 1
            ? `This note has a footnote reference with no definition (${referenceList(names)}). Write its definition or delete the reference.`
            : `This note has ${names.length} footnote references with no definition (${referenceList(names)}). Write their definitions or delete the references.`,
        8000,
    );
}

// kept orphaned definitions alert too (Jason, 2026-08-10) - every orphan
// kind is either deleted or surfaced, never silently preserved
function noticeOrphanedDefinitions(
    plugin: FootnotePlugin,
    markdown: string,
    precomputed: { lines: string[]; scan: DocumentScan },
) {
    if (plugin.settings.lintDeleteOrphanedDefinitions) return;
    const names = orphanedFootnoteDefinitionNames(markdown, precomputed);
    if (names.length === 0) return;
    new Notice(
        names.length === 1
            ? `This note has a footnote definition nothing references (${referenceList(names)}). Add its reference in the text or delete the definition.`
            : `This note has ${names.length} footnote definitions nothing references (${referenceList(names)}). Add their references in the text or delete the definitions.`,
        8000,
    );
}

// the alert half of "Merge duplicate definitions": while the toggle is off,
// linting reports duplicates instead - like orphans, they are never silent
// (Jason's policy 2026-08-12; Obsidian renders only the LAST definition)
function noticeDuplicateDefinitions(
    plugin: FootnotePlugin,
    markdown: string,
    precomputed: { lines: string[]; scan: DocumentScan },
) {
    if (plugin.settings.lintMergeDuplicateDefinitions) return;
    const names = duplicateFootnoteDefinitionNames(markdown, precomputed);
    if (names.length === 0) return;
    new Notice(
        names.length === 1
            ? `This note defines ${referenceList(names)} more than once. Obsidian renders only the last definition. Merge them, or turn on "Merge duplicate definitions".`
            : `This note defines ${names.length} footnotes more than once (${referenceList(names)}). Obsidian renders only each one's last definition. Merge them, or turn on "Merge duplicate definitions".`,
        8000,
    );
}

/**
 * Names of definitions that carry a footnote INSIDE their block - a live
 * reference or inline footnote on the label line (after the label) or a
 * continuation line. Nesting is prevented at creation plugin-wide
 * (Jason's ruling 2026-08-24, Discord-confirmed nobody wants it), but
 * hand-typed and pre-existing nesting can't be fixed automatically
 * without losing content, so the lint ALERTS - the never-silent policy
 * orphans and duplicates already follow. Masked fakes don't count.
 */
export function nestedFootnoteDefinitionNames(
    lines: string[],
    scan: DocumentScan,
    masked: string[],
): string[] {
    const names: string[] = [];
    // one entry per NAME, case-folded like the duplicate/orphan siblings -
    // a name defined twice with both copies nested used to report twice,
    // inflating the notice's count (hunt 2026-08-25)
    const seen = new Set<string>();
    for (const block of findDefinitionBlocks(lines, scan.isProtected, scan)) {
        let nested = false;
        for (let i = block.start; i <= block.end && !nested; i++) {
            const startAt =
                i === block.start
                    ? definitionLabelIn(lines[i])?.labelEnd ?? 0
                    : 0;
            nested =
                referenceOccurrences(lines[i], masked[i]).some(
                    (occurrence) => occurrence.start >= startAt,
                ) || lineHasInlineFootnote(masked[i]);
        }
        if (nested && !seen.has(block.name.toLowerCase())) {
            seen.add(block.name.toLowerCase());
            names.push(block.name);
        }
    }
    return names;
}

/** Whether the masked line carries a live inline footnote span. */
function lineHasInlineFootnote(masked: string): boolean {
    for (let i = 0; i < masked.length - 1; i++) {
        if (masked[i] !== "^" || masked[i + 1] !== "[") continue;
        const span = inlineFootnoteSpanAt(masked, i + 2);
        if (span?.open === i) return true;
        if (span) i = span.close;
    }
    return false;
}

function noticeNestedFootnotes(
    lines: string[],
    scan: DocumentScan,
    masked: string[],
) {
    const names = nestedFootnoteDefinitionNames(lines, scan, masked);
    if (names.length === 0) return;
    new Notice(
        names.length === 1
            ? `This note has a footnote nested inside another footnote's definition (${referenceList(names)}). Nested footnotes don't survive export and most tools can't read them. Move it into the text.`
            : `This note has footnotes nested inside ${names.length} footnote definitions (${referenceList(names)}). Nested footnotes don't survive export and most tools can't read them. Move them into the text.`,
        8000,
    );
}

// every lint entry point calls this with the POST-lint text, so the alerts
// fire whether or not the rules changed anything. ONE normalize/scan/mask
// is shared by all the alerts (2026-08-11 review perf item: the alerts
// each re-derived it - ~40% of a lint's wall time, felt on every creation
// with lint-on-footnote-creation enabled).
export function noticeLintAlerts(plugin: FootnotePlugin, markdown: string) {
    // every alert's own raw gate requires a "[^" (all its needles carry one)
    if (!markdown.includes("[^")) return;
    const prefix = orphanSafePrefixFor(plugin, markdown);
    const lines = normalizeEol(markdown).text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    noticeEmptyReferences(plugin, markdown, prefix, masked);
    noticeOrphanedReferences(plugin, markdown, prefix, { lines, masked });
    noticeOrphanedDefinitions(plugin, markdown, { lines, scan });
    noticeDuplicateDefinitions(plugin, markdown, { lines, scan });
    noticeNestedFootnotes(lines, scan, masked);
}
