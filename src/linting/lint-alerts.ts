import type FootnotePlugin from "../main";
import { footnotePrefix, footnotePrefixProblem } from "../parsing/footnote-prefix";
import {
    definitionLabelIn,
    definitionLabelWithName,
    definitionStartLines,
    DocumentScan,
    findDefinitionBlocks,
    maskProtectedLines,
    normalizeEol,
    quotedDefinitionEnd,
    scanDocument,
} from "../parsing/markdown-scan";
import {
    escapedAt,
    footnoteNameProblem,
    InvalidNameCharacters,
    quotedDefinitionLabel,
    quotedReference,
    referenceOccurrences,
    referenceText,
} from "../parsing/footnote-grammar";
import { inlineFootnoteSpanAt } from "../commands/inline-footnotes";
import { duplicateFootnoteDefinitionNames } from "./rules/merge-duplicate-definitions";
import { orphanedFootnoteDefinitionNames } from "./rules/remove-orphaned-definitions";
import {
    lazyDefinitionLabelNames,
    orphanedFootnoteReferenceNames,
    removeOrphanedFootnoteReferences,
} from "./rules/remove-orphaned-references";

import { addReferenceOrDeleteDefinition, showNotice } from "../editor/notice";
// The lint alerts, shown after a lint has run. Every way of starting a lint
// ends here, reporting what the rules could not fix, or were not allowed
// to: empty "[^]" placeholders, orphans while their delete toggles are off,
// duplicates while merging is off.
//
// An alert only reports; it never changes the note, so it is not a lint
// rule. The 2026-08-07 mandate that rules stay independent of each other is
// about the chain of rules that rewrite the text, which lives in linter.ts.
// This file was split out of linter.ts on 2026-08-12.

/**
 * How many unnamed footnote references the note has, outside code and
 * frontmatter.
 *
 * There are two shapes. The plain empty "[^]", and, when `prefix` is given,
 * the same thing in a note that uses prefixes: a bare prefix with nothing
 * after it, such as "[^3.]" in a note whose prefix is "3.".
 *
 * Both are footnotes the user started and never finished naming. No rule can
 * fix them: "[^]" does not match the reference patterns at all, and a bare
 * prefix is impossible to tell from a name somebody chose. So the lint says
 * so instead, and the user should name or delete the fragment.
 */
export function countEmptyFootnoteReferences(
    markdown: string,
    prefix = "",
    // The alerts all share ONE pass of normalizing the line endings and
    // building the masked twin, done once and handed round (2026-08-11
    // review, a speed fix). Anything calling this on its own leaves it out.
    masked?: string[],
): number {
    // Obsidian matches footnote names without regard to case, and so does
    // every other prefix comparison in the plugin, so "[^P.]" under the
    // prefix "p." is the placeholder too. The search folds case whenever a
    // prefix is in play (Kimi sweep 2026-09-13); "[^]" has no letters to
    // fold.
    const fold = (text: string) => (prefix ? text.toLowerCase() : text);
    const needles = prefix ? ["[^]", fold(referenceText(prefix))] : ["[^]"];
    // Masking can only ever take these strings away, never add one, so if
    // the raw text does not contain them at all, neither will the masked
    // twin. This runs on every single lint and most notes have no "[^]" in
    // them, so bailing out here skips building the masked twin for the
    // whole note (speed fix F4).
    const haystack = fold(markdown);
    if (!needles.some((needle) => haystack.includes(needle))) return 0;
    let count = 0;
    const lines =
        masked ?? maskProtectedLines(normalizeEol(markdown).text.split("\n"));
    for (const raw of lines) {
        const line = fold(raw);
        for (const needle of needles) {
            for (
                let i = 0;
                (i = line.indexOf(needle, i)) !== -1;
                i += needle.length
            ) {
                // a backslash in front of the "[" makes it literal text,
                // as everywhere else in the plugin: "\[^]" is prose about
                // footnote syntax, not an abandoned placeholder (Kimi hunt
                // cycle 1, 2026-09-16; renders literally in Reading view)
                if (escapedAt(raw, i)) continue;
                count++;
            }
        }
    }
    return count;
}

