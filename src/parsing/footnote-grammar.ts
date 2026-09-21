import { definitionLabelIn, maskProtectedLines } from "./markdown-scan";

// The label reader lives over in markdown-scan, beside the block walker
// that needs it, because markdown-scan sits below this module and so cannot
// import from it. It is re-exported here so its many callers can go on
// importing it from the same place as before.
export { definitionLabelWithName } from "./markdown-scan";

// The reference GRAMMAR: what counts as a "[^name]" reference, how two
// names are compared, and the scan that finds the next free number.
//
// Everything here is plain text handling, with nothing from the editor or
// the plugin. That makes this a leaf module (only markdown-scan sits below
// it), so the lint rules and the command cascade can both import it without
// the circular imports the old all-in-one file forced on them (split
// 2026-08-11, see .claude/plans/split-insert-or-navigate.md).

/**
 * Matches everything SHAPED like a footnote reference, numbered or named.
 * It does not rule out a definition's own label; where the match sits on
 * the line is what decides that, over in footnoteReferenceMatches.
 *
 * The /g flag makes this pattern remember where it last matched, so read it
 * with matchAll only. Calling test or exec on it gives a different answer
 * each time.
 */
export const AllReferences = /\[\^([^[\]]+)\]/g;
/**
 * Numbered references AND numbered definitions. Either one reserves its
 * number, so autonumbering will not hand that number out again.
 */
const AllNumberedReferences = /\[\^(\d+)\]/g;
/** Pulls the name out of one reference string. The name is match[2]. */
export const ExtractNameFromFootnote = /(\[\^)([^[\]]+)(?=\])/;

/**
 * Every reference on one line: each "[^name]" EXCEPT a definition's own
 * "[^name]:" label sitting at column 0.
 *
 * A "[^name]:" in the MIDDLE of a line is not a label. It is a live
 * reference followed by an ordinary colon, which is exactly how Obsidian
 * renders it, so it counts. Only a label at column 0 is a definition.
 * Deciding this by position is the whole point of the function: the old
 * test was a `(?!:)` lookahead inside the pattern, and that also threw away
 * genuine mid-line references that happened to sit before a colon.
 *
 * Pass the line already masked when protected text must be ignored.
 *
 * Footnote names are case-insensitive in Obsidian, but the casing the user
 * typed is kept here; callers fold case only when comparing two names.
 *
 * This is the RAW gate: cheap enough to run on every keystroke. A label
 * behind a blockquote marker still reads as a reference here, and is
 * excluded one level up in referenceOccurrences, which knows where the
 * line's label is.
 */
export function footnoteReferenceMatches(
    line: string,
    // Pass false when the line's label-shaped start is really LAZY
    // paragraph text, which definitionStartLines decides. Obsidian renders
    // that "[^x]" as a live reference, so it must count as one here (second
    // review, 2026-09-09: excluding it no matter what let orphaned
    // definition deletion destroy the real definition such a reference
    // pointed at).
    labelIsDefinition = true,
): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];
    for (const match of line.matchAll(AllReferences)) {
        const start = match.index;
        if (labelIsDefinition && start === 0 && line[match[0].length] === ":") continue;
        // A "[" with a backslash in front of it is literal text under the
        // CommonMark rules, so this reference-shaped string is prose the
        // user typed on purpose (bug-escaped-marker).
        if (escapedAt(line, start)) continue;
        // "^[" opens an INLINE footnote, so that bracket belongs to the
        // inline footnote: "^[^literal]" is inline-footnote text, not a
        // reference (bug-inline-footnote-double-parse). The exception is an
        // escaped caret, since "\^[^x]" is a literal "^" followed by a real
        // reference.
        if (line[start - 1] === "^" && !escapedAt(line, start - 1)) continue;
        matches.push(match);
    }
    return matches;
}

/**
 * One reference found by referenceOccurrences: the name as the user typed
 * it, plus where the whole "[^name]" sits on the line.
 */
export interface ReferenceOccurrence {
    /** The name exactly as typed, casing and all. Fold case to compare two names. */
    name: string;
    /** Index of the opening "[". */
    start: number;
    /** Index just past the closing "]". */
    end: number;
}

/**
 * Every reference on the line. The matching runs against the line's masked
 * twin (a copy with protected text blanked out), but each name is then cut
 * out of the RAW line the user typed.
 *
 * Why both halves: masking blots out a code span inside a name with NUL
 * characters, and a name carrying NULs could never equal the raw definition
 * label it is supposed to pair with (bug-masked-name-identity).
 *
 * This function is the one home of that rule. Every scan and every rewrite
 * loops through here, instead of copying the match-then-re-cut dance the
 * way they each used to.
 */
