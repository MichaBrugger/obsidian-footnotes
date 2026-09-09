// Pure scanning primitives shared by the whole-document footnote
// transforms (reindex, move-to-bottom, after-punctuation). Nothing here
// touches an Editor - everything is lines in, facts out.

/** A footnote definition at the start of a line ("[^x]: …"), indented up to three spaces like any block start - four is indented code. Ground truth in Obsidian's Reading view (2026-09-09): "  [^1]: x" renders as a definition, even directly under another definition, where it starts a NEW footnote rather than continuing the one above (review A2). */
const DefinitionStart = /^ {0,3}\[\^([^[\]]+)\]:/;

/**
 * The trailing punctuation the insert commands hop over - the same class
 * the footnote-after-punctuation lint reorders, so the two features can't
 * disagree about where a reference belongs. ASCII plus the CJK fullwidth
 * forms 。，、；：！？ (Jason, 2026-08-10). Lives here because this leaf
 * is the one module BOTH consumers (cursor-motion and the lint rule)
 * already sit above - the pre-split cycle that once forced this home is
 * gone, but no better shared home exists.
 */
export const TrailingPunctuationChars = ".,;:!?。，、；：！？";
// a continuation line belongs to the definition above it - unless it is
// itself a label indented 1-3 spaces, which starts the NEXT definition
// (DefinitionStart; the walker checks both)
const IndentedContent = /^\s+\S/;

export interface DefinitionBlock {
    name: string;
    /** inclusive line range, continuation lines included */
    start: number;
    end: number;
}

/**
 * A trailing "\r" stripped from each line so a CRLF document split on "\n"
 * satisfies the same exact-string line checks ("---", fence delimiters) as an
 * LF one - the array's length and indices are unchanged. Windows/synced notes
 * arrive as CRLF, and without this the frontmatter/fence scans silently miss.
 */
function stripCr(lines: string[]): string[] {
    return lines.map((line) =>
        line.endsWith("\r") ? line.slice(0, -1) : line,
    );
}

/**
 * `text` with CRLF newlines flattened to LF, plus the EOL to restore. The
 * whole-document transforms work in LF and put the note's original endings
 * back on the way out - Obsidian edits notes in place, so we must not
 * silently flip a synced CRLF file to LF the way a strip-and-forget would.
 */
export function normalizeEol(text: string): {
    text: string;
    eol: "\n" | "\r\n";
} {
    return text.includes("\r\n")
        ? { text: text.replace(/\r\n/g, "\n"), eol: "\r\n" }
        : { text, eol: "\n" };
}