/**
 * The note's own prefix, so the alerts can also count its bare-prefix
 * placeholder. Empty unless the prefix feature is on and the note's prefix
 * is valid.
 */
export function orphanSafePrefixFor(
    plugin: FootnotePlugin,
    markdown: string,
): string {
    if (!plugin.settings.enableFootnotePrefix) return "";
    const prefix = footnotePrefix(markdown);
    return prefix && footnotePrefixProblem(prefix) === null ? prefix : "";
}

// Unlike the orphan and duplicate alerts, this one is not tied to a
// setting. No rule is ever allowed to delete an empty reference, so there
// is no toggle that could make this alert unnecessary; it always speaks.
function noticeEmptyReferences(
    markdown: string,
    prefix: string,
    masked: string[],
) {
    const count = countEmptyFootnoteReferences(markdown, prefix, masked);
    if (count === 0) return;
    const hint = prefix ? `"[^]" or the bare prefix "[^${prefix}]"` : '"[^]"';
    showNotice(
        count === 1
            ? `This note has an unnamed footnote reference (${hint}). Give it a name or delete it.`
            : `This note has ${count} unnamed footnote references (${hint}). Give them names or delete them.`,
        8000,
    );
}

/**
 * Format names for a notice as `"[^a]", "[^b]", "[^c]"`.
 *
 * EVERY name is spelled out, each in quotes, matching every other notice
 * that names a footnote (Jason asked for that consistency, 2026-09-04). The
 * list used to stop after three names and trail off; the user needs all of
 * them to go and fix them (his L-series pass, 2026-09-08).
 */
function referenceList(names: string[]): string {
    return names.map(quotedReference).join(", ");
}

/**
 * The same list in label form, `"[^a]:", "[^b]:"`. Used by the one alert
 * whose fix is made on the label LINE itself.
 */
function labelList(names: string[]): string {
    return names.map(quotedDefinitionLabel).join(", ");
}

// A "[^x]:" line directly under a line of prose is not a definition to
// Obsidian; it is more paragraph text (the prose-label rule, 2026-09-09).
// The definition the user typed is one blank line short of existing.
//
// These need their own alert because the general missing-definition alert
// would tell the user to "write its definition", which is the wrong advice:
// they already wrote it. So these names get this alert and are left out of
// that one. The orphan rule exempts them too, from its alert and from
// deletion alike. Like every alert, this one is never silent.
function noticeLazyDefinitions(lines: string[], scan: DocumentScan, masked: string[], starts: boolean[]) {
    const names = lazyDefinitionLabelNames(lines, scan, masked, starts);
    if (names.length === 0) return;
    showNotice(
        names.length === 1
            ? `This note has a footnote definition that Obsidian reads as plain text because there is no blank line above it (${labelList(names)}). Add a blank line above it.`
            : `This note has ${names.length} footnote definitions that Obsidian reads as plain text because there is no blank line above them (${labelList(names)}). Add a blank line above each.`,
        8000,
    );
}

// The alert half of "Delete orphaned references". While that toggle is off,
// the lint reports orphaned references instead of deleting them: an orphan
// is never passed over in silence.
//
// With the toggle ON, an orphan that is still in the note after the lint
// is one the rule REFUSED to delete, because taking it out would change how
// a line near it is read (the reclassification guard in
// remove-orphaned-references.ts). The alert used to assume the toggle had
// dealt with every orphan and said nothing, so the survivor was neither
// deleted nor reported, on that save and every later one (Kimi and Claude
// sweeps 2026-09-13; ADR 2, lint is never silent). Now it says the rule
// left it, and why. A single-rule command such as Move definitions to
// bottom also ends here, and an orphan a full lint WOULD delete is not
// reported after one of those: the next lint takes it, as before.
function noticeOrphanedReferences(
    plugin: FootnotePlugin,
    markdown: string,
    prefix: string,
    precomputed: { lines: string[]; masked: string[]; scan: DocumentScan; starts: boolean[] },
) {
    const names = orphanedFootnoteReferenceNames(markdown, prefix, precomputed);
    if (names.length === 0) return;
    if (plugin.settings.lintDeleteOrphanedReferences) {
        if (removeOrphanedFootnoteReferences(markdown, prefix) !== markdown) return;
        showNotice(
            names.length === 1
                ? `This note has a footnote reference with no definition (${referenceList(names)}) that the lint left in place: deleting it would change how the lines around it are read. Write its definition or delete the reference by hand.`
                : `This note has ${names.length} footnote references with no definition (${referenceList(names)}) that the lint left in place: deleting them would change how the lines around them are read. Write their definitions or delete the references by hand.`,
            8000,
        );
        return;
    }
    showNotice(
        names.length === 1
            ? `This note has a footnote reference with no definition (${referenceList(names)}). Write its definition or delete the reference.`
            : `This note has ${names.length} footnote references with no definition (${referenceList(names)}). Write their definitions or delete the references.`,
        8000,
    );
}

