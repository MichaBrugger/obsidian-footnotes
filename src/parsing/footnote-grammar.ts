import { definitionLabelIn, maskProtectedLines } from "./markdown-scan";

// The reference GRAMMAR: what counts as a "[^name]" reference, how names
// are compared, and the autonumbering scan. Pure text functions with no
// editor or plugin dependencies - a LEAF module (only markdown-scan below
// it), so the lint rules and the command cascade can both import it
// without the import cycles the old all-in-one file forced (split
// 2026-08-11, see .claude/plans/split-insert-or-navigate.md).

/** Every footnote reference SHAPE (numbered or named); the definition-label exclusion is positional - see footnoteReferenceMatches. /g: read with matchAll, never test/exec (lastIndex is stateful). */
export const AllReferences = /\[\^([^[\]]+)\]/g;
/** Numbered references AND numbered definitions - both reserve their number for autonumbering. */
const AllNumberedReferences = /\[\^(\d+)\]/g;
/** Pulls the name out of a single reference string; the name is match[2]. */
export const ExtractNameFromFootnote = /(\[\^)([^[\]]+)(?=\])/;

/**
 * Reference occurrences on a single line - every "[^id]" EXCEPT a definition's
 * own "[^id]:" label at column 0. A "[^id]:" appearing MID-line is a live
 * reference followed by a literal colon (exactly how Obsidian renders it),
 * so it counts as a reference; only a column-0 label is a definition. Excluding
 * definitions positionally (rather than by the old `(?!:)` lookahead, which
 * also dropped genuine mid-line references sitting before a colon) is the
 * whole point. Pass the line already code-masked when code must be ignored.
 * Footnote ids are case-insensitive in Obsidian, but casing is preserved
 * here - callers fold case only when comparing identities.
 */
export function footnoteReferenceMatches(line: string): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];
    for (const match of line.matchAll(AllReferences)) {
        const start = match.index;
        if (start === 0 && line[match[0].length] === ":") continue;
        // a backslash-escaped "[" is literal text per CommonMark - the
        // "reference" is prose the user typed on purpose (bug-escaped-marker)
        if (escapedAt(line, start)) continue;
        // "^[" opens an INLINE footnote, so the bracket belongs to it:
        // "^[^literal]" is inline-footnote content, not a reference
        // (bug-inline-footnote-double-parse) - unless the caret itself is
        // escaped ("\^[^x]" is a literal caret followed by a real reference)
        if (line[start - 1] === "^" && !escapedAt(line, start - 1)) continue;
        matches.push(match);
    }
    return matches;
}

/** One reference occurrence from referenceOccurrences: the raw name plus the span of the whole "[^name]". */
export interface ReferenceOccurrence {
    /** The name exactly as typed - casing preserved; fold to compare identities. */
    name: string;
    /** Index of the opening "[". */
    start: number;
    /** Index just past the closing "]". */
    end: number;
}

/**
 * The definition label on `line`, matched against its MASKED twin but
 * with the name re-sliced from the RAW line - the label-side twin of
 * referenceOccurrences below, carrying the same bug-masked-name-identity
 * invariant: a code span inside the name masks to NULs, and a NUL-bearing
 * name can never equal the raw reference it must pair with. The label's
 * positions index into both twins (masking preserves indices). Null when
 * the masked line carries no label. (rename-footnote keeps its own
 * raw-gate-first variant: it needs the RAW label's positions before the
 * masked twin exists, then masked-confirms liveness.)
 */
