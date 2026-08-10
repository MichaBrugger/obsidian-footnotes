// Pure scanning primitives shared by the whole-document footnote
// transforms (reindex, move-to-bottom, after-punctuation). Nothing here
// touches an Editor — everything is lines in, facts out.

/** A footnote definition at the start of a line ("[^x]: …"). */
export const DefinitionStart = /^\[\^([^[\]]+)\]:/;

/**
 * The trailing punctuation the insert commands hop over — the same class
 * the footnote-after-punctuation lint reorders, so the two features can't
 * disagree about where a reference belongs. ASCII plus the CJK fullwidth
 * forms 。，、；：！？ (Jason, 2026-08-10). Lives here, in the dependency
 * root, because both consumers read it at MODULE scope — anywhere else it
 * rides an import cycle and evaluates as undefined.
 */
export const TrailingPunctuationChars = ".,;:!?。，、；：！？";
// a continuation line belongs to the definition above it
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
 * LF one — the array's length and indices are unchanged. Windows/synced notes
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
 * back on the way out — Obsidian edits notes in place, so we must not
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
const BlockquotePrefix = /^(?: {0,3}>)+ ?/;

/**
 * The line's blockquote nesting depth (number of leading ">" markers, each
 * allowed 0–3 spaces before it and one space after, per CommonMark) and the
 * text after the markers. A fence lives in the container that opened it —
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
 * The footnote definition label on `line` — at column 0, or behind a
 * blockquote/callout prefix ("> [^x]: …" — Jason's ruling 2026-08-10:
 * footnote creation, navigation, and linting work inside
 * blockquotes/callouts). Positions index into the SAME line passed in, so
 * callers can re-slice the raw line when they matched the masked twin (a
 * code span inside the name masks to NULs). Null when the line carries no
 * label.
 */
export function definitionLabelIn(
    line: string,
): { nameStart: number; nameEnd: number; labelEnd: number } | null {
    const prefix = line.match(BlockquotePrefix)?.[0].length ?? 0;
    const match = line.slice(prefix).match(DefinitionStart);
    if (!match) return null;
    return {
        nameStart: prefix + 2,
        nameEnd: prefix + 2 + match[1].length,
        labelEnd: prefix + match[0].length,
    };
}

/**
 * Whether a line already known to start with a fence delimiter actually opens
 * a fence. Per CommonMark a backtick fence's info string may not contain a
 * backtick — "```[^1]``` x" is an inline code span in a paragraph, not a
 * fence — so opening one there would run unclosed to EOF. Tilde fences have
 * no such rule.
 */
function isFenceOpener(bareLine: string, delim: string): boolean {
    if (delim[0] !== "`") return true;
    const rest = bareLine.slice(bareLine.indexOf(delim) + delim.length);
    return !rest.includes("`");
}

/**
 * One left-to-right scan of a line for inline code spans, HTML comments,
 * and math ($…$ / $$…$$), NULing all three, CommonMark-style: whichever
 * construct opens first claims its content — backticks inside a comment
 * are literal, "<!--" inside a code span is code (bug-comment-mask-order /
 * bug-backticked-comment-opener), "$" inside either is just a dollar.
 * Backslash-escaped openers of every kind are literal text
 * (bug-escaped-comment-opener), and the abbreviated comments "<!-->" and
 * "<!--->" are complete per CommonMark §6.6 (bug-short-form-comment).
 * Inline math needs a non-empty content that neither starts nor ends with
 * a space (Obsidian's rule — "$5 and $10" stays prose). `startInComment` /
 * `startInMath` continue a multi-line region from the previous line;
 * `endsInComment` / `endsInMath` report one left open at EOL (its opener
 * masked through the end of the line). Math protection is Jason's 2026-08-10
 * ruling: linting never touches math.
 */
/**
 * Whether the "$" at `i` sits inside a footnote-reference shape ("[^…]").
 * Jason verified live (2026-08-10): Obsidian tokenizes the bracket construct
 * first, so a dollar inside a reference renders as part of the footnote id —
 * it never opens or closes a math span. Nearest bracket wins: a "[" with a
 * "^" behind it and no "]" in between means we're inside a reference.
 */
function dollarInsideReference(line: string, i: number): boolean {
    for (let j = i - 1; j >= 0; j--) {
        const c = line[j];
        if (c === "]") return false;
        if (c === "[") return line[j + 1] === "^";
    }
    return false;
}