// Orphaned definitions that were kept get an alert as well (ruling: Jason,
// 2026-08-10). Every kind of orphan is either deleted or reported; none is
// quietly left in place.
function noticeOrphanedDefinitions(
    plugin: FootnotePlugin,
    markdown: string,
    precomputed: { lines: string[]; scan: DocumentScan; masked: string[]; starts: boolean[] },
) {
    if (plugin.settings.lintDeleteOrphanedDefinitions) return;
    const names = orphanedFootnoteDefinitionNames(markdown, precomputed);
    if (names.length === 0) return;
    showNotice(
        names.length === 1
            ? `This note has a footnote definition nothing references (${referenceList(names)}). ${addReferenceOrDeleteDefinition(names[0])}`
            : `This note has ${names.length} footnote definitions nothing references (${referenceList(names)}). Add their references in the text, or delete the definitions.`,
        8000,
    );
}

// The alert half of "Merge duplicate definitions". While that toggle is
// off, the lint reports duplicates instead of merging them; like orphans,
// they are never passed over in silence (Jason's policy, 2026-08-12).
// Duplicates matter because Obsidian renders only the LAST definition of a
// name, so the earlier ones simply do not appear.
function noticeDuplicateDefinitions(
    plugin: FootnotePlugin,
    markdown: string,
    precomputed: { lines: string[]; scan: DocumentScan },
) {
    if (plugin.settings.lintMergeDuplicateDefinitions) return;
    const names = duplicateFootnoteDefinitionNames(markdown, precomputed);
    if (names.length === 0) return;
    showNotice(
        names.length === 1
            ? `This note defines ${referenceList(names)} more than once. Obsidian renders only the last definition. Merge them, or turn on "Merge duplicate definitions".`
            : `This note defines ${names.length} footnotes more than once (${referenceList(names)}). Obsidian renders only each one's last definition. Merge them, or turn on "Merge duplicate definitions".`,
        8000,
    );
}

/**
 * The note's footnote names that a footnote is not allowed to have: ones
 * containing whitespace, backticks or "#". It looks at live references and
 * definition labels, and lists each name once, treating upper and lower
 * case as the same.
 *
 * Creating or renaming a footnote refuses such a name up front. But a name
 * the user typed by hand, or one that was already in the note, cannot be
 * fixed automatically: there is no telling which name they meant. So the
 * lint reports it instead (Jason's L-series pass, 2026-09-08).
 *
 * Fakes inside protected text do not count. Names containing brackets never
 * get here, because such text cannot form a reference in the first place.
 */
export function invalidFootnoteNames(
    lines: string[],
    scan: DocumentScan,
    masked: string[],
    starts: boolean[] = definitionStartLines(lines, scan, (i) => masked[i]),
): string[] {
    const names: string[] = [];
    const seen = new Set<string>();
    const consider = (name: string) => {
        const folded = name.toLowerCase();
        if (seen.has(folded) || footnoteNameProblem(name) === null) return;
        seen.add(folded);
        names.push(name);
    };
    for (let i = 0; i < lines.length; i++) {
        for (const { name } of referenceOccurrences(lines[i], masked[i], starts[i])) consider(name);
        // the line's own definition label, at column 0 or behind a
        // blockquote or callout marker: a quoted definition is as real as
        // a column-0 one (the C22 ruling), and used to go unchecked here
        // because only column-0 blocks were read (Kimi sweep 2026-09-13)
        if (!starts[i]) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (hit) consider(hit.name);
    }
    for (const block of findDefinitionBlocks(lines, scan, masked, starts)) consider(block.name);
    return names;
}