export function definitionLabelWithName(line: string, masked: string) {
    const label = definitionLabelIn(masked);
    // Stryker disable next-line ConditionalExpression: a label visible on the masked twin is always visible at the SAME positions on the raw line (masking only writes NULs, and NULs can't spell "[^" or "]:"), so forcing the fallback is behavior-identical - the fast path is perf
    if (label) return { label, name: line.slice(label.nameStart, label.nameEnd) };
    // The masked twin can LOSE a real label: a backtick inside the NAME
    // pairing with one in the body ("[^a`b]: c`d") masks the label's own
    // "]:" to NULs, so DefinitionStart no longer matches - yet GFM carves
    // the label BEFORE inline tokenizing and renders a definition named
    // "a`b" (hunt 2026-08-25, micromark-verified;
    // bug-code-span-name-hides-definition). Re-check the RAW line, but
    // only when the label's own opening "[^" survived masking: a masked
    // opener means the label starts inside a protected region (a fence
    // line, an open math/comment run) where a definition-shaped string is
    // plain text, not a label.
    const raw = definitionLabelIn(line);
    if (!raw) return null;
    const bracketAt = raw.nameStart - 2;
    if (
        masked.slice(bracketAt, raw.nameStart) !==
        line.slice(bracketAt, raw.nameStart)
    ) {
        return null;
    }
    return { label: raw, name: line.slice(raw.nameStart, raw.nameEnd) };
}

/**
 * Every reference on the line, matched against its MASKED twin but with
 * each name re-sliced from the RAW line: a code span inside a name masks
 * to NULs, and a NUL-bearing name can never equal the raw definition label
 * it must pair with (bug-masked-name-identity). This is the ONE home of
 * that invariant - every scan and rewrite iterates through here instead of
 * hand-rolling the match-then-re-slice dance it used to clone.
 */
export function referenceOccurrences(
    line: string,
    masked: string,
): ReferenceOccurrence[] {
    const occurrences: ReferenceOccurrence[] = [];
    for (const match of footnoteReferenceMatches(masked)) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        occurrences.push({ name: line.slice(start + 2, end - 1), start, end });
    }
    return occurrences;
}

/**
 * The occurrence whose brackets strictly contain `ch`, or null - the same
 * "inside" rule as referenceAtCursor, for callers already holding
 * referenceOccurrences (the masked-match→raw-name pairing). The cascade's
 * masked re-checks used to clone the match-then-re-slice dance instead
 * (2026-08-11 review cleanliness).
 */
export function occurrenceAtCursor(
    occurrences: ReferenceOccurrence[],
    ch: number,
): ReferenceOccurrence | null {
    for (const occurrence of occurrences) {
        if (ch > occurrence.start && ch < occurrence.end) return occurrence;
    }
    return null;
}

/** Whether the character at `index` is backslash-escaped: an ODD run of backslashes directly before it. Exported for the insertion-position adjuster - text INSERTED at an escaped position would itself be escaped (bug-insert-after-backslash). */
export function escapedAt(line: string, index: number): boolean {
    let backslashes = 0;
    for (let j = index - 1; j >= 0 && line[j] === "\\"; j--) backslashes++;
    return backslashes % 2 === 1;
}

/** Case-insensitive membership: footnote ids differing only in letter case are the same footnote (Obsidian folds them, and the metadata cache lowercases). */
export function idListIncludes(ids: string[], id: string): boolean {
    const lower = id.toLowerCase();
    return ids.some((name) => name.toLowerCase() === lower);
}

// Obsidian won't render a footnote whose name contains whitespace or
// backticks (Jason's call, 2026-08-10: such names are disallowed outright
// rather than supported), and an empty name isn't a footnote at all; the
// reference regexes stay permissive so such names can be caught and warned
// about instead of silently misbehaving. Dollar signs are FINE - Jason
// verified live that "[^a$1]" renders as a footnote (the scanner keeps
// in-reference dollars out of math pairing for the same reason).
// The three spellings of a footnote name, each with ONE owner (the
// duplicated-logic audit found "[^…]" built in twenty places, 2026-09-05;
// a spelling with one home is also what a future translation or syntax
// change would need).

/** The reference: "[^name]". */
export function referenceText(name: string): string {
    return `[^${name}]`;
}

/** The definition label, without the space before the body: "[^name]:". */
export function definitionLabel(name: string): string {
    return `[^${name}]:`;
}

/** The reference as every toast quotes it: `"[^name]"`. */
export function quotedReference(name: string): string {
    return `"[^${name}]"`;
}