export function maskLineRegions(
    line: string,
    startInComment = false,
    startInMath = false,
): { masked: string; endsInComment: boolean; endsInMath: boolean } {
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
    const blot = (from: number, to: number) => {
        for (let k = from; k < to; k++) chars[k] = "\0";
    };
    let i = 0;

    if (startInComment) {
        // comment content is literal — the first "-->" closes, full stop
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
        // display-math content is literal — the first "$$" closes it
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
            const runStart = i;
            while (line[i] === "`") i++;
            const runLength = i - runStart;
            // find the next backtick run of exactly the same length.
            // Backslashes are literal inside a code span, so the closing
            // search does NOT skip escapes — only the opener is unescaped.
            let close = -1;
            for (let j = i; j < line.length; ) {
                if (line[j] !== "`") {
                    j++;
                    continue;
                }
                const candidate = j;
                while (line[j] === "`") j++;
                if (j - candidate === runLength) {
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
            if (dollarInsideReference(line, i)) {
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
            // starts nor ends with a space — otherwise the dollar is prose.
            // Dollars inside "[^…]" can't close either (see the opener guard)
            let close = -1;
            for (let j = i + 1; j < line.length; j++) {
                if (line[j] === "\\") {
                    j++;
                    continue;
                }
                if (line[j] === "$" && !dollarInsideReference(line, j)) {
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
                i++; // not math — the closing candidate may open its own
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
    /** Whole-line protected: YAML frontmatter, fenced code (delimiters included), standalone indented code, and multi-line comment/math INTERIOR lines. Boundary lines are NOT here — their live portions stay scannable, with the comment/math part masked (bug-comment-boundary-lines). */
    isProtected: boolean[];
    /** Line `i` begins inside a multi-line HTML comment (it is a closer or interior line). */
    startsInComment: boolean[];
    /** Line `i` begins inside a multi-line $$ math block (closer or interior line). */
    startsInMath: boolean[];
    /** A line appended at EOF would itself be protected: an unclosed comment, math block, or DOCUMENT-LEVEL fence runs to EOF (a blockquoted fence dies at the append point — the appended line ends its quote). Replaces move-to-bottom's probe re-scan (perf F6). */
    endsProtected: boolean;
}

/**
 * The whole-document protection walk: YAML frontmatter, fenced code blocks
 * (both delimiter lines included, including fences nested in
 * blockquotes/callouts), multi-line HTML comments — whose state is tracked
 * by the same escape- and code-span-aware scanner that does the masking, so
 * the two can't disagree — and STANDALONE indented code blocks (Jason's
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

    let fence: { char: string; length: number; depth: number } | null = null;
    let inComment = false;
    let inMath = false;
    // indented-code state (C21): `prevBlank` marks a block boundary (doc
    // start included), `inDefinition` mirrors findDefinitionBlocks' reach —
    // a "[^x]:" line plus its indented continuations and the blank runs
    // between them — and `inIndentedCode` is an open indented chunk.
    let inIndentedCode = false;
    let inDefinition = false;
    let prevBlank = true;
    for (; i < src.length; i++) {
        if (inComment) {
            startsInComment[i] = true;
            inIndentedCode = false;
            inDefinition = false;
            prevBlank = false;
            if (!src[i].includes("-->")) {
                isProtected[i] = true; // interior: nothing live on it
                continue;
            }
            // the closer line keeps its live suffix — and that suffix can
            // itself open code, another comment, math, even a NEW
            // multi-line region of either kind
            const closed = maskLineRegions(src[i], true);
            inComment = closed.endsInComment;
            inMath = closed.endsInMath;
            continue;
        }
        if (inMath) {
            startsInMath[i] = true;
            inIndentedCode = false;
            inDefinition = false;
            prevBlank = false;
            if (!src[i].includes("$$")) {
                isProtected[i] = true; // interior: nothing live on it
                continue;
            }
            const closed = maskLineRegions(src[i], false, true);
            inMath = closed.endsInMath;
            inComment = closed.endsInComment;
            continue;
        }
        // a fence lives in the CONTAINER that opened it (CommonMark):
        // depth is the blockquote nesting where the delimiters count
        const { depth, rest } = blockquoteDepth(src[i]);
        if (fence && depth < fence.depth) {
            // the fence's blockquote ended, taking the fence with it
            // (bug-blockquote-fence-outlives-quote) — this line is normal
            // text and gets the full treatment below, so a bare "```" here
            // OPENS a new fence (bug-bare-fence-after-blockquote-fence)
            fence = null;
        }
        if (fence) {
            inIndentedCode = false;
            inDefinition = false;
            prevBlank = false;
            isProtected[i] = true;
            // a closer counts only at the fence's own depth: "> ```" can't
            // close a document-level fence (it is code content there —
            // bug-blockquote-closes-bare-fence), and a doc-level "```"
            // can't close a blockquoted one (handled above by ending it)
            if (depth === fence.depth) {
                const close = rest.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
                if (
                    close &&
                    close[1][0] === fence.char &&
                    close[1].length >= fence.length
                ) {
                    fence = null;
                }
            }
            continue;
        }
        // ---- indented code (C21), definition-aware ----
        if (src[i].trim() === "") {
            // a blank is a block boundary, but it ENDS neither an open
            // definition (blank runs can lead to more continuation —
            // findDefinitionBlocks) nor an indented chunk (code blocks
            // continue across blanks when more indented lines follow)
            prevBlank = true;
            continue; // nothing on a blank line can open a fence or comment
        }
        const indented = /^(?: {4}|\t)/.test(src[i]);
        if (indented && inIndentedCode) {
            isProtected[i] = true;
            prevBlank = false;
            continue;
        }
        if (indented && !inDefinition && prevBlank) {
            // a 4-space/tab chunk opening at a block boundary outside any
            // definition is CommonMark indented code — inert to Obsidian,
            // so the transforms must not count or rewrite it
            inIndentedCode = true;
            isProtected[i] = true;
            prevBlank = false;
            continue;
        }
        // an indented line here is a definition continuation or a lazy
        // paragraph continuation — live markdown, and it keeps an open
        // definition open; a non-indented line re-decides the definition
        if (!indented) {
            inIndentedCode = false;
            inDefinition = DefinitionStart.test(src[i]);
        }
        prevBlank = false;

        // a fence can also open on a LIST ITEM line ("- ```", "1. ~~~") —
        // the list marker is a container prefix like the blockquote one;
        // its closer arrives indented into the item, which the {0,3}
        // closer pattern already accepts (bug-list-item-fence)
        let fenceLine = rest;
        let open = fenceLine.match(/^ {0,3}(`{3,}|~{3,})/);
        if (!open) {
            const afterListMarker = rest.replace(
                /^ {0,3}(?:[-+*]|\d{1,9}[.)]) +/,
                "",
            );
            if (afterListMarker !== rest) {
                fenceLine = afterListMarker;
                open = fenceLine.match(/^ {0,3}(`{3,}|~{3,})/);
            }
        }
        if (open && isFenceOpener(fenceLine, open[1])) {
            fence = { char: open[1][0], length: open[1].length, depth };
            isProtected[i] = true;
            continue;
        }
        // a multi-line HTML comment (an unescaped opener outside code with
        // no closer) hides everything through its closing line — a "[^x]:"
        // inside it is commented-out text, not a live definition. Same for
        // an unclosed "$$" opening a display-math block. The opener line
        // itself stays live before the opener.
        if (src[i].includes("<!--") || src[i].includes("$$")) {
            const opened = maskLineRegions(src[i], false, false);
            inComment = opened.endsInComment;
            inMath = opened.endsInMath;
        }
    }
    return {
        isProtected,
        startsInComment,
        startsInMath,
        endsProtected:
            inComment || inMath || (fence !== null && fence.depth === 0),
    };
}

/**
 * Lines the transforms must not read or touch AT ALL — see DocumentScan.
 * Callers that also scan line content should use maskProtectedLines, which
 * additionally masks the comment portions of boundary lines.
 */
export function protectedLines(lines: string[]): boolean[] {
    return scanDocument(lines).isProtected;
}

/** Inline code spans and complete HTML comments blotted out, indices preserved. Single-line contexts only (table cell text) — document lines need maskProtectedLines, which knows about multi-line comment state. */
export function maskInlineRegions(line: string): string {
    return maskLineRegions(line, false).masked;
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
            : maskLineRegions(line, scan.startsInComment[i], scan.startsInMath[i])
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
        : maskLineRegions(line, scan.startsInComment[i], scan.startsInMath[i])
              .masked;
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
        // (blockquoted "> ---" included — bug-blockquote-setext-residue):
        // that would turn the stranded text into a setext heading. Only when
        // the adjacency is new (mergeBlanks — no blank line survived the cut
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
        // divider — and drop-orphans reindex then deletes the definitions
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

/** Every definition with its continuation lines (indented lines, plus blank runs that lead to more indented lines). */
export function findDefinitionBlocks(
    lines: string[],
    isProtected: boolean[],
): DefinitionBlock[] {
    const blocks: DefinitionBlock[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (isProtected[i]) continue;
        const match = lines[i].match(DefinitionStart);
        if (!match) continue;

        let end = i;
        let j = i + 1;
        while (j < lines.length && !isProtected[j]) {
            if (IndentedContent.test(lines[j])) {
                end = j++;
                continue;
            }
            if (lines[j].trim() !== "") break;
            // a blank run continues the block only when indented content
            // (of an unprotected line) follows it
            let k = j;
            while (k < lines.length && lines[k].trim() === "") k++;
            if (
                k < lines.length &&
                !isProtected[k] &&
                IndentedContent.test(lines[k])
            ) {
                end = k;
                j = k + 1;
            } else {
                break;
            }
        }
        blocks.push({ name: match[1], start: i, end });
        i = end;
    }
    return blocks;
}