function noticeInvalidNames(lines: string[], scan: DocumentScan, masked: string[], starts: boolean[]) {
    const names = invalidFootnoteNames(lines, scan, masked, starts);
    if (names.length === 0) return;
    showNotice(
        names.length === 1
            ? `This note has a footnote with an invalid name (${referenceList(names)}). ${InvalidNameCharacters}`
            : `This note has ${names.length} footnotes with invalid names (${referenceList(names)}). ${InvalidNameCharacters}`,
        8000,
    );
}

/**
 * The names of definitions that have another footnote INSIDE them: a live
 * reference or an inline footnote, either on the label line after the label
 * itself, or on one of the continuation lines.
 *
 * A nested footnote is one footnote sitting inside another footnote's text.
 * The plugin refuses to create one anywhere (Jason's ruling, 2026-08-24,
 * after Discord confirmed nobody wants them). But nesting the user typed by
 * hand, or that was already in the note, cannot be undone automatically
 * without throwing text away, so the lint reports it instead. That is the
 * same never-silent policy orphans and duplicates follow.
 *
 * Fakes inside protected text do not count.
 */
export function nestedFootnoteDefinitionNames(
    lines: string[],
    scan: DocumentScan,
    masked: string[],
    starts: boolean[] = definitionStartLines(lines, scan, (i) => masked[i]),
): string[] {
    const names: string[] = [];
    // One entry per NAME, ignoring case, the same way the duplicate and
    // orphan alerts do it. A name defined twice with both copies nested
    // used to be reported twice, which made the notice's count too high
    // (bug hunt, 2026-08-25).
    const seen = new Set<string>();
    // Every definition's text: the column-0 blocks, and the quoted
    // definitions, which never form blocks but are as real as the others
    // (the C22 ruling) and used to be skipped here (Kimi sweep
    // 2026-09-13). A quoted definition's text is the rest of its label
    // line and its continuation inside the quote (quotedDefinitionEnd).
    const spans = findDefinitionBlocks(lines, scan, masked, starts).map((block) => ({
        name: block.name,
        start: block.start,
        end: block.end,
    }));
    for (let i = 0; i < lines.length; i++) {
        if (!starts[i]) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (!hit?.label.quoted) continue;
        // a label after a "%%" closer has its line to itself
        spans.push({
            name: hit.name,
            start: i,
            end: hit.label.afterCloser ? i : quotedDefinitionEnd(lines, scan, starts, i),
        });
    }
    for (const span of spans) {
        let nested = false;
        for (let i = span.start; i <= span.end && !nested; i++) {
            const startAt =
                i === span.start
                    ? definitionLabelIn(lines[i])?.labelEnd ?? 0
                    : 0;
            nested =
                referenceOccurrences(lines[i], masked[i]).some(
                    (occurrence) => occurrence.start >= startAt,
                ) || lineHasInlineFootnote(masked[i]);
        }
        if (nested && !seen.has(span.name.toLowerCase())) {
            seen.add(span.name.toLowerCase());
            names.push(span.name);
        }
    }
    return names;
}


/**
 * True when this masked line holds a live inline footnote, the self-
 * contained "^[...]" form.
 */
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
    starts: boolean[],
) {
    const names = nestedFootnoteDefinitionNames(lines, scan, masked, starts);
    if (names.length === 0) return;
    showNotice(
        names.length === 1
            ? `This note has a footnote nested inside another footnote's definition (${referenceList(names)}). Nested footnotes don't survive export and most tools can't read them. Move it into the text.`
            : `This note has footnotes nested inside ${names.length} footnote definitions (${referenceList(names)}). Nested footnotes don't survive export and most tools can't read them. Move them into the text.`,
        8000,
    );
}

// Every way of starting a lint calls this with the text as it stands AFTER
// the lint, so the alerts speak whether or not any rule changed anything.
//
/**
 * The names of definitions written inside a "%%" block comment, in order,
 * each once. Obsidian never shows a definition there (its reference half
 * still counts, so the footnote may render from a real definition
 * elsewhere, or not at all), and the user almost certainly meant it to be
 * seen, so the lint names it (Jason's ruling A1, 2026-09-15).
 */