export function isValidFootnoteName(name: string): boolean {
    return name.length > 0 && !/[\s`]/.test(name);
}

// "#" is refused at CREATION and RENAME on top of the render rule: a
// "[^#x]" renders in Reading view, but Obsidian's footnote hover preview
// and its Footnotes sidebar resolve footnotes through a "#[^id]" subpath
// that splits on "#" - both say "Footnote not found" for it (Jason's
// finding 2026-09-05), and the plugin's popup can't bind it either. An
// EXISTING "#" reference stays a footnote to the scanner and the linter,
// because it does render. It shares the ordinary invalid-character
// message with spaces and backticks (Jason: one rule, one toast).
export const InvalidNameCharacters = 'Footnote names can\'t contain spaces, backticks, brackets, or "#".';

/** Why `name` can't name a NEW or RENAMED footnote, or null when it can: one message for every character a name can't carry (Jason, 2026-09-05: the separate brackets line was redundant). */
export function footnoteNameProblem(name: string): string | null {
    if (/[[\]#]/.test(name) || !isValidFootnoteName(name)) return InvalidNameCharacters;
    return null;
}

/**
 * The reference whose brackets contain `ch`, or null. Strictly INSIDE only -
 * same rule as inline footnotes: a caret immediately after the closing
 * bracket (or before the opening one) is outside, so the hotkey there
 * inserts a consecutive footnote instead of navigating (issue #49).
 */
export function referenceAtCursor(
    references: { footnote: string; startIndex: number }[],
    ch: number,
): string | null {
    for (const { footnote, startIndex } of references) {
        if (ch > startIndex && ch < startIndex + footnote.length) {
            return footnote;
        }
    }
    return null;
}

// The start index of a placeholder `reference` occurrence whose brackets
// strictly contain `ch`, or null. For the empty "[^]": the reference regexes
// require a non-empty name, so the placeholder a first press just inserted
// is invisible to every earlier cascade step - this is the only guard
// between a second press and a nested "[^[^]]". The prefilled "[^7-]"
// placeholder reuses the same containment scan via warnPrefilledReferenceIfInside.
export function emptyReferenceStart(
    text: string,
    ch: number,
    reference = "[^]",
): number | null {
    for (let i = 0; (i = text.indexOf(reference, i)) !== -1; i += reference.length) {
        if (ch > i && ch < i + reference.length) return i;
    }
    return null;
}

// One more than the highest numbered reference or definition in the text; gaps in
// the numbering are not reused, and named footnotes don't count. Numbers
// inside code blocks or frontmatter don't reserve anything (#41). With a
// `prefix`, only references carrying it count ("[^2.7]" under prefix "2."),
// and plain numbered references belong to the "" prefix only.
export function computeNextFootnoteNumber(
    markdownText: string,
    prefix = "",
    // callers holding the document's masked twin already (a press context
    // or a lint rule) pass it to skip the re-mask - it must correspond to
    // `markdownText` (perf F1)
    masked: string = maskProtectedLines(markdownText.split("\n")).join("\n"),
): number {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // /i: footnote ids are case-insensitive in Obsidian, so "[^P.1]" lives
    // in prefix "p."'s namespace and must reserve its number - a
    // case-sensitive scan let the next insert mint a colliding id
    const numberedReferences = prefix
        ? new RegExp(`\\[\\^${escaped}(\\d+)\\]`, "gi")
        : AllNumberedReferences;
    let currentMax = 1;
    for (const match of masked.matchAll(numberedReferences)) {
        const start = match.index;
        // the same exclusions footnoteReferenceMatches applies: an escaped
        // "\[^9]" is literal prose (bug-escaped-marker), and "^[^9]" is
        // inline-footnote content (bug-inline-footnote-double-parse)
        if (escapedAt(masked, start)) continue;
        if (masked[start - 1] === "^" && !escapedAt(masked, start - 1)) {
            continue;
        }
        const value = Number(match[1]);
        // a digit run that can't round-trip through Number - or whose
        // SUCCESSOR can't (MAX_SAFE_INTEGER: minting value+1 would create
        // an id this very scan then skips, so the id after it would repeat
        // - bug-autonumber-unsafe-integer) - is treated as named, not
        // numbered
        if (!Number.isSafeInteger(value) || !Number.isSafeInteger(value + 1)) {
            continue;
        }
        currentMax = Math.max(currentMax, value + 1);
    }
    return currentMax;
}