export function referenceOccurrences(
    line: string,
    masked: string,
    // Whether the line's label-shaped start is a real definition, which
    // definitionStartLines is what decides. A caller already holding those
    // starts passes its own answer, so a LAZY label's "[^x]" is counted as
    // the live reference it really is.
    labelIsDefinition = true,
): ReferenceOccurrence[] {
    const occurrences: ReferenceOccurrence[] = [];
    // A line's own definition label defines a footnote; it never references
    // one. That holds at column 0, which footnoteReferenceMatches already
    // skips, and behind a blockquote or callout marker, as in
    // "> [^9]: quoted" (case C22). Reindex used to count a quoted orphaned
    // definition's label as the first reference and give it number 1
    // (review A3, 2026-09-08). The exclusion lives here, in the one home of
    // "every reference on this line", so that no rule can disagree with it.
    const label = labelIsDefinition ? definitionLabelIn(masked) : null;
    const labelStart = label ? label.nameStart - 2 : -1;
    for (const match of footnoteReferenceMatches(masked, labelIsDefinition)) {
        const start = match.index ?? 0;
        if (start === labelStart) continue;
        const end = start + match[0].length;
        occurrences.push({ name: line.slice(start + 2, end - 1), start, end });
    }
    return occurrences;
}

/**
 * The reference whose brackets strictly contain the column `ch`, or null.
 * It follows the same "inside" rule as referenceAtCursor, and is for
 * callers that already hold a list from referenceOccurrences, with its
 * masked match and raw name paired up. The cascade's re-checks against the
 * masked twin used to copy the match-then-re-cut dance instead (2026-08-11
 * review, for cleanliness).
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

/** One inline footnote on a line: where its "^" is and where its closing "]" is. */
export interface InlineFootnoteSpan {
    open: number;
    close: number;
}

/**
 * Every inline footnote "^[...]" on `lineText`, in order, each reported as
 * `open` (where its "^" is) and `close` (where its "]" is).
 *
 * The bracket matching respects backslash escapes and steps over nested
 * balanced pairs, such as a markdown link inside the body. A "^[" that
 * never closes on this line is not an inline footnote (a body that runs
 * onto the next line is left for the next scanner generation), and a later
 * "^[" on the same line is still tried on its own.
 *
 * Pass the line already masked when protected text must be ignored: a
 * "^[" inside a code span is then NUL characters and opens nothing. Moved
 * here from commands/inline-footnotes.ts on 2026-09-21 so the punctuation
 * rule can move inline footnotes as units (N1) without the linting layer
 * importing the commands layer.
 */
export function inlineFootnoteSpans(lineText: string): InlineFootnoteSpan[] {
    const spans: InlineFootnoteSpan[] = [];
    for (let i = 0; i < lineText.length - 1; i++) {
        const c = lineText[i];
        if (c === "\\") {
            i++;
            continue;
        }
        if (c !== "^" || lineText[i + 1] !== "[") continue;

        let depth = 0;
        let close = -1;
        for (let j = i + 1; j < lineText.length; j++) {
            const cj = lineText[j];
            if (cj === "\\") {
                j++;
            } else if (cj === "[") {
                depth++;
            } else if (cj === "]") {
                depth--;
                if (depth === 0) {
                    close = j;
                    break;
                }
            }
        }
        // this candidate never closes, so it is not an inline footnote. A
        // LATER "^[" on the same line may still close properly, because its
        // opening "[" was counted as nesting above, so keep scanning rather
        // than giving up here.
        if (close === -1) continue;
        spans.push({ open: i, close });
        i = close; // scan on past this one
    }
    return spans;
}

/**
 * The inline footnote whose brackets contain position `ch` on `lineText`,
 * or null when there is none. "Inside" runs from just after the "^"
 * through the closing "]" itself.
 */
export function inlineFootnoteSpanAt(
    lineText: string,
    ch: number,
): InlineFootnoteSpan | null {
    for (const span of inlineFootnoteSpans(lineText)) {
        if (ch > span.open && ch <= span.close) return span;
    }
    return null;
}

/**
 * Whether the character at `index` is escaped by a backslash, meaning an
 * ODD number of backslashes sits directly in front of it. (Backslashes pair
 * off and escape each other, so an even run leaves the next character
 * alone.)
 *
 * Exported for the insertion-position adjuster: text INSERTED at an escaped
 * position would itself come out escaped (bug-insert-after-backslash).
 */
export function escapedAt(line: string, index: number): boolean {
    let backslashes = 0;
    for (let j = index - 1; j >= 0 && line[j] === "\\"; j--) backslashes++;
    return backslashes % 2 === 1;
}

/**
 * Whether `id` is in `ids`, ignoring letter case. Two footnote names that
 * differ only in case are the same footnote: Obsidian folds them together,
 * and its metadata cache lowercases them.
 */
export function idListIncludes(ids: string[], id: string): boolean {
    const lower = id.toLowerCase();
    return ids.some((name) => name.toLowerCase() === lower);
}