/** Re-apply the original EOL to an LF-normalized transform result. */
export function restoreEol(text: string, eol: "\n" | "\r\n"): string {
    return eol === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

// A leading blockquote/callout prefix ("> ", "> > ", …): a fenced code block
// can sit inside a blockquote/callout, and its delimiters carry that prefix.
// Each ">" marker owns one optional trailing space, and the NEXT marker may
// sit up to 3 spaces further in - the same walk blockquoteDepth does. The
// old /^(?: {0,3}>)+ ?/ didn't consume the per-marker space, so a legal
// ">    > [^1]: x" (4 gap = marker space + 3 indent) lost its second marker
// and the label behind it went invisible (2026-08-11 review bug #5).
const BlockquotePrefix = /^(?: {0,3}> ?)+/;

/**
 * The line's blockquote nesting depth (number of leading ">" markers, each
 * allowed 0–3 spaces before it and one space after, per CommonMark) and the
 * text after the markers. A fence lives in the container that opened it -
 * depth is how the fence scan knows which container that is.
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
        if (line[j] === " ") j++; // one optional space belongs to the marker
        depth++;
        i = j;
    }
    return { depth, rest: line.slice(i) };
}

/**
 * The footnote definition label on `line` - at column 0, or behind a
 * blockquote/callout prefix ("> [^x]: …" - Jason's ruling 2026-08-10:
 * footnote creation, navigation, and linting work inside
 * blockquotes/callouts). Positions index into the SAME line passed in, so
 * callers can re-slice the raw line when they matched the masked twin (a
 * code span inside the name masks to NULs). Null when the line carries no
 * label.
 */
export function definitionLabelIn(line: string): DefinitionLabel | null {
    const prefix = line.match(BlockquotePrefix)?.[0].length ?? 0;
    const match = line.slice(prefix).match(DefinitionStart);
    if (!match) return null;
    // whatever DefinitionStart matched before "[^": the 0-3 space indent
    const indent = match[0].length - match[1].length - "[^]:".length;
    const nameStart = prefix + indent + 2;
    return {
        nameStart,
        nameEnd: nameStart + match[1].length,
        labelEnd: prefix + match[0].length,
        quoted: prefix > 0,
    };
}

/** Where a definition label sits on its line: the name's span, the end of the whole "[^name]:" label, and whether a blockquote/callout marker precedes it (a quoted label is a live single-line definition but never part of a column-0 definition BLOCK, C22). */
export interface DefinitionLabel {
    nameStart: number;
    nameEnd: number;
    labelEnd: number;
    quoted: boolean;
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
 * The first exact, fully unprotected occurrence of `runLines` in `lines`,
 * as the index of the run's LAST line - or -1. The section-heading setting
 * is markdown that can span multiple lines ("---\n## Footnotes"), so both
 * the insert flow (buildDefinitionAppend's heading slot) and the
 * move-to-bottom rule anchor on the whole run through THIS function - two
 * hand-rolled copies would let the fixed-point guarantee drift
 * (2026-08-11 review cleanliness).
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
 * Whether a line already known to start with a fence delimiter actually opens
 * a fence. Per CommonMark a backtick fence's info string may not contain a
 * backtick - "```[^1]``` x" is an inline code span in a paragraph, not a
 * fence - so opening one there would run unclosed to EOF. Tilde fences have
 * no such rule.
 */
function isFenceOpener(bareLine: string, delim: string): boolean {
    if (delim[0] !== "`") return true;
    const rest = bareLine.slice(bareLine.indexOf(delim) + delim.length);
    return !rest.includes("`");
}

/**
 * Whether the character at `i` sits inside a footnote-reference shape
 * ("[^…]"). Obsidian tokenizes the bracket construct first, so a "$" inside
 * a reference is footnote-id text, never a math opener or closer (Jason
 * verified live 2026-08-10), and so is a backtick: "[^aa`a] [^bb#b]
 * [^cc`c]" renders no code span and "[^bb#b]" is a live footnote, while
 * pairing the two backticks used to swallow the middle reference into one
 * merged name (his find 2026-09-08). Nearest bracket wins: a "[" with a
 * "^" behind it and no "]" in between means we're inside a reference.
 * The walk reads the MASKED-SO-FAR characters, not the raw line: a "[^"
 * fragment already claimed by a code span or comment is not a live bracket,
 * and used to falsely suppress math masking for the rest of the line
 * (bug-dollar-inside-masked-bracket) - a NUL therefore ends the walk, and
 * the shape must also close with a "]" ahead of `i` (an unclosed "[^" is
 * a bracket, not a reference).
 * Being FOUND as a reference says nothing about validity: a name with a
 * backtick is still invalid, and the lint now reports it by name.
 *
 * Answered from two state tables over the masked-so-far characters
 * instead of walking outward from every candidate: the outward walk ran
 * to the start of the line whenever no bracket or NUL lay behind the
 * candidate, and the closing-candidate loops asked it once per dollar or
 * backtick, so a long line of prices masked in quadratic time (8000
 * characters: 344 ms per mask, and a lint masks the note about ten
 * times; review B1, 2026-09-09). The tables are rebuilt lazily after a
 * blot, since a fresh NUL is a wall for both walks.
 */
class ReferenceShapeIndex {
    private before: boolean[] | null = null;
    private after: boolean[] | null = null;

    constructor(private readonly chars: readonly string[]) {}

    /** Forget the tables: a blot wrote NULs the walks must now stop at. */
    invalidate(): void {
        this.before = null;
        this.after = null;
    }

    inside(i: number): boolean {
        if (this.before === null || this.after === null) this.build();
        return (this.before as boolean[])[i] && (this.after as boolean[])[i];
    }

    private build(): void {
        const chars = this.chars;
        const n = chars.length;
        // before[j]: walking back from j, the nearest of "[", "]", NUL is a
        // "[" followed by "^" (the original backward walk, run forward once)
        const before = new Array<boolean>(n);
        let opened = false;
        for (let j = 0; j < n; j++) {
            before[j] = opened;
            const c = chars[j];
            if (c === "\0" || c === "]") opened = false;
            else if (c === "[") opened = chars[j + 1] === "^";
        }
        // after[j]: walking forward from j + 1, a "]" comes before any "[",
        // NUL, or the end of the line - the shape must CLOSE ahead: an
        // unclosed "[^" is a bracket, not a reference ("`[^` $[^1].$" keeps
        // its code span and its math; the backtick guard would otherwise
        // never let that span close, and the dollar guard would hide the math)
        const after = new Array<boolean>(n);
        let closes = false;
        for (let j = n - 1; j >= 0; j--) {
            after[j] = closes;
            const c = chars[j];
            if (c === "\0" || c === "[") closes = false;
            else if (c === "]") closes = true;
        }
        this.before = before;
        this.after = after;
    }
}

/**
 * One left-to-right scan of a line for inline code spans, HTML comments,
 * and math ($…$ / $$…$$), NULing all three, CommonMark-style: whichever
 * construct opens first claims its content - backticks inside a comment
 * are literal, "<!--" inside a code span is code (bug-comment-mask-order /
 * bug-backticked-comment-opener), "$" inside either is just a dollar.
 * Backslash-escaped openers of every kind are literal text
 * (bug-escaped-comment-opener), and the abbreviated comments "<!-->" and
 * "<!--->" are complete per CommonMark §6.6 (bug-short-form-comment).
 * Inline math needs a non-empty content that neither starts nor ends with
 * a space (Obsidian's rule - "$5 and $10" stays prose). `startInComment` /
 * `startInMath` continue a multi-line region from the previous line;
 * `endsInComment` / `endsInMath` report one left open at EOL (its opener
 * masked through the end of the line). Math protection is Jason's 2026-08-10
 * ruling: linting never touches math.
 */
export function maskLineRegions(
    line: string,
    // named state instead of two positional booleans - call sites like
    // `maskLineRegions(line, { math: true })` say which region continues
    startsIn: { comment?: boolean; math?: boolean } = {},
): { masked: string; endsInComment: boolean; endsInMath: boolean } {
    const startInComment = startsIn.comment ?? false;
    const startInMath = startsIn.math ?? false;
    // fast path: nothing on the line can open or close any construct
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
    const shapes = new ReferenceShapeIndex(chars);
    const insideReferenceShape = (_chars: readonly string[], at: number) => shapes.inside(at);
    const blot = (from: number, to: number) => {
        for (let k = from; k < to; k++) chars[k] = "\0";
        shapes.invalidate();
    };
    let i = 0;

    if (startInComment) {
        // comment content is literal - the first "-->" closes, full stop
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
        // display-math content is literal - the first "$$" closes it
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
            i += 2; // an escaped character can't open a span or a comment
            continue;
        }
        if (c === "`") {
            // a backtick inside "[^…]" is footnote-id text, not a code opener
            if (insideReferenceShape(chars, i)) {
                while (line[i] === "`") i++;
                continue;
            }
            const runStart = i;
            while (line[i] === "`") i++;
            const runLength = i - runStart;
            // find the next backtick run of exactly the same length.
            // Backslashes are literal inside a code span, so the closing
            // search does NOT skip escapes - only the opener is unescaped.
            let close = -1;
            for (let j = i; j < line.length; ) {
                if (line[j] !== "`") {
                    j++;
                    continue;
                }
                const candidate = j;
                while (line[j] === "`") j++;
                // a run inside "[^…]" can't close either (see the opener guard)
                if (j - candidate === runLength && !insideReferenceShape(chars, candidate)) {
                    close = candidate;
                    break;
                }
            }
            if (close === -1) continue; // unclosed run: literal backticks
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
                // a multi-line comment opens here and runs past EOL
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
            // a dollar inside "[^…]" is footnote-id text, not math
            if (insideReferenceShape(chars, i)) {
                i++;
                continue;
            }
            if (line.startsWith("$$", i)) {
                const close = line.indexOf("$$", i + 2);
                if (close === -1) {
                    // display math opens here and runs past EOL
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
            // inline math: closing "$" with non-empty content that neither
            // starts nor ends with a space - otherwise the dollar is prose.
            // Dollars inside "[^…]" can't close either (see the opener guard)
            let close = -1;
            for (let j = i + 1; j < line.length; j++) {
                if (line[j] === "\\") {
                    j++;
                    continue;
                }
                if (line[j] === "$" && !insideReferenceShape(chars, j)) {
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
                i++; // not math - the closing candidate may open its own
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
    /** Whole-line protected: YAML frontmatter, fenced code (delimiters included), standalone indented code, and multi-line comment/math INTERIOR lines. Boundary lines are NOT here - their live portions stay scannable, with the comment/math part masked (bug-comment-boundary-lines). */
    isProtected: boolean[];
    /** Line `i` begins inside a multi-line HTML comment (it is a closer or interior line). */
    startsInComment: boolean[];
    /** Line `i` begins inside a multi-line $$ math block (closer or interior line). */
    startsInMath: boolean[];
    /** Line `i` begins inside an open fenced code block (interior or closer line, at any blockquote depth - the flag the selection edge-cut checks need, since a QUOTED fence is invisible to `endsProtected`). The opener line is NOT here, and neither is a line that killed a quoted fence by ending its quote. */
    startsInFence: boolean[];
    /** A line appended at EOF would itself be protected: an unclosed comment, math block, or DOCUMENT-LEVEL fence runs to EOF (a blockquoted fence dies at the append point - the appended line ends its quote). Replaces move-to-bottom's probe re-scan (perf F6). */
    endsProtected: boolean;
}

/** Width of the line's leading whitespace, tabs expanding to 4-column tab stops (CommonMark). */
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
 * The whole-document protection walk: YAML frontmatter, fenced code blocks
 * (both delimiter lines included, including fences nested in
 * blockquotes/callouts), multi-line HTML comments - whose state is tracked
 * by the same escape- and code-span-aware scanner that does the masking, so
 * the two can't disagree - and STANDALONE indented code blocks (Jason's
 * ruling 2026-08-10: linting never touches code). "Standalone" is the
 * definition-aware part: an indented line continuing a footnote definition
 * (or lazily continuing a paragraph) is live markdown; only a 4-space/tab
 * chunk opening at a block boundary outside any definition is code.
 */
export function scanDocument(lines: string[]): DocumentScan {
    const src = stripCr(lines);
    const isProtected = new Array<boolean>(lines.length).fill(false);
    const startsInComment = new Array<boolean>(lines.length).fill(false);
    const startsInMath = new Array<boolean>(lines.length).fill(false);
    const startsInFence = new Array<boolean>(lines.length).fill(false);
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

    // contentIndent: the column the fence's CONTAINER content starts at -
    // 0 for a document-level fence, the list item's content column when
    // the opener rode a list-marker line ("10. ```"). A closer may be
    // indented up to contentIndent + 3 (Sol bug #1: the old absolute
    // {0,3} test let "    ```" never close a "10. ```" fence, which then
    // swallowed the rest of the note).
    let fence: {
        char: string;
        length: number;
        depth: number;
        contentIndent: number;
    } | null = null;
    // comment/math regions live in the CONTAINER that opened them, like
    // fences (Sol bug #4, verified against metadataCache): regionDepth is
    // the blockquote depth at the opener - a line whose depth drops below
    // it ends the quote and the region with it
    let inComment = false;
    let inMath = false;
    let regionDepth = 0;
    // indented-code state (C21): `blockBoundary` marks a place indented
    // code may OPEN - doc start, blank lines, and (Sol bug #5: lazy
    // continuation is paragraph-only) right after an ATX heading, a
    // closed fence, a bare region closer, or a thematic break.
    // `inDefinition` mirrors findDefinitionBlocks' reach - a "[^x]:" line
    // plus its indented continuations and the blank runs between them -
    // and `inIndentedCode` is an open indented chunk.
    let inIndentedCode = false;
    let inDefinition = false;
    let blockBoundary = true;
    // open list items' CONTENT indents, innermost last (Sol bug #2,
    // 2026-08-10, verified against metadataCache): a loose list's indented
    // continuation ("- a", blank, "    details") is LIVE list content -
    // indented code inside an item starts 4 columns past the item's
    // content indent, not at column 4 of the document. Doc-level only;
    // quoted lists ride their quote's existing rules.
    const listStack: number[] = [];
    // quote-relative indented code (2026-08-11 review bug #4, ground-
    // truthed in the live reading view): quote content indented ≥ 4 columns
    // past the innermost ">" marker is code when it opens at a boundary
    // INSIDE the quote - the quote's start or a blank ">" line - but stays
    // LIVE as a lazy paragraph continuation or a definition continuation.
    // Innermost-quote state only; a depth change re-enters at a boundary.
    let quote: {
        depth: number;
        boundary: boolean;
        inDefinition: boolean;
        inCode: boolean;
    } | null = null;
    for (; i < src.length; i++) {
        // the blockquote nesting where this line's container constructs
        // count - fences and comment/math regions live in the container
        // that opened them
        const { depth, rest } = blockquoteDepth(src[i]);
        if ((inComment || inMath) && depth < regionDepth) {
            // the region's blockquote ended, taking it along (a blank or
            // shallower line ends the quote) - this line is normal text
            // and gets the full treatment below
            inComment = false;
            inMath = false;
        }
        if (inComment) {
            startsInComment[i] = true;
            inIndentedCode = false;
            // inDefinition survives: a region OPENED by an indented
            // continuation ("    <!--") is definition content, and the
            // definition resumes after its closer (Sol bug #3)
            blockBoundary = false;
            if (!src[i].includes("-->")) {
                isProtected[i] = true; // interior: nothing live on it
                continue;
            }
            // the closer line keeps its live suffix - and that suffix can
            // itself open code, another comment, math, even a NEW
            // multi-line region of either kind
            const closed = maskLineRegions(src[i], { comment: true });
            inComment = closed.endsInComment;
            inMath = closed.endsInMath;
            // the closer's live suffix can open a NEW region - at this
            // line's own container depth
            if (inComment || inMath) regionDepth = depth;
            // a bare closer (no live suffix) ends a BLOCK - an indented
            // chunk may open right below (Sol bug #5)
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
            // inDefinition survives - same rationale as the comment branch
            blockBoundary = false;
            if (!src[i].includes("$$")) {
                isProtected[i] = true; // interior: nothing live on it
                continue;
            }
            const closed = maskLineRegions(src[i], { math: true });
            inMath = closed.endsInMath;
            inComment = closed.endsInComment;
            // same as the comment branch: a reopened region lives at this
            // line's own container depth
            if (inComment || inMath) regionDepth = depth;
            // a bare closer ends a block, same as the comment branch
            if (
                !inComment &&
                !inMath &&
                closed.masked.replace(/\0/g, " ").trim() === ""
            ) {
                blockBoundary = true;
            }
            continue;
        }
        // a fence lives in the CONTAINER that opened it (CommonMark)
        if (fence && depth < fence.depth) {
            // the fence's blockquote ended, taking the fence with it
            // (bug-blockquote-fence-outlives-quote) - this line is normal
            // text and gets the full treatment below, so a bare "```" here
            // OPENS a new fence (bug-bare-fence-after-blockquote-fence)
            fence = null;
        }
        if (fence) {
            inIndentedCode = false;
            // inDefinition survives a fence interior - same rationale as
            // the comment/math branches: a definition-content fence
            // ("    ```" at the continuation indent, 2026-08-25) is PART
            // of its definition. Every other fence's opener already reset
            // inDefinition before opening (an unindented opener runs the
            // <4-indent re-decide; a list-marker opener line does too),
            // so nothing else changes.
            blockBoundary = false;
            isProtected[i] = true;
            startsInFence[i] = true;
            // a closer counts only at the fence's own depth: "> ```" can't
            // close a document-level fence (it is code content there -
            // bug-blockquote-closes-bare-fence), and a doc-level "```"
            // can't close a blockquoted one (handled above by ending it)
            if (depth === fence.depth) {
                // closer indent is measured against the fence's container:
                // up to contentIndent + 3 leading spaces
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
                    // a closed fence ends its block - an indented chunk
                    // may open on the very next line (Sol bug #5)
                    blockBoundary = true;
                }
            }
            continue;
        }
        // ---- indented code (C21), definition-aware ----
        if (src[i].trim() === "") {
            // a blank is a block boundary, but it ENDS neither an open
            // definition (blank runs can lead to more continuation -
            // findDefinitionBlocks) nor an indented chunk (code blocks
            // continue across blanks when more indented lines follow)
            blockBoundary = true;
            quote = null; // a blank line ends every open blockquote
            continue; // nothing on a blank line can open a fence or comment
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
                // a blank ">" line is a block boundary within the quote
                quote.boundary = true;
            } else if (leadingIndentWidth(rest) >= 4) {
                if (quote.inCode || (quote.boundary && !quote.inDefinition)) {
                    quote.inCode = true;
                    quote.boundary = false;
                    isProtected[i] = true;
                    // code text: nothing on it opens a fence or a region,
                    // and it interrupts doc-level blocks like any quoted line
                    inIndentedCode = false;
                    inDefinition = false;
                    blockBoundary = false;
                    continue;
                }
                // live: a lazy paragraph continuation or a definition
                // continuation - an open quoted definition stays open
                quote.boundary = false;
            } else {
                quote.inCode = false;
                quote.boundary = false;
                quote.inDefinition = definitionLabelIn(src[i]) !== null;
            }
        }
        const indentWidth = leadingIndentWidth(src[i]);
        // a non-blank line at a block boundary closes every list item it
        // is not indented into (lazy continuations, which have no blank
        // above them, keep their item open)
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
            // a chunk indented past the code threshold, opening at a block
            // boundary outside any definition, is CommonMark indented code
            // - inert to Obsidian, so the transforms must not count or
            // rewrite it
            inIndentedCode = true;
            isProtected[i] = true;
            blockBoundary = false;
            continue;
        }
        // a code-indented line here is a definition continuation or a lazy
        // paragraph continuation - live markdown, and it keeps an open
        // definition open; a shallower line re-decides both states
        const thematicBreak =
            depth === 0 && /^ {0,3}([-*_])( *\1){2,} *$/.test(rest);
        if (!indented) {
            inIndentedCode = false;
            // lines indented ≥ 4 continue an open definition even inside a
            // list's live range; only a shallower line re-decides it
            if (indentWidth < 4) {
                inDefinition = DefinitionStart.test(src[i]);
            }
            // a list-item marker OPENS a container: its content indent is
            // the marker column + marker width + the following gap (a gap
            // of 5+, or none, counts as 1 per CommonMark). A thematic
            // break ("- - -") is not a list item.
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
        // lazy continuation is paragraph-only: an ATX heading or thematic
        // break ends its block outright, so an indented chunk may open on
        // the very next line (Sol bug #5)
        blockBoundary =
            thematicBreak ||
            (depth === 0 && /^ {0,3}#{1,6}(?: |$)/.test(rest));

        // a fence can also open on a LIST ITEM line ("- ```", "1. ~~~") -
        // the list marker is a container prefix like the blockquote one;
        // its closer arrives indented into the item, which the {0,3}
        // closer pattern already accepts (bug-list-item-fence)
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
        // inside a list item, fence indent measures from the ITEM's content
        // column, not the document margin (2026-08-11 review bug #3,
        // ground-truthed in the live reading view): "    ```" under "- a"
        // sits at relative indent 2 - a real fence, whose closer aligns to
        // the item's content column
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
        // ...and inside an open DEFINITION, whose continuations sit at
        // content column 4 - a "    ```" there is a real fence, exactly
        // like the list case above (GFM gives footnote definitions the
        // same container treatment; the comment/math openers were already
        // indentation-insensitive here while fences were not, and the
        // delete-orphaned-references rule ATE code text out of the
        // unprotected interior - hunt 2026-08-25,
        // bug-definition-continuation-fence-unprotected)
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
                // the stripped list marker plus the opener's own indent IS
                // the container content column the closer aligns to
                contentIndent:
                    listFenceContentIndent ??
                    rest.length - fenceLine.length + open[1].length,
            };
            isProtected[i] = true;
            continue;
        }
        // a multi-line HTML comment (an unescaped opener outside code with
        // no closer) hides everything through its closing line - a "[^x]:"
        // inside it is commented-out text, not a live definition. Same for
        // an unclosed "$$" opening a display-math block. The opener line
        // itself stays live before the opener.
        if (src[i].includes("<!--") || src[i].includes("$$")) {
            const opened = maskLineRegions(src[i]);
            inComment = opened.endsInComment;
            inMath = opened.endsInMath;
            if (inComment || inMath) regionDepth = depth;
        }
    }
    return {
        isProtected,
        startsInComment,
        startsInMath,
        startsInFence,
        // a quoted unclosed region can't reach an EOF append - the
        // appended line ends its quote, same as a blockquoted fence
        endsProtected:
            ((inComment || inMath) && regionDepth === 0) ||
            (fence !== null && fence.depth === 0),
    };
}

/**
 * Lines the transforms must not read or touch AT ALL - see DocumentScan.
 * Callers that also scan line content should use maskProtectedLines, which
 * additionally masks the comment portions of boundary lines.
 */
export function protectedLines(lines: string[]): boolean[] {
    return scanDocument(lines).isProtected;
}

/** Inline code spans and complete HTML comments blotted out, indices preserved. Single-line contexts only (table cell text) - document lines need maskProtectedLines, which knows about multi-line comment state. */
export function maskInlineRegions(line: string): string {
    return maskLineRegions(line).masked;
}

/**
 * Every line with code, comments, and frontmatter blotted out: protected
 * lines become all-NUL strings; in the rest, inline code spans, complete
 * comments, and the comment PORTIONS of multi-line boundary lines are
 * masked. Lengths and indices line up with the originals, so scans over
 * these see no code while every match position stays valid in the real
 * line. Pass a precomputed `scan` to avoid re-walking the document when
 * the caller already ran scanDocument.
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
 * Line `i` of the document's masked twin, without masking the other lines.
 * The per-keypress paths need exactly the caret's line: protection state
 * still requires the whole-document walk (cheap line-prefix checks), but
 * the expensive inline-region masking runs on one line instead of all of
 * them (perf, 2026-08-07). Out-of-range `i` returns "".
 */
export function maskedLineAt(lines: string[], i: number): string {
    if (i < 0 || i >= lines.length) return "";
    const line = lines[i];
    const scan = scanDocument(lines);
    return scan.isProtected[i]
        ? "\0".repeat(line.length)
        : maskLineRegions(line, {
              comment: scan.startsInComment[i],
              math: scan.startsInMath[i],
          }).masked;
}

/**
 * The lines with the given inclusive ranges cut out. Where a cut makes two
 * blank lines meet, they collapse into one, so removing a block never
 * leaves a double gap behind.
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
            continue; // still merging until a non-blank line arrives
        }
        // a cut must not drop a paragraph directly onto a "---"/"===" line
        // (blockquoted "> ---" included - bug-blockquote-setext-residue):
        // that would turn the stranded text into a setext heading. Only when
        // the adjacency is new (mergeBlanks - no blank line survived the cut
        // between them) do we reinstate a blank separator.
        if (
            mergeBlanks &&
            out.length > 0 &&
            out[out.length - 1] !== "" &&
            /^\s{0,3}(-+|=+)\s*$/.test(lines[i].replace(BlockquotePrefix, ""))
        ) {
            out.push("");
        }
        // nor may a cut promote a "---" to DOCUMENT START: there it parses
        // as a frontmatter opener and swallows live prose up to the next
        // divider - and drop-orphans reindex then deletes the definitions
        // whose references it hid (bug-stranded-frontmatter). A leading
        // blank line keeps it an ordinary divider.
        if (mergeBlanks && out.length === 0 && lines[i] === "---") {
            out.push("");
        }
        mergeBlanks = false;
        out.push(lines[i]);
    }
    return out;
}

/** Every definition with its continuation lines (indented lines, plus blank runs that lead to more indented lines). Pass the full `scan` when available: a continuation can OPEN a multi-line comment/math region ("    $$") or a definition-content fence ("    ```", 2026-08-25), and only the scan's startsIn* facts let the walk absorb that construct's protected interior instead of splitting the block in half (Sol bug #3, 2026-08-10). Labels are read through the MASKED twin, like every other definition reader: a comment CLOSER line ("[^2]: two -->") is unprotected for the sake of its live suffix, but the label inside the comment is not a definition (review A1, 2026-09-08 - move-to-bottom used to drag the "-->" away and unclose the comment). Pass `maskedLines` when the twin is already at hand; otherwise only the label-shaped lines are masked, one at a time. */
export function findDefinitionBlocks(
    lines: string[],
    isProtected: boolean[],
    scan?: Pick<
        DocumentScan,
        "startsInComment" | "startsInMath" | "startsInFence"
    >,
    maskedLines?: string[],
): DefinitionBlock[] {
    const maskedAt = (j: number): string => {
        if (maskedLines) return maskedLines[j];
        return maskLineRegions(lines[j], {
            comment: scan?.startsInComment[j] ?? false,
            math: scan?.startsInMath[j] ?? false,
        }).masked;
    };
    // a protected line the walk may absorb into an open block: the
    // interior/closer of a comment, math, or fence region whose opener
    // was a continuation already absorbed into this block (a region open
    // BEFORE the definition would have protected the label line itself),
    // or a protected line AT THE CONTINUATION INDENT (four-plus spaces) -
    // a definition-content construct's own opener, like the "    ```"
    // fence riding the continuation indent (hunt 2026-08-25). The indent
    // floor matters: a DOC-level fence opener with incidental leading
    // spaces (" ```") is protected and indented too, but it ends the
    // block - only the {0,3}-cap-defying four-space column marks a
    // construct the definition owns.
    const absorbable = (j: number) =>
        isProtected[j] &&
        (!!scan?.startsInComment[j] ||
            !!scan?.startsInMath[j] ||
            !!scan?.startsInFence[j] ||
            /^ {4}/.test(lines[j]));
    const blocks: DefinitionBlock[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (isProtected[i]) continue;
        // raw gate first (most lines are prose), then the masked read
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
            // a blank run continues the block only when indented content
            // (unprotected, or an absorbable construct) follows it
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
