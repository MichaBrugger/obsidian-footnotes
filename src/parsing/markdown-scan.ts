// The basic scanning pieces that the whole-document footnote transforms
// share: reindex, move-to-bottom, and after-punctuation. Nothing in this
// file touches an Editor. Lines go in, facts about them come out.

/**
 * A footnote definition at the start of a line ("[^x]: …"). Up to three
 * spaces of indent are allowed, the same as any other block start; at four
 * spaces the line is indented code instead.
 *
 * Ground truth in Obsidian's Reading view (2026-09-09): "  [^1]: x" renders
 * as a definition, even sitting directly under another definition, where it
 * starts a NEW footnote rather than continuing the one above (review A2).
 */
const DefinitionStart = /^ {0,3}\[\^([^[\]]+)\]:/;

/**
 * The trailing punctuation an insert hops over on its way to the end of a
 * word. The footnote-after-punctuation lint rule moves references around
 * this very same set of characters, so the two features can't disagree
 * about where a reference belongs. It is the ASCII punctuation plus the
 * CJK fullwidth forms 。，、；：！？ (Jason, 2026-08-10).
 *
 * It lives in this file because both users of it, cursor-motion and the
 * lint rule, already sit above this leaf module. The import cycle that
 * first forced it here is gone, but no better shared home turned up.
 */
export const TrailingPunctuationChars = ".,;:!?。，、；：！？";

/**
 * The closing marks a footnote reference also steps past: closing quotes
 * (straight, curly, and the CJK corner brackets), closing brackets of every
 * kind, and the markers that close bold, italics, highlight, and
 * strikethrough. Together with TrailingPunctuationChars they make up the
 * landing convention below.
 */
export const ClosingMarkChars = "\"'’”)]}」』）】〕》〉*_~=";

/**
 * Where a footnote reference belongs after the word ending at `end`: past
 * every closing mark and punctuation character that follows, so a note on
 * the last word of a quoted, bracketed, or emphasized phrase lands OUTSIDE
 * the phrase and after its punctuation:
 *
 *     This is "some bravo".   ->   This is "some bravo".[^1]
 *     see (bravo).            ->   see (bravo).[^1]
 *     This is **some bravo**. ->   This is **some bravo**.[^1]
 *
 * That is the Chicago Manual of Style's rule, the one every major style
 * guide shares (Jason's ask, sheet 01, 2026-09-09). A markdown link's
 * "(url)" tail right after a "]" is stepped over whole, so the reference
 * never splits "[text](url)". A space, a letter, or an opening bracket
 * (the start of a following reference) ends the walk.
 */
export function referenceLandingAfter(text: string, end: number): number {
    let at = end;
    for (;;) {
        if (at >= text.length) return at;
        const c = text[at];
        if (c === "]" && text[at + 1] === "(") {
            const close = text.indexOf(")", at + 2);
            if (close === -1) return at + 1;
            at = close + 1;
            continue;
        }
        if (!ClosingMarkChars.includes(c) && !TrailingPunctuationChars.includes(c)) return at;
        at++;
    }
}
// An indented line is a continuation line: it belongs to the definition
// above it. The exception is a line that is itself a label indented one to
// three spaces, which starts the NEXT definition (that is DefinitionStart
// above; the block walker checks both patterns).
const IndentedContent = /^\s+\S/;

export interface DefinitionBlock {
    name: string;
    /** the block's line range, both ends included, continuation lines and all */
    start: number;
    end: number;
}

/**
 * Strips a trailing "\r" from every line, so a document with Windows line
 * endings that was split on "\n" passes the same exact-string line checks
 * ("---", fence delimiters) as one with plain "\n" endings. The array keeps
 * its length and its indices.
 *
 * Windows notes and synced notes arrive with "\r\n" endings, and without
 * this step the frontmatter and fence scans quietly find nothing.
 */
function stripCr(lines: string[]): string[] {
    return lines.map((line) =>
        line.endsWith("\r") ? line.slice(0, -1) : line,
    );
}

/**
 * `text` with its Windows "\r\n" line endings flattened to plain "\n", plus
 * the ending to put back afterwards. The whole-document transforms all work
 * in "\n" and restore the note's original endings on the way out. Obsidian
 * edits notes in place, so a transform must not quietly flip a synced
 * Windows file over to "\n", the way stripping and forgetting would.
 */
export function normalizeEol(text: string): {
    text: string;
    eol: "\n" | "\r\n";
} {
    return text.includes("\r\n")
        ? { text: text.replace(/\r\n/g, "\n"), eol: "\r\n" }
        : { text, eol: "\n" };
}