export function commentedDefinitionNames(markdown: string): string[] {
    const lines = normalizeEol(markdown).text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const names: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        if (!scan.inCommentBlock[i] || scan.isProtected[i]) continue;
        // the closer line's text after "%%" is outside the comment
        if (scan.commentBlockCloseAt[i] >= 0) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (!hit) continue;
        const folded = hit.name.toLowerCase();
        if (seen.has(folded)) continue;
        seen.add(folded);
        names.push(hit.name);
    }
    return names;
}

function noticeCommentedDefinitions(markdown: string) {
    const names = commentedDefinitionNames(markdown);
    if (names.length === 0) return;
    showNotice(
        names.length === 1
            ? `This note has a footnote definition inside a %% comment (${labelList(names)}), where Obsidian never shows it. Move it out of the comment.`
            : `This note has ${names.length} footnote definitions inside %% comments (${labelList(names)}), where Obsidian never shows them. Move them out of the comments.`,
        8000,
    );
}

// A pipe-delimited table row: a line that starts and ends with "|" after
// up to three spaces of indent. Close enough for an alert; the scanner's
// definition-start rule uses the same shape.
const TableRow = /^ {0,3}\|.*\|\s*$/;

/**
 * The names of definitions that sit INSIDE a table: a table row directly
 * above the label and another directly below it. Obsidian ends the table
 * at the label and folds the rows after it into the footnote's text as a
 * lazy continuation, so the table is broken either way. The plugin does
 * not move the label; it tells the user (Jason's ruling A2, 2026-09-15).
 */
export function definitionsInsideTableNames(markdown: string): string[] {
    const lines = normalizeEol(markdown).text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);
    const names: string[] = [];
    const seen = new Set<string>();
    for (let i = 1; i + 1 < lines.length; i++) {
        if (!starts[i]) continue;
        if (!TableRow.test(lines[i - 1]) || !TableRow.test(lines[i + 1])) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (!hit) continue;
        const folded = hit.name.toLowerCase();
        if (seen.has(folded)) continue;
        seen.add(folded);
        names.push(hit.name);
    }
    return names;
}

function noticeDefinitionsInsideTables(markdown: string) {
    const names = definitionsInsideTableNames(markdown);
    if (names.length === 0) return;
    showNotice(
        names.length === 1
            ? `This note has a footnote definition inside a table (${labelList(names)}); the rows after it become part of the footnote's text. Move it below the table.`
            : `This note has ${names.length} footnote definitions inside tables (${labelList(names)}); the rows after each become part of its text. Move them below the tables.`,
        8000,
    );
}

// The line-ending normalize, the scan, the masked twin and the
// definition-start pass are all done once here and shared by every alert.
// Each alert used to work them out again for itself, which came to about
// 40% of the time a lint took, noticeable on every footnote created with
// lint-on-footnote-creation on (2026-08-11 review, a speed fix). The
// definition starts were added to the shared bundle on 2026-09-09, when the
// prose-label rule turned out to have quietly added seven more repeats.
export function noticeLintAlerts(plugin: FootnotePlugin, markdown: string) {
    // Every one of the alerts is looking for text containing "[^", so a
    // note without those two characters anywhere cannot trigger any of them
    if (!markdown.includes("[^")) return;
    const prefix = orphanSafePrefixFor(plugin, markdown);
    const lines = normalizeEol(markdown).text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);
    noticeEmptyReferences(markdown, prefix, masked);
    noticeOrphanedReferences(plugin, markdown, prefix, { lines, masked, scan, starts });
    noticeLazyDefinitions(lines, scan, masked, starts);
    noticeCommentedDefinitions(markdown);
    noticeDefinitionsInsideTables(markdown);
    noticeOrphanedDefinitions(plugin, markdown, { lines, scan, masked, starts });
    noticeDuplicateDefinitions(plugin, markdown, { lines, scan });
    noticeNestedFootnotes(lines, scan, masked, starts);
    noticeInvalidNames(lines, scan, masked, starts);
}