// Obsidian will not render a footnote whose name holds whitespace or a
// backtick, and an empty name is not a footnote at all. Jason's call,
// 2026-08-10: names like that are disallowed outright rather than
// supported. The reference patterns above stay permissive on purpose, so
// such a name can be caught and warned about instead of quietly
// misbehaving. Dollar signs are FINE: Jason verified live that "[^a$1]"
// renders as a footnote (and for the same reason the scanner keeps a dollar
// inside a reference out of its math pairing).
//
// Below are the three spellings of a footnote name, each with ONE owner.
// The duplicated-logic audit of 2026-09-05 found "[^…]" being built by hand
// in twenty places. A spelling with a single home is also what a future
// translation, or a change to the syntax, would need.

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

/** The definition label as an alert quotes it when the LABEL LINE is the thing to fix: `"[^name]:"`. */
export function quotedDefinitionLabel(name: string): string {
    return `"[^${name}]:"`;
}

export function isValidFootnoteName(name: string): boolean {
    return name.length > 0 && !/[\s`]/.test(name);
}

// A "#" is refused when a footnote is CREATED or RENAMED, on top of the
// render rule above. "[^#x]" does render in Reading view, but Obsidian's
// footnote hover preview and its Footnotes sidebar both find a footnote
// through a "#[^name]" subpath that splits on "#", so both say "Footnote
// not found" for it (Jason's finding, 2026-09-05), and the plugin's own
// popup can't bind to it either. A "#" reference that already exists stays
// a footnote to the scanner and the lint, because it does render. It shares
// the ordinary invalid-character message with spaces and backticks
// (Jason: one rule, one toast).
export const InvalidNameCharacters = 'Footnote names can\'t contain spaces, backticks, brackets, or "#".';

/**
 * Why `name` can't name a NEW or RENAMED footnote, or null when it can.
 * One message covers every character a name can't carry (Jason, 2026-09-05:
 * the separate line about brackets said nothing the first line didn't).
 */
export function footnoteNameProblem(name: string): string | null {
    if (/[[\]#]/.test(name) || !isValidFootnoteName(name)) return InvalidNameCharacters;
    return null;
}

/**
 * The reference whose brackets contain the column `ch`, or null.
 *
 * The caret must be strictly INSIDE the brackets, the same rule inline
 * footnotes use. A caret sitting right after the closing bracket, or right
 * before the opening one, counts as outside, so pressing the hotkey there
 * inserts a second footnote next to the first instead of navigating
 * (issue #49).
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

// Where a placeholder starts, when the column `ch` sits strictly inside its
// brackets; null otherwise.
//
// This exists for the empty "[^]". The reference patterns above insist on a
// non-empty name, so the placeholder a first press has just inserted is
// invisible to every earlier step of the cascade. This check is the only
// guard standing between a second press and a nested "[^[^]]". The
// prefilled "[^7-]" placeholder reuses the same containment scan through
// warnPrefilledReferenceIfInside.
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

// One more than the highest numbered reference or definition in the text.
// Gaps in the numbering are not filled back in, and named footnotes don't
// count. A number inside a code block or the frontmatter reserves nothing
// (#41). When a `prefix` is given, only references carrying it count
// ("[^2.7]" under the prefix "2."), and plain numbered references belong to
// the "" prefix alone.
export function computeNextFootnoteNumber(
    markdownText: string,
    prefix = "",
    // A caller that already holds the document's masked twin (a press
    // context, or a lint rule) passes it in so the masking is not done
    // twice. It must be the masked twin of this same `markdownText`
    // (performance item F1).
    masked: string = maskProtectedLines(markdownText.split("\n")).join("\n"),
): number {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // The "i" flag matters here: footnote names are case-insensitive in
    // Obsidian, so "[^P.1]" lives in the prefix "p."'s namespace and must
    // reserve its number. A case-sensitive scan let the next insert mint a
    // name that collided with it.
    const numberedReferences = prefix
        ? new RegExp(`\\[\\^${escaped}(\\d+)\\]`, "gi")
        : AllNumberedReferences;
    let currentMax = 1;
    for (const match of masked.matchAll(numberedReferences)) {
        const start = match.index;
        // The same two exclusions footnoteReferenceMatches makes: an
        // escaped "\[^9]" is literal prose (bug-escaped-marker), and
        // "^[^9]" is the text of an inline footnote
        // (bug-inline-footnote-double-parse).
        if (escapedAt(masked, start)) continue;
        if (masked[start - 1] === "^" && !escapedAt(masked, start - 1)) {
            continue;
        }
        const value = Number(match[1]);
        // A run of digits too big to survive the trip through Number is
        // treated as a name, not a number. So is one whose SUCCESSOR is too
        // big: past MAX_SAFE_INTEGER, minting value + 1 would create a name
        // this very scan then skips, so the name after it would repeat
        // (bug-autonumber-unsafe-integer).
        if (!Number.isSafeInteger(value) || !Number.isSafeInteger(value + 1)) {
            continue;
        }
        currentMax = Math.max(currentMax, value + 1);
    }
    return currentMax;
}