/** Puts the note's original line endings back on a transform's result. */
export function restoreEol(text: string, eol: "\n" | "\r\n"): string {
    return eol === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

// The blockquote or callout markers at the start of a line ("> ", "> > ",
// and so on). A fenced code block can sit inside a blockquote or callout,
// and then its delimiter lines carry these markers too.
//
// Each ">" marker owns one optional space after it, and the NEXT marker may
// sit up to 3 further spaces in. That is the same walk blockquoteDepth
// does. The old pattern, /^(?: {0,3}>)+ ?/, did not eat the space that
// belongs to each marker, so a perfectly legal ">    > [^1]: x" (the gap of
// 4 being the marker's own space plus 3 of indent) lost its second marker,
// and the label behind it went invisible (2026-08-11 review, bug #5).
const BlockquotePrefix = /^(?: {0,3}> ?)+/;

/**
 * How deeply the line is nested in blockquotes, meaning how many leading
 * ">" markers it carries, plus the text left after them. CommonMark allows
 * each marker 0 to 3 spaces before it and one space after.
 *
 * A fence lives in the container that opened it, and this depth is how the
 * fence scan tells which container that is.
 */
function blockquoteDepth(line: string): { depth: number; rest: string } {
    let depth = 0;
    let i = 0;
    for (;;) {
        let j = i;
        let spaces = 0;
        while (line[j] === " " && spaces < 3) {
            j++;
            spaces++;
        }
        if (line[j] !== ">") break;
        j++;
        if (line[j] === " ") j++; // the one optional space belongs to this marker
        depth++;
        i = j;
    }
    return { depth, rest: line.slice(i) };
}

/**
 * The footnote definition label on `line`, or null when the line carries
 * none. The label may sit at column 0, or behind blockquote or callout
 * markers, as in "> [^x]: …" (Jason's ruling, 2026-08-10: footnote
 * creation, navigation, and lint all work inside blockquotes and callouts).
 *
 * The positions returned index into the SAME line that was passed in, so a
 * caller that matched against the masked twin can cut the name back out of
 * the raw line. It has to: a code span inside the name masks to NULs.
 */
export function definitionLabelIn(line: string): DefinitionLabel | null {
    const prefix = line.match(BlockquotePrefix)?.[0].length ?? 0;
    const match = line.slice(prefix).match(DefinitionStart);
    if (!match) return null;
    // whatever DefinitionStart matched before the "[^": the 0 to 3 spaces
    // of indent
    const indent = match[0].length - match[1].length - "[^]:".length;
    const nameStart = prefix + indent + 2;
    return {
        nameStart,
        nameEnd: nameStart + match[1].length,
        labelEnd: prefix + match[0].length,
        quoted: prefix > 0,
    };
}

/**
 * Where a definition label sits on its line: the span of the name, the end
 * of the whole "[^name]:" label, and whether a blockquote or callout marker
 * comes before it. A quoted label is a live definition on its own line, but
 * it is never part of a column-0 definition BLOCK (case C22).
 */
export interface DefinitionLabel {
    nameStart: number;
    nameEnd: number;
    labelEnd: number;
    quoted: boolean;
}

/**
 * The definition label on `line`, matched against its MASKED twin (a copy
 * with protected text blanked out) but with the name cut back out of the
 * RAW line. It is the label-side counterpart of referenceOccurrences below,
 * and it carries the same rule (bug-masked-name-identity): masking turns a
 * code span inside the name into NULs, and a name carrying NULs could never
 * equal the raw reference it must pair with.
 *
 * The label's positions work on either twin, because masking never changes
 * a line's length. Null when the masked line carries no label.
 *
 * (rename-footnote keeps a variant of its own that checks the raw line
 * first: it needs the RAW label's positions before the masked twin exists,
 * and only then confirms against the twin that the label is live.)
 */
export function definitionLabelWithName(line: string, masked: string) {
    const label = definitionLabelIn(masked);
    // Stryker disable next-line ConditionalExpression: a label visible on the masked twin is always visible at the SAME positions on the raw line (masking only writes NULs, and NULs can't spell "[^" or "]:"), so forcing the fallback is behavior-identical - the fast path is perf
    if (label) return { label, name: line.slice(label.nameStart, label.nameEnd) };
    // The masked twin can LOSE a real label. A backtick inside the NAME can
    // pair with one in the body, as in "[^a`b]: c`d", and masking that code
    // span turns the label's own "]:" into NULs, so DefinitionStart stops
    // matching. Yet GFM carves the label out BEFORE it tokenizes inline
    // syntax, and renders a definition named "a`b" (hunt 2026-08-25,
    // verified against micromark; bug-code-span-name-hides-definition).
    //
    // So check the RAW line again, but only when the label's own opening
    // "[^" survived masking. A masked opener means the label starts inside
    // a protected region (a fence line, an open math or comment run), where
    // a definition-shaped string is plain text and not a label at all.
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
 * Finds the first exact, fully unprotected run of `runLines` inside
 * `lines`, and gives back the index of the run's LAST line, or -1 when
 * there is none.
 *
 * The section heading setting is markdown that can span several lines, such
 * as "---\n## Footnotes". Both the insert flow (the heading slot in
 * buildDefinitionAppend) and the move-to-bottom rule find the whole run
 * through THIS function. Two hand-written copies would let their answers
 * drift apart, and with them the promise that running lint again changes
 * nothing (2026-08-11 review, for cleanliness).
 */
export function findLineRunEnd(
    lines: string[],
    isProtected: boolean[],
    runLines: string[],
): number {
    for (let i = 0; i + runLines.length <= lines.length; i++) {
        const matches = runLines.every(
            (runLine, k) => !isProtected[i + k] && lines[i + k] === runLine,
        );
        if (matches) return i + runLines.length - 1;
    }
    return -1;
}

/**
 * Whether a line already known to start with a fence delimiter really opens
 * a fence. CommonMark says the text after a backtick fence's opening
 * backticks may not itself contain a backtick, so "```[^1]``` x" is an
 * inline code span inside a paragraph, not a fence. Opening a fence there
 * would open one that never closes and swallows the rest of the note.
 * Tilde fences have no such rule.
 */
function isFenceOpener(bareLine: string, delim: string): boolean {
    if (delim[0] !== "`") return true;
    const rest = bareLine.slice(bareLine.indexOf(delim) + delim.length);
    return !rest.includes("`");
}

/**
 * Whether the character at `i` sits inside something shaped like a footnote
 * reference ("[^…]").
 *
 * Obsidian reads the bracket construct first, so a "$" inside a reference
 * is part of the footnote's name and never opens or closes math (Jason
 * verified this live, 2026-08-10). The same goes for a backtick:
 * "[^aa`a] [^bb#b] [^cc`c]" renders no code span at all, and the "[^bb#b]"
 * in the middle is a live footnote. Pairing those two backticks used to
 * swallow the middle reference into one merged name (his find, 2026-09-08).
 *
 * The nearest bracket wins: a "[" behind the character with a "^" after it
 * and no "]" in between means we are inside a reference. The walk reads the
 * characters as MASKED SO FAR, not the raw line, because a "[^" fragment
 * already claimed by a code span or a comment is not a live bracket; it
 * used to wrongly switch off math masking for the rest of the line
 * (bug-dollar-inside-masked-bracket). A NUL therefore ends the walk, and
 * the shape must also close with a "]" somewhere ahead of `i`, since an
 * unclosed "[^" is a bracket and not a reference.
 *
 * Being FOUND as a reference says nothing about whether the name is valid.
 * A name with a backtick in it is still invalid, and the lint now reports
 * it by name.
 *
 * Why tables and not a walk: the answers are worked out ONCE over the raw
 * line, rather than walking outward from every candidate. That outward walk
 * ran all the way to the start of the line whenever no bracket lay behind
 * the candidate, and the loops hunting for a closing character asked it
 * once per dollar or backtick, so masking a long line of prices took time
 * proportional to its length squared. At 8000 characters that was 344 ms
 * per mask, and one lint masks the note about ten times (review B1,
 * 2026-09-09).
 *
 * The tables stay right as masking proceeds: blots only ever land BEHIND
 * the scan head, and every question is asked at or ahead of it. So the one
 * thing masking can change for a question is whether a NUL now sits between
 * the candidate and its nearest bracket behind, which the index answers
 * from the highest position blotted so far.
 */
class ReferenceShapeIndex {
    /** Index of the nearest "[", "]", or raw NUL behind j, or -1. */
    private readonly bracketBehind: Int32Array;
    /** 1 when that nearest character is a "[" followed by "^". */
    private readonly openerBehind: Uint8Array;
    /** 1 when a "]" comes before any "[", raw NUL, or the end, walking forward from j + 1. */
    private readonly closesAhead: Uint8Array;
    private lastBlotted = -1;

    constructor(line: string) {
        const n = line.length;
        this.bracketBehind = new Int32Array(n);
        this.openerBehind = new Uint8Array(n);
        this.closesAhead = new Uint8Array(n);
        let bracket = -1;
        let opener = 0;
        for (let j = 0; j < n; j++) {
            this.bracketBehind[j] = bracket;
            this.openerBehind[j] = opener;
            const c = line[j];
            if (c === "\0" || c === "]") {
                bracket = j;
                opener = 0;
            } else if (c === "[") {
                bracket = j;
                opener = line[j + 1] === "^" ? 1 : 0;
            }
        }
        // The shape must CLOSE somewhere ahead: an unclosed "[^" is just a
        // bracket, not a reference. In "`[^` $[^1].$" both the code span
        // and the math survive because of this. Without it the backtick
        // guard would never let that span close, and the dollar guard would
        // then hide the math too.
        let closes = 0;
        for (let j = n - 1; j >= 0; j--) {
            this.closesAhead[j] = closes;
            const c = line[j];
            if (c === "\0" || c === "[") closes = 0;
            else if (c === "]") closes = 1;
        }
    }

    /** Records that the span from `from` up to (not including) `to` was just blanked out. Everything up to column to - 1 is now NULs, and a reference shape cannot reach back across them. */
    blotted(to: number): void {
        if (to - 1 > this.lastBlotted) this.lastBlotted = to - 1;
    }

    inside(i: number): boolean {
        const bracket = this.bracketBehind[i];
        if (bracket === -1 || this.openerBehind[i] === 0) return false;
        // A NUL between the opener and i, or on the opener itself, or on
        // its "^", ends the walk backwards. Every blot so far lies behind
        // i, so asking that is exactly the same as asking whether the
        // highest blotted position has reached the opener.
        if (this.lastBlotted >= bracket) return false;
        return this.closesAhead[i] === 1;
    }
}

/**
 * One left-to-right pass over a line, blotting out inline code spans, HTML
 * comments, and math ($…$ and $$…$$) with NULs.
 *
 * The rule is CommonMark's: whichever construct opens first claims what
 * follows it. Backticks inside a comment are literal, a "<!--" inside a
 * code span is code (bug-comment-mask-order and
 * bug-backticked-comment-opener), and a "$" inside either is just a dollar
 * sign. An opener of any kind with a backslash in front of it is literal
 * text (bug-escaped-comment-opener). The short comments "<!-->" and
 * "<!--->" are complete comments per CommonMark section 6.6
 * (bug-short-form-comment).
 *
 * Inline math needs content between the dollars that is not empty and
 * neither starts nor ends with a space. That is Obsidian's own rule, and it
 * is what keeps "$5 and $10" ordinary prose.
 *
 * `startInComment` and `startInMath` carry a multi-line region in from the
 * previous line. `endsInComment` and `endsInMath` report one still open at
 * the end of this line, with its opener masked through to the line's end.
 *
 * Masking math at all is Jason's ruling of 2026-08-10: lint never touches
 * math.
 */
export function maskLineRegions(
    line: string,
    // A named object rather than two true/false arguments in a row, so a
    // call like `maskLineRegions(line, { math: true })` says out loud which
    // region is continuing.
    startsIn: { comment?: boolean; math?: boolean } = {},
): { masked: string; endsInComment: boolean; endsInMath: boolean } {
    const startInComment = startsIn.comment ?? false;
    const startInMath = startsIn.math ?? false;
    // The quick way out: nothing on this line could open or close any of
    // the three constructs, so there is nothing to mask.
    if (
        !startInComment &&
        !startInMath &&
        !line.includes("`") &&
        !line.includes("<!--") &&
        !line.includes("$")
    ) {
        return { masked: line, endsInComment: false, endsInMath: false };
    }

    const chars = line.split("");
    const shapes = new ReferenceShapeIndex(line);
    const insideReferenceShape = (at: number) => shapes.inside(at);
    const blot = (from: number, to: number) => {
        for (let k = from; k < to; k++) chars[k] = "\0";
        shapes.blotted(to);
    };
    let i = 0;

    if (startInComment) {
        // text inside a comment is literal, so the first "-->" closes it,
        // no exceptions
        const close = line.indexOf("-->");
        if (close === -1) {
            return {
                masked: "\0".repeat(line.length),
                endsInComment: true,
                endsInMath: false,
            };
        }
        blot(0, close + 3);
        i = close + 3;
    } else if (startInMath) {
        // text inside display math is literal too, so the first "$$"
        // closes it
        const close = line.indexOf("$$");
        if (close === -1) {
            return {
                masked: "\0".repeat(line.length),
                endsInComment: false,
                endsInMath: true,
            };
        }
        blot(0, close + 2);
        i = close + 2;
    }

    while (i < line.length) {
        const c = line[i];
        if (c === "\\") {
            i += 2; // an escaped character can't open a code span or a comment
            continue;
        }
        if (c === "`") {
            // a backtick inside "[^…]" is part of the footnote's name, not
            // the opener of a code span
            if (insideReferenceShape(i)) {
                while (line[i] === "`") i++;
                continue;
            }
            const runStart = i;
            while (line[i] === "`") i++;
            const runLength = i - runStart;
            // Look for the next run of backticks of exactly this length.
            // Inside a code span a backslash is an ordinary character, so
            // this search must NOT skip over escapes. Only the opening run
            // had to be unescaped.
            let close = -1;
            for (let j = i; j < line.length; ) {
                if (line[j] !== "`") {
                    j++;
                    continue;
                }
                const candidate = j;
                while (line[j] === "`") j++;
                // a run inside "[^…]" can't close the span either, for the
                // same reason as the opener check above
                if (j - candidate === runLength && !insideReferenceShape(candidate)) {
                    close = candidate;
                    break;
                }
            }
            if (close === -1) continue; // nothing closes it: literal backticks
            blot(runStart, close + runLength);
            i = close + runLength;
            continue;
        }
        if (line.startsWith("<!--", i)) {
            if (line.startsWith("<!-->", i)) {
                blot(i, i + 5);
                i += 5;
                continue;
            }
            if (line.startsWith("<!--->", i)) {
                blot(i, i + 6);
                i += 6;
                continue;
            }
            const close = line.indexOf("-->", i + 4);
            if (close === -1) {
                // a multi-line comment opens here and runs past the end of
                // the line
                blot(i, line.length);
                return {
                    masked: chars.join(""),
                    endsInComment: true,
                    endsInMath: false,
                };
            }
            blot(i, close + 3);
            i = close + 3;
            continue;
        }
        if (c === "$") {
            // a dollar inside "[^…]" is part of the footnote's name, not math
            if (insideReferenceShape(i)) {
                i++;
                continue;
            }
            if (line.startsWith("$$", i)) {
                const close = line.indexOf("$$", i + 2);
                if (close === -1) {
                    // display math opens here and runs past the end of the
                    // line
                    blot(i, line.length);
                    return {
                        masked: chars.join(""),
                        endsInComment: false,
                        endsInMath: true,
                    };
                }
                blot(i, close + 2);
                i = close + 2;
                continue;
            }
            // Inline math: a closing "$" with content between that is not
            // empty and neither starts nor ends with a space. Anything else
            // and the dollar is ordinary prose. A dollar inside "[^…]"
            // can't close it either, same as the opener check above.
            let close = -1;
            for (let j = i + 1; j < line.length; j++) {
                if (line[j] === "\\") {
                    j++;
                    continue;
                }
                if (line[j] === "$" && !insideReferenceShape(j)) {
                    close = j;
                    break;
                }
            }
            if (
                close === -1 ||
                close === i + 1 ||
                line[i + 1] === " " ||
                line[close - 1] === " "
            ) {
                i++; // not math, and this candidate closer may open math of its own
                continue;
            }
            blot(i, close + 1);
            i = close + 1;
            continue;
        }
        i++;
    }
    return { masked: chars.join(""), endsInComment: false, endsInMath: false };
}

/** The per-line facts the whole-document walk produces. */
export interface DocumentScan {
    /**
     * Lines protected in full: YAML frontmatter, fenced code including its
     * delimiter lines, standalone indented code, and the INTERIOR lines of
     * a multi-line comment or math block. The boundary lines, where such a
     * region opens or closes, are NOT here: the live part of those lines
     * stays scannable, with only the comment or math part masked
     * (bug-comment-boundary-lines).
     */
    isProtected: boolean[];
    /** Line `i` begins inside a multi-line HTML comment, so it is a closer or an interior line. */
    startsInComment: boolean[];
    /** Line `i` begins inside a multi-line $$ math block (a closer or interior line). */
    startsInMath: boolean[];
    /**
     * Line `i` begins inside an open fenced code block: an interior or a
     * closer line, at any blockquote depth. The selection edge-cut checks
     * need this flag, because a fence inside a blockquote is invisible to
     * `endsProtected`. The opener line is NOT here, and neither is a line
     * that killed a quoted fence by ending its quote.
     */
    startsInFence: boolean[];
    /**
     * A line appended at the end of the note would itself be protected,
     * because an unclosed comment, math block, or DOCUMENT-LEVEL fence runs
     * all the way to the end. A fence inside a blockquote does not count:
     * the appended line ends the quote, and the fence dies with it. This
     * replaced move-to-bottom's habit of re-scanning with a probe line
     * (performance item F6).
     */
    endsProtected: boolean;
    /**
     * `endsProtected` as of line `i`: what a note cut off right after line
     * `i` would report. The definition append walks up from the end of the
     * note, and it used to cut and re-scan the whole prefix once per line,
     * which on a long note with an unclosed opener near the top took time
     * proportional to the length squared (review B2, 2026-09-09). Lines
     * inside a closed frontmatter block read false.
     */
    endsProtectedAt: boolean[];
    /**
     * Line `i` belongs to an Obsidian "%%" BLOCK comment: its opener line,
     * one of its interior lines, or its closer line.
     *
     * Obsidian hides the text of such a block but still parses it (ground
     * truth 2026-09-09). A REFERENCE inside binds to its definition and
     * takes a number, so these lines are NOT protected and NOT masked. A
     * DEFINITION inside is dead, so definitionStartLines never starts one
     * here and lazyDefinitionLabelLines never reports one.
     *
     * `endsProtected` counts an unclosed block, because a definition
     * appended inside it would be dead. An inline "%%…%%" pair needs no
     * flag of its own: a label cannot start behind one, and the references
     * inside it are live.
     */
    inCommentBlock: boolean[];
    /**
     * For a block comment's CLOSER line, the position just past its closing
     * "%%"; -1 on every other line. Whatever follows the closer on that
     * line is live paragraph text.
     */
    commentBlockCloseAt: number[];
}

/**
 * Whether this line OPENS an Obsidian "%%" block comment.
 *
 * It does when a "%%" stands at the start of the line's content, meaning
 * after any blockquote markers (that is `rest`), after an optional list
 * marker, and after up to three spaces of indent, or the deeper indent a
 * list item or an open definition allows inside its own container, AND that
 * "%%" is the ONLY one on the line.
 *
 * A second "%%" would pair with the first as an inline comment instead:
 * "%% a %%", "%%%%", even "%% `%%`", since backticks do not shield a
 * closer. An unpaired "%%" trailing after such a pair is literal text, and
 * a "%%" in the middle of a line never opens a block.
 *
 * Ground truth in the live Reading view, 2026-09-09
 * (spec-obsidian-comments).
 */
function opensCommentBlock(
    line: string,
    rest: string,
    depth: number,
    listContentColumn: number | null,
    inDefinition: boolean,
): boolean {
    if ((line.match(/%%/g) ?? []).length !== 1) return false;
    let lead = 0;
    while (lead < rest.length && rest[lead] === " ") lead++;
    if (rest.startsWith("%%", lead)) {
        if (lead <= 3) return true;
        if (depth === 0 && listContentColumn !== null && lead <= listContentColumn + 3) return true;
        return depth === 0 && inDefinition && lead <= 4 + 3;
    }
    return /^ {0,3}(?:[-+*]|\d{1,9}[.)]) +%%/.test(rest);
}

/** How wide the line's leading whitespace is, each tab running to the next 4-column tab stop, as CommonMark says. */
function leadingIndentWidth(line: string): number {
    let width = 0;
    for (const ch of line) {
        if (ch === " ") width++;
        else if (ch === "\t") width += 4 - (width % 4);
        else break;
    }
    return width;
}

/**
 * The walk over the whole document that decides which lines are protected:
 * YAML frontmatter, fenced code blocks with both delimiter lines included
 * (fences nested in blockquotes and callouts too), multi-line HTML
 * comments, and STANDALONE indented code blocks. Jason's ruling of
 * 2026-08-10: lint never touches code.
 *
 * The comment state is tracked by the same scanner that does the masking,
 * the one that knows about escapes and code spans, so the two can't
 * disagree.
 *
 * "Standalone" is the part that knows about definitions. An indented line
 * continuing a footnote definition, or lazily continuing a paragraph, is
 * live markdown. Only a chunk indented by four spaces or a tab that opens
 * at a block boundary outside any definition is code.
 */
export function scanDocument(lines: string[]): DocumentScan {
    const src = stripCr(lines);
    const isProtected = new Array<boolean>(lines.length).fill(false);
    const startsInComment = new Array<boolean>(lines.length).fill(false);
    const startsInMath = new Array<boolean>(lines.length).fill(false);
    const startsInFence = new Array<boolean>(lines.length).fill(false);
    const inCommentBlock = new Array<boolean>(lines.length).fill(false);
    const commentBlockCloseAt = new Array<number>(lines.length).fill(-1);
    let i = 0;

    if (src[0] === "---") {
        for (let j = 1; j < src.length; j++) {
            if (/^(---|\.\.\.)\s*$/.test(src[j])) {
                for (let k = 0; k <= j; k++) isProtected[k] = true;
                i = j + 1;
                break;
            }
        }
    }

    // contentIndent is the column where the fence's CONTAINER content
    // starts: 0 for a fence at the document level, or the list item's
    // content column when the opener rode in on a list-marker line
    // ("10. ```"). The closer may be indented up to contentIndent + 3.
    // (Sol bug #1: the old test measured 0 to 3 spaces from the document
    // margin, so "    ```" could never close a "10. ```" fence, and that
    // fence then swallowed the rest of the note.)
    let fence: {
        char: string;
        length: number;
        depth: number;
        contentIndent: number;
    } | null = null;
    // Comment and math regions live in the CONTAINER that opened them, just
    // as fences do (Sol bug #4, verified against metadataCache).
    // regionDepth is the blockquote depth at the opener; a line whose depth
    // drops below it ends the quote, and the region with it.
    let inComment = false;
    let inMath = false;
    let regionDepth = 0;
    // An open Obsidian "%%" block comment, and the blockquote depth it
    // opened at, since it lives in its container like every other region.
    // Its lines are not protected, because the references inside them are
    // live, but a definition appended inside it would be dead, so
    // endsProtected does count it (see DocumentScan.inCommentBlock).
    let commentBlock: { depth: number } | null = null;
    // An unclosed region inside a blockquote can't reach a line appended at
    // the end of the note: that appended line ends the quote, exactly as it
    // does for a fence inside a blockquote.
    const endsProtectedNow = (): boolean =>
        ((inComment || inMath) && regionDepth === 0) ||
        (fence !== null && fence.depth === 0) ||
        (commentBlock !== null && commentBlock.depth === 0);
    const endsProtectedAt = new Array<boolean>(lines.length).fill(false);
    // The indented-code state (case C21). `blockBoundary` marks a place
    // where indented code may OPEN: the start of the document, blank lines,
    // and, because lazy continuation applies to paragraphs only (Sol bug
    // #5), the line right after a "#" heading, a closed fence, a bare
    // region closer, or a thematic break. `inDefinition` mirrors how far
    // findDefinitionBlocks reaches: a "[^x]:" line plus its indented
    // continuation lines and the blank runs between them. `inIndentedCode`
    // means an indented chunk is currently open.
    let inIndentedCode = false;
    let inDefinition = false;
    let blockBoundary = true;
    // The CONTENT indents of the list items currently open, innermost last
    // (Sol bug #2, 2026-08-10, verified against metadataCache). An indented
    // continuation inside a loose list ("- a", blank, "    details") is
    // LIVE list content: inside an item, indented code starts 4 columns
    // past the item's own content indent, not at column 4 of the document.
    // Document level only; a quoted list rides its quote's existing rules.
    const listStack: number[] = [];
    // Indented code measured against the quote it sits in (2026-08-11
    // review bug #4, ground-truthed in the live reading view). Quote
    // content indented 4 or more columns past the innermost ">" marker is
    // code when it opens at a boundary INSIDE the quote, meaning the
    // quote's start or a blank ">" line. Otherwise it stays LIVE, as a lazy
    // paragraph continuation or a definition continuation. Only the
    // innermost quote is tracked; a change of depth starts again at a
    // boundary.
    let quote: {
        depth: number;
        boundary: boolean;
        inDefinition: boolean;
        inCode: boolean;
    } | null = null;
    for (; i < src.length; i++) {
        // At the top of a pass, the state is the state left by the previous
        // line, so recording it here covers every `continue` below.
        if (i > 0) endsProtectedAt[i - 1] = endsProtectedNow();
        // The blockquote nesting that this line's container constructs
        // count in. Fences and comment or math regions live in the
        // container that opened them.
        const { depth, rest } = blockquoteDepth(src[i]);
        // An open "%%" block comment claims whole lines until its closer,
        // which is the first "%%" anywhere on a later line. Escapes and
        // backticks do not shield that closer, just as they do not shield
        // an HTML comment's "-->". A shallower quote depth ends the quote,
        // and the block with it. Nothing on these lines opens a fence or
        // another region, and the list and indent state freezes across
        // them: this text is hidden, not code.
        if (commentBlock && depth < commentBlock.depth) commentBlock = null;
        if (commentBlock) {
            inCommentBlock[i] = true;
            const close = src[i].indexOf("%%");
            if (close === -1) continue;
            commentBlockCloseAt[i] = close + 2;
            commentBlock = null;
            // A closer with nothing after it ends a BLOCK: a label directly
            // under it is a definition, and an indented chunk may open on
            // the very next line.
            if (src[i].slice(close + 2).trim() === "") blockBoundary = true;
            continue;
        }
        if ((inComment || inMath) && depth < regionDepth) {
            // The region's blockquote ended and took the region with it: a
            // blank or shallower line ends the quote. This line is ordinary
            // text and gets the full treatment below.
            inComment = false;
            inMath = false;
        }
        if (inComment) {
            startsInComment[i] = true;
            inIndentedCode = false;
            // inDefinition survives this: a region OPENED by an indented
            // continuation line ("    <!--") is definition content, and the
            // definition carries on after that region's closer (Sol bug #3).
            blockBoundary = false;
            if (!src[i].includes("-->")) {
                isProtected[i] = true; // an interior line: nothing on it is live
                continue;
            }
            // The closer line keeps whatever live text follows the closer,
            // and that text can itself open code, another comment, math,
            // even a NEW multi-line region of either kind.
            const closed = maskLineRegions(src[i], { comment: true });
            inComment = closed.endsInComment;
            inMath = closed.endsInMath;
            // A new region opened by that live text belongs to this line's
            // own container depth.
            if (inComment || inMath) regionDepth = depth;
            // A closer with no live text after it ends a BLOCK, so an
            // indented chunk may open on the very next line (Sol bug #5).
            if (
                !inComment &&
                !inMath &&
                closed.masked.replace(/\0/g, " ").trim() === ""
            ) {
                blockBoundary = true;
            }
            continue;
        }
        if (inMath) {
            startsInMath[i] = true;
            inIndentedCode = false;
            // inDefinition survives here too, for the same reason as in the
            // comment branch above
            blockBoundary = false;
            if (!src[i].includes("$$")) {
                isProtected[i] = true; // an interior line: nothing on it is live
                continue;
            }
            const closed = maskLineRegions(src[i], { math: true });
            inMath = closed.endsInMath;
            inComment = closed.endsInComment;
            // Same as the comment branch: a region reopened here belongs to
            // this line's own container depth.
            if (inComment || inMath) regionDepth = depth;
            // a closer with nothing after it ends a block, same as the
            // comment branch
            if (
                !inComment &&
                !inMath &&
                closed.masked.replace(/\0/g, " ").trim() === ""
            ) {
                blockBoundary = true;
            }
            continue;
        }
        // a fence lives in the CONTAINER that opened it, per CommonMark
        if (fence && depth < fence.depth) {
            // The fence's blockquote ended and took the fence with it
            // (bug-blockquote-fence-outlives-quote). This line is ordinary
            // text and gets the full treatment below, so a bare "```" here
            // OPENS a new fence (bug-bare-fence-after-blockquote-fence).
            fence = null;
        }
        if (fence) {
            inIndentedCode = false;
            // inDefinition survives a fence interior, for the same reason
            // as in the comment and math branches: a fence that belongs to
            // a definition's content ("    ```" sitting at the continuation
            // indent, 2026-08-25) is PART of that definition. Every other
            // fence's opener has already reset inDefinition before opening,
            // because an opener indented less than 4 columns runs the
            // re-decide below, and so does a list-marker opener line.
            // Nothing else changes.
            blockBoundary = false;
            isProtected[i] = true;
            startsInFence[i] = true;
            // A closer only counts at the fence's own depth. "> ```" can't
            // close a fence at the document level, where it is just code
            // content (bug-blockquote-closes-bare-fence), and a "```" at
            // the document level can't close a fence inside a blockquote,
            // which the branch above already handled by ending it.
            if (depth === fence.depth) {
                // the closer's indent is measured against the fence's
                // container: up to contentIndent + 3 leading spaces
                let lead = 0;
                while (lead < rest.length && rest[lead] === " ") lead++;
                const close =
                    lead <= fence.contentIndent + 3
                        ? rest.slice(lead).match(/^(`{3,}|~{3,})\s*$/)
                        : null;
                if (
                    close &&
                    close[1][0] === fence.char &&
                    close[1].length >= fence.length
                ) {
                    fence = null;
                    // a closed fence ends its block, so an indented chunk
                    // may open on the very next line (Sol bug #5)
                    blockBoundary = true;
                }
            }
            continue;
        }
        // ---- indented code (case C21), with definitions taken into account ----
        if (src[i].trim() === "") {
            // A blank line is a block boundary, but it ENDS neither an open
            // definition nor an open indented chunk. A run of blanks can
            // still lead to more continuation lines (findDefinitionBlocks),
            // and a code block carries on across blanks when more indented
            // lines follow.
            blockBoundary = true;
            quote = null; // a blank line ends every open blockquote
            continue; // nothing on a blank line can open a fence or a comment
        }
        if (depth === 0) {
            quote = null;
        } else {
            if (!quote || quote.depth !== depth) {
                quote = {
                    depth,
                    boundary: true,
                    inDefinition: false,
                    inCode: false,
                };
            }
            if (rest.trim() === "") {
                // a blank ">" line is a block boundary inside the quote
                quote.boundary = true;
            } else if (leadingIndentWidth(rest) >= 4) {
                if (quote.inCode || (quote.boundary && !quote.inDefinition)) {
                    quote.inCode = true;
                    quote.boundary = false;
                    isProtected[i] = true;
                    // This is code text: nothing on it opens a fence or a
                    // region, and like any quoted line it interrupts blocks
                    // at the document level.
                    inIndentedCode = false;
                    inDefinition = false;
                    blockBoundary = false;
                    continue;
                }
                // Live text: either a lazy paragraph continuation or a
                // definition continuation, and an open quoted definition
                // stays open.
                quote.boundary = false;
            } else {
                quote.inCode = false;
                quote.boundary = false;
                quote.inDefinition = definitionLabelIn(src[i]) !== null;
            }
        }
        const indentWidth = leadingIndentWidth(src[i]);
        // A non-blank line at a block boundary closes every list item it is
        // not indented far enough to sit inside. A lazy continuation, which
        // has no blank line above it, keeps its item open.
        if (blockBoundary) {
            while (
                listStack.length > 0 &&
                indentWidth < listStack[listStack.length - 1]
            ) {
                listStack.pop();
            }
        }
        const codeIndent =
            (listStack.length > 0 ? listStack[listStack.length - 1] : 0) + 4;
        const indented = indentWidth >= codeIndent;
        if (indented && inIndentedCode) {
            isProtected[i] = true;
            blockBoundary = false;
            continue;
        }
        if (indented && !inDefinition && blockBoundary) {
            // A chunk indented past the code threshold, opening at a block
            // boundary and outside any definition, is CommonMark indented
            // code. Obsidian treats it as inert text, so the transforms
            // must neither count it nor rewrite it.
            inIndentedCode = true;
            isProtected[i] = true;
            blockBoundary = false;
            continue;
        }
        // A line indented that far which reaches this point is a definition
        // continuation or a lazy paragraph continuation. Either way it is
        // live markdown, and it keeps an open definition open. A shallower
        // line decides both states afresh.
        const thematicBreak =
            depth === 0 && /^ {0,3}([-*_])( *\1){2,} *$/.test(rest);
        if (!indented) {
            inIndentedCode = false;
            // a line indented 4 or more columns continues an open
            // definition even inside a list's live range; only a shallower
            // line decides the question again
            if (indentWidth < 4) {
                inDefinition = DefinitionStart.test(src[i]);
            }
            // A list-item marker OPENS a container. Its content indent is
            // the marker's column, plus the marker's own width, plus the
            // gap after it; CommonMark counts a gap of 5 or more, or no gap
            // at all, as 1. A thematic break ("- - -") is not a list item.
            if (depth === 0 && !thematicBreak) {
                const item = src[i].match(/^( *)([-+*]|\d{1,9}[.)])( +|$)/);
                if (item) {
                    while (
                        listStack.length > 0 &&
                        indentWidth < listStack[listStack.length - 1]
                    ) {
                        listStack.pop();
                    }
                    const gap =
                        item[3].length === 0 || item[3].length > 4
                            ? 1
                            : item[3].length;
                    listStack.push(item[1].length + item[2].length + gap);
                }
            }
        }
        // Lazy continuation applies to paragraphs only. A "#" heading or a
        // thematic break ends its block outright, so an indented chunk may
        // open on the very next line (Sol bug #5).
        blockBoundary =
            thematicBreak ||
            (depth === 0 && /^ {0,3}#{1,6}(?: |$)/.test(rest));

        // A fence can also open on a LIST ITEM line ("- ```", "1. ~~~").
        // The list marker is a container prefix, just like the blockquote
        // one. Its closer arrives indented into the item, which the closer
        // pattern's allowance of 0 to 3 spaces already accepts
        // (bug-list-item-fence).
        let fenceLine = rest;
        let open = fenceLine.match(/^( {0,3})(`{3,}|~{3,})/);
        if (!open) {
            const afterListMarker = rest.replace(
                /^ {0,3}(?:[-+*]|\d{1,9}[.)]) +/,
                "",
            );
            if (afterListMarker !== rest) {
                fenceLine = afterListMarker;
                open = fenceLine.match(/^( {0,3})(`{3,}|~{3,})/);
            }
        }
        // Inside a list item, a fence's indent is measured from the ITEM's
        // content column, not from the document margin (2026-08-11 review
        // bug #3, ground-truthed in the live reading view). "    ```" under
        // "- a" sits at a relative indent of 2, so it is a real fence, and
        // its closer lines up with the item's content column.
        let listFenceContentIndent: number | null = null;
        if (!open && depth === 0 && listStack.length > 0) {
            const contentColumn = listStack[listStack.length - 1];
            const wide = rest.match(/^( *)(`{3,}|~{3,})/);
            if (wide && wide[1].length <= contentColumn + 3) {
                fenceLine = rest;
                open = wide;
                listFenceContentIndent = contentColumn;
            }
        }
        // ...and the same inside an open DEFINITION, whose continuation
        // lines sit at content column 4. A "    ```" there is a real fence,
        // exactly like the list case above, because GFM treats a footnote
        // definition as a container in the same way. Comment and math
        // openers here already ignored indentation while fences did not,
        // and the delete-orphaned-references rule ATE code text out of the
        // unprotected interior (hunt 2026-08-25,
        // bug-definition-continuation-fence-unprotected).
        if (!open && depth === 0 && inDefinition) {
            const wide = rest.match(/^( *)(`{3,}|~{3,})/);
            if (wide && wide[1].length <= 4 + 3) {
                fenceLine = rest;
                open = wide;
                listFenceContentIndent = 4;
            }
        }
        if (open && isFenceOpener(fenceLine, open[2])) {
            fence = {
                char: open[2][0],
                length: open[2].length,
                depth,
                // When the fence opened on a list item line, the column where
                // the item's text starts (the list marker's width plus the
                // opener's own indent) is the column the closing fence has to
                // line up with.
                contentIndent:
                    listFenceContentIndent ??
                    rest.length - fenceLine.length + open[1].length,
            };
            isProtected[i] = true;
            continue;
        }
        // An Obsidian "%%" block comment opens on a "%%" at the start of a
        // line that has no partner on that line (opensCommentBlock). From
        // there on everything is hidden until the closer, so an HTML or
        // math opener inside the block is only comment text. That is why
        // this check must come BEFORE the HTML and math one below: run the
        // other way round, a "<!--" inside the block would open a real
        // comment region.
        if (
            src[i].includes("%%") &&
            opensCommentBlock(
                src[i],
                rest,
                depth,
                listStack.length > 0 ? listStack[listStack.length - 1] : null,
                inDefinition,
            )
        ) {
            commentBlock = { depth };
            inCommentBlock[i] = true;
            continue;
        }
        // A multi-line HTML comment, meaning an unescaped opener outside
        // code with no closer on its line, hides everything through to its
        // closing line: a "[^x]:" inside it is commented-out text, not a
        // live definition. The same goes for an unclosed "$$" opening a
        // display-math block. The opener's own line stays live up to the
        // opener.
        if (src[i].includes("<!--") || src[i].includes("$$")) {
            const opened = maskLineRegions(src[i]);
            inComment = opened.endsInComment;
            inMath = opened.endsInMath;
            if (inComment || inMath) regionDepth = depth;
        }
    }
    if (src.length > 0) endsProtectedAt[src.length - 1] = endsProtectedNow();
    return {
        isProtected,
        startsInComment,
        startsInMath,
        startsInFence,
        endsProtected: endsProtectedNow(),
        endsProtectedAt,
        inCommentBlock,
        commentBlockCloseAt,
    };
}

/**
 * The lines the transforms must not read or touch AT ALL; DocumentScan says
 * which lines those are. A caller that also scans the content of lines
 * wants maskProtectedLines instead, which additionally masks the comment
 * part of a boundary line.
 */
export function protectedLines(lines: string[]): boolean[] {
    return scanDocument(lines).isProtected;
}

/**
 * The line with its inline code spans and complete HTML comments blotted
 * out, every position left where it was. For single-line contexts only,
 * such as the text of a table cell. Lines of a document want
 * maskProtectedLines, which knows about multi-line comment state.
 */
export function maskInlineRegions(line: string): string {
    return maskLineRegions(line).masked;
}

/**
 * The document's masked twin: every line with code, comments, and
 * frontmatter blotted out. A protected line becomes a string of NULs. In
 * the rest, inline code spans, complete comments, and the comment PART of a
 * multi-line boundary line are masked.
 *
 * Lengths and positions line up with the originals, so a scan over the twin
 * sees no code while every position it finds is still valid in the real
 * line. Pass a `scan` already worked out to save walking the document again
 * when the caller has run scanDocument itself.
 */
export function maskProtectedLines(
    lines: string[],
    scan: DocumentScan = scanDocument(lines),
): string[] {
    return lines.map((line, i) =>
        scan.isProtected[i]
            ? "\0".repeat(line.length)
            : maskLineRegions(line, {
                  comment: scan.startsInComment[i],
                  math: scan.startsInMath[i],
              })
                  .masked,
    );
}

/**
 * Line `i` of the document's masked twin, without masking any of the other
 * lines. The paths that run on every keypress need exactly the caret's
 * line. Working out what is protected still takes the whole-document walk,
 * but that walk is cheap line-prefix checks; the expensive part, masking
 * the inline regions, then runs on one line instead of all of them
 * (performance, 2026-08-07). An `i` outside the document returns "".
 */
export function maskedLineAt(lines: string[], i: number): string {
    if (i < 0 || i >= lines.length) return "";
    return maskLineWithScan(lines, scanDocument(lines), i);
}

/**
 * Line `i` of the masked twin, when a scan of `lines` is already in hand.
 * This is the ONE body shared by maskedLineAt, which scans on the spot, and
 * DocContext.maskedLine, which keeps its scan; the two were byte-identical
 * copies of each other (review B4, 2026-09-09). Returns "" when `i` is out
 * of range.
 */
export function maskLineWithScan(
    lines: string[],
    scan: Pick<DocumentScan, "isProtected" | "startsInComment" | "startsInMath">,
    i: number,
): string {
    if (i < 0 || i >= lines.length) return "";
    const line = lines[i];
    return scan.isProtected[i]
        ? "\0".repeat(line.length)
        : maskLineRegions(line, {
              comment: scan.startsInComment[i],
              math: scan.startsInMath[i],
          }).masked;
}

/**
 * The lines with the given ranges cut out, both ends of each range
 * included. Where a cut leaves two blank lines next to each other, they
 * collapse into one, so removing a block never leaves a double gap behind.
 */
export function removeLineRanges(
    lines: string[],
    ranges: { start: number; end: number }[],
): string[] {
    const rangeAtLine = new Map(ranges.map((range) => [range.start, range]));
    const out: string[] = [];
    let mergeBlanks = false;
    for (let i = 0; i < lines.length; i++) {
        const range = rangeAtLine.get(i);
        if (range) {
            i = range.end;
            mergeBlanks = true;
            continue;
        }
        if (
            mergeBlanks &&
            lines[i] === "" &&
            (out.length === 0 || out[out.length - 1] === "")
        ) {
            continue; // keep merging until a non-blank line arrives
        }
        // A cut must not drop a paragraph straight onto a "---" or "==="
        // line, a quoted "> ---" included
        // (bug-blockquote-setext-residue). Markdown would read the two
        // together as a setext heading, turning the stranded text into a
        // heading. A blank separator goes back in only when the two lines
        // have just become neighbours, which is what mergeBlanks means: no
        // blank line between them survived the cut.
        if (
            mergeBlanks &&
            out.length > 0 &&
            out[out.length - 1] !== "" &&
            /^\s{0,3}(-+|=+)\s*$/.test(lines[i].replace(BlockquotePrefix, ""))
        ) {
            out.push("");
        }
        // Nor may a cut promote a "---" to the very START of the document.
        // There it reads as a frontmatter opener and swallows the live
        // prose up to the next divider, and reindex with orphan deletion
        // then removes the definitions whose references it had hidden
        // (bug-stranded-frontmatter). A blank line in front keeps it an
        // ordinary divider.
        if (mergeBlanks && out.length === 0 && lines[i] === "---") {
            out.push("");
        }
        mergeBlanks = false;
        out.push(lines[i]);
    }
    return out;
}

/**
 * Which lines START a live footnote definition. A start is a label, at
 * column 0, indented up to three spaces, or behind blockquote markers, on a
 * line that is allowed to begin a block.
 *
 * Obsidian does not let a footnote definition interrupt a paragraph, the
 * same way CommonMark does not let a link reference definition do it. A
 * label directly under a line of prose (paragraph text, a list item, a
 * quote line, a table row, or a lazy continuation of any of those) is lazy
 * paragraph text: it renders as the plain characters "[^x]: ..." and makes
 * no footnote. Ground truth in Reading view 2026-09-09 (manual sheet 25),
 * and Jason's ruling the same day was to match Obsidian.
 *
 * A label may start after a blank line (a bare ">" inside a quote counts as
 * one), at the note start, after a protected line (a fence closer, a
 * comment, frontmatter, indented code), after a heading, after a thematic
 * break, or after another definition, meaning its label or any of its
 * continuation lines, blank gaps included.
 *
 * Note that micromark's GFM footnotes DO let a definition interrupt a
 * paragraph, so the differential oracle cannot referee this rule.
 *
 * The cheap check against the RAW line runs first, so only label-shaped
 * lines are ever masked.
 */
export function definitionStartLines(
    lines: string[],
    scan: Pick<
        DocumentScan,
        "isProtected" | "startsInComment" | "startsInMath" | "startsInFence" | "inCommentBlock" | "commentBlockCloseAt"
    >,
    maskedAt: (i: number) => string,
): boolean[] {
    const starts = new Array<boolean>(lines.length).fill(false);
    // What the lines so far leave open for the next line: nothing, so a
    // label may start; a paragraph, so a label is lazy text; a definition,
    // so a label starts the next one; or a definition with a blank gap
    // behind it, where indented content still continues it and anything
    // else closes it.
    type Open = "none" | "paragraph" | "definition" | "definition-gap";
    let open = "none" as Open;
    let previousDepth = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const { depth } = blockquoteDepth(line);
        // A deeper blockquote marker opens a container, and a quote does
        // interrupt a paragraph: "prose" followed by "> [^1]: quoted" is a
        // definition (ground truth 2026-09-09). A SHALLOWER line is a lazy
        // continuation instead.
        if (depth > previousDepth) open = "none";
        previousDepth = depth;
        if (scan.isProtected[i]) {
            // A protected line INSIDE a definition's content keeps the
            // definition open: an indented fence or math block, or a
            // comment run one of its continuation lines opened. The test is
            // the block walker's own absorb rule, a four-space indent or a
            // region flag. A construct at column 0 ends whatever was open.
            const inDefinition = open === "definition" || open === "definition-gap";
            open =
                inDefinition &&
                (/^ {4}/.test(line) ||
                    scan.startsInComment[i] ||
                    scan.startsInMath[i] ||
                    scan.startsInFence[i])
                    ? "definition"
                    : "none";
            continue;
        }
        // Inside a "%%" block comment no label starts at all: Obsidian
        // hides the block, so the definition there is dead (ground truth
        // 2026-09-09). Its closer ends the block, so a label directly under
        // a bare closer IS a definition, while live text after the closer
        // on the same line starts a paragraph.
        if (scan.inCommentBlock[i]) {
            const close = scan.commentBlockCloseAt[i];
            if (close >= 0) open = line.slice(close).trim() === "" ? "none" : "paragraph";
            continue;
        }
        const bare = line.replace(BlockquotePrefix, "");
        if (bare.trim() === "") {
            open = open === "definition" || open === "definition-gap" ? "definition-gap" : "none";
            continue;
        }
        if (IndentedContent.test(bare) && !DefinitionStart.test(bare)) {
            // A continuation of whatever is open. After a blank line with
            // nothing open, an indent of 1 to 3 spaces starts a paragraph;
            // 4 or more would be code, which the scan already protected
            // above.
            open = open === "definition" || open === "definition-gap" ? "definition" : "paragraph";
            continue;
        }
        // An HTML comment line is an HTML block (CommonMark type 2), not
        // paragraph text, so a label directly under "<!-- c -->", or under
        // the "-->" line that closes a multi-line comment, is a definition
        // (ground truth 2026-09-09). An inline "%% c %%" line is the
        // opposite: it counts as a paragraph line, and a label under it
        // stays lazy.
        if (scan.startsInComment[i] || /^ {0,3}<!--/.test(bare)) {
            open = "none";
            continue;
        }
        if (open !== "paragraph" && definitionLabelIn(line) !== null) {
            const hit = definitionLabelWithName(line, maskedAt(i));
            if (hit) {
                starts[i] = true;
                open = "definition";
                continue;
            }
        }
        if (
            /^ {0,3}#{1,6}(?:\s|$)/.test(bare) ||
            /^ {0,3}([-*_])(?: *\1){2,} *$/.test(bare) ||
            // A line of "=" signs under a paragraph turns that paragraph into
            // a heading (Markdown's "setext" heading), so the paragraph is
            // over. "H" / "===" / "[^1]: real" is therefore a definition
            // (ground truth 2026-09-09).
            (open === "paragraph" && /^ {0,3}=+ *$/.test(bare)) ||
            // A callout's title line ("> [!note]- Title") is not paragraph
            // text, so a label right under it is a definition. A label under
            // the callout's BODY text is not (ground truth 2026-09-09).
            /^\[![^\]]*\][+-]?/.test(bare)
        ) {
            open = "none";
            continue;
        }
        open = "paragraph";
    }
    return starts;
}

/**
 * Every definition together with its continuation lines: the indented lines
 * under it, plus blank runs that lead on to more indented lines.
 *
 * Pass the full `scan` when you have one. A continuation line can OPEN a
 * multi-line comment or math region ("    $$"), or a fence that belongs to
 * the definition's content ("    ```", 2026-08-25), and only the scan's
 * startsIn* facts let this walk absorb that construct's protected interior
 * instead of splitting the block in half (Sol bug #3, 2026-08-10).
 *
 * Labels are read through the MASKED twin, like every other definition
 * reader. A comment CLOSER line such as "[^2]: two -->" is left unprotected
 * for the sake of the live text after the closer, but the label inside the
 * comment is not a definition (review A1, 2026-09-08: move-to-bottom used
 * to drag the "-->" away and leave the comment unclosed).
 *
 * `scan` is the document's scan, taken here when it is omitted; every
 * caller used to pass scan.isProtected alongside it (review C2). Pass
 * `maskedLines` when the twin is already at hand; without it, only the
 * label-shaped lines are masked, one at a time. Pass `starts` when the
 * caller already holds definitionStartLines' answer (a label under a line
 * of prose is lazy text, not the start of a block).
 */
export function findDefinitionBlocks(
    lines: string[],
    scan: Pick<
        DocumentScan,
        "isProtected" | "startsInComment" | "startsInMath" | "startsInFence" | "inCommentBlock" | "commentBlockCloseAt"
    > = scanDocument(lines),
    maskedLines?: string[],
    starts?: boolean[],
): DefinitionBlock[] {
    const isProtected = scan.isProtected;
    const maskedAt = (j: number): string => {
        if (maskedLines) return maskedLines[j];
        return maskLineWithScan(lines, scan, j);
    };
    const startsAt = starts ?? definitionStartLines(lines, scan, maskedAt);
    // A protected line the walk is allowed to absorb into an open block.
    // Two shapes qualify. One is the interior or closer of a comment, math,
    // or fence region whose opener was a continuation line already absorbed
    // into this block; a region that was open BEFORE the definition would
    // have protected the label line itself. The other is a protected line
    // AT THE CONTINUATION INDENT, four spaces or more: the opener of a
    // construct the definition owns, such as the "    ```" fence riding
    // that indent (hunt 2026-08-25).
    //
    // The indent floor is what separates the two cases. A fence opener at
    // the DOCUMENT level that happens to carry a space or two (" ```") is
    // protected and indented as well, yet it ends the block. Only the
    // four-space column, past the 3-space cap an ordinary block start
    // allows, marks a construct the definition owns.
    const absorbable = (j: number) =>
        isProtected[j] &&
        (scan.startsInComment[j] ||
            scan.startsInMath[j] ||
            scan.startsInFence[j] ||
            /^ {4}/.test(lines[j]));
    const blocks: DefinitionBlock[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (!startsAt[i]) continue;
        // Blocks at column 0, or indented ones, only. To the orphan rules a
        // blockquoted label is a live definition on its own line, but it
        // never forms a block here.
        if (!DefinitionStart.test(lines[i])) continue;
        const hit = definitionLabelWithName(lines[i], maskedAt(i));
        if (!hit) continue;

        let end = i;
        let j = i + 1;
        while (j < lines.length) {
            if (isProtected[j]) {
                if (absorbable(j)) {
                    end = j++;
                    continue;
                }
                break;
            }
            if (IndentedContent.test(lines[j]) && !DefinitionStart.test(lines[j])) {
                end = j++;
                continue;
            }
            if (lines[j].trim() !== "") break;
            // a run of blank lines continues the block only when indented
            // content follows it: either unprotected content, or a
            // construct the block may absorb
            let k = j;
            while (k < lines.length && lines[k].trim() === "") k++;
            if (
                k < lines.length &&
                ((!isProtected[k] &&
                    IndentedContent.test(lines[k]) &&
                    !DefinitionStart.test(lines[k])) ||
                    absorbable(k))
            ) {
                end = k;
                j = k + 1;
            } else {
                break;
            }
        }
        blocks.push({ name: hit.name, start: i, end });
        i = end;
    }
    return blocks;
}

/**
 * The lines whose label-shaped start is NOT a definition start: lazy
 * paragraph text as far as Obsidian is concerned (the prose-label rule).
 * Protected lines never count. `masked` and `starts` are the document's
 * masked twin and definitionStartLines' answer.
 */
export function lazyDefinitionLabelLines(
    lines: string[],
    scan: DocumentScan,
    masked: string[],
    starts: boolean[],
): number[] {
    const out: number[] = [];
    for (let i = 0; i < lines.length; i++) {
        // a label inside a "%%" block comment is dead text, not a
        // definition one blank line short of working, so there is nothing
        // to report and nothing to fix
        if (scan.isProtected[i] || starts[i] || scan.inCommentBlock[i]) continue;
        if (definitionLabelWithName(lines[i], masked[i])) out.push(i);
    }
    return out;
}
