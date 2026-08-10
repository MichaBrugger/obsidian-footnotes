// Pure scanning primitives shared by the whole-document footnote
// transforms (reindex, move-to-bottom, after-punctuation). Nothing here
// touches an Editor — everything is lines in, facts out.

/** A footnote definition at the start of a line ("[^x]: …"). */
export const DefinitionStart = /^\[\^([^[\]]+)\]:/;
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
 * One left-to-right scan of a line for inline code spans and HTML comments,
 * NULing both, CommonMark-style: whichever construct opens first claims its
 * content — backticks inside a comment are literal, "<!--" inside a code
 * span is code (bug-comment-mask-order / bug-backticked-comment-opener).
 * Backslash-escaped openers of either kind are literal text
 * (bug-escaped-comment-opener), and the abbreviated comments "<!-->" and
 * "<!--->" are complete per CommonMark §6.6 (bug-short-form-comment).
 * `startInComment` continues a multi-line comment from the previous line;
 * `endsInComment` reports one left open at the end of this one (its opener
 * masked through EOL).
 */
export function maskLineRegions(
    line: string,
    startInComment = false,
): { masked: string; endsInComment: boolean } {
    // fast path: nothing on the line can open or close either construct
    if (
        !startInComment &&
        !line.includes("`") &&
        !line.includes("<!--")
    ) {
        return { masked: line, endsInComment: false };
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
            return { masked: "\0".repeat(line.length), endsInComment: true };
        }
        blot(0, close + 3);
        i = close + 3;
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
                return { masked: chars.join(""), endsInComment: true };
            }
            blot(i, close + 3);
            i = close + 3;
            continue;
        }
        i++;
    }
    return { masked: chars.join(""), endsInComment: false };
}

/** The two per-line facts the whole-document walk produces. */
export interface DocumentScan {
    /** Whole-line protected: YAML frontmatter, fenced code (delimiters included), and multi-line comment INTERIOR lines. Comment boundary lines are NOT here — their live portions stay scannable, with the comment part masked (bug-comment-boundary-lines). */
    isProtected: boolean[];
    /** Line `i` begins inside a multi-line HTML comment (it is a closer or interior line). */
    startsInComment: boolean[];
}

/**
 * The whole-document protection walk: YAML frontmatter, fenced code blocks
 * (both delimiter lines included, including fences nested in
 * blockquotes/callouts), and multi-line HTML comments — whose state is
 * tracked by the same escape- and code-span-aware scanner that does the
 * masking, so the two can't disagree. Indented code blocks are NOT
 * detected — indentation is how definition continuations work.
 */
export function scanDocument(lines: string[]): DocumentScan {
    const src = stripCr(lines);
    const isProtected = new Array<boolean>(lines.length).fill(false);
    const startsInComment = new Array<boolean>(lines.length).fill(false);
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

    let fence: { char: string; length: number } | null = null;
    let inComment = false;
    for (; i < src.length; i++) {
        if (inComment) {
            startsInComment[i] = true;
            if (!src[i].includes("-->")) {
                isProtected[i] = true; // interior: nothing live on it
                continue;
            }
            // the closer line keeps its live suffix — and that suffix can
            // itself open code, another comment, even a NEW multi-line one
            inComment = maskLineRegions(src[i], true).endsInComment;
            continue;
        }
        // blockquote/callout markers don't change the fence delimiters
        const bareLine = src[i].replace(BlockquotePrefix, "");
        if (fence) {
            isProtected[i] = true;
            const close = bareLine.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
            if (
                close &&
                close[1][0] === fence.char &&
                close[1].length >= fence.length
            ) {
                fence = null;
            }
            continue;
        }
        const open = bareLine.match(/^ {0,3}(`{3,}|~{3,})/);
        if (open && isFenceOpener(bareLine, open[1])) {
            fence = { char: open[1][0], length: open[1].length };
            isProtected[i] = true;
            continue;
        }
        // a multi-line HTML comment (an unescaped opener outside code with
        // no closer) hides everything through its closing line — a "[^x]:"
        // inside it is commented-out text, not a live definition. The
        // opener line itself stays live before the opener.
        if (src[i].includes("<!--")) {
            inComment = maskLineRegions(src[i], false).endsInComment;
        }
    }
    return { isProtected, startsInComment };
}

/**
 * Lines the transforms must not read or touch AT ALL — see DocumentScan.
 * Callers that also scan line content should use maskProtectedLines, which
 * additionally masks the comment portions of boundary lines.
 */
export function protectedLines(lines: string[]): boolean[] {
    return scanDocument(lines).isProtected;
}

/**
 * The line with every inline code span (backtick run + content + matching
 * closing run, CommonMark equal-length rule) overwritten by NULs, so reference
 * scans skip code while every index still lines up with the original.
 */
export function maskInlineCode(line: string): string {
    const chars = line.split("");
    let i = 0;
    while (i < line.length) {
        if (line[i] === "\\") {
            i += 2; // a backslash escape can't open a code span (\` is literal)
            continue;
        }
        if (line[i] !== "`") {
            i++;
            continue;
        }
        const runStart = i;
        while (line[i] === "`") i++;
        const runLength = i - runStart;

        // find the next backtick run of exactly the same length. Backslashes
        // are literal inside a code span, so the closing search does NOT skip
        // escapes — only the opening run must be unescaped.
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

        for (let k = runStart; k < close + runLength; k++) chars[k] = "\0";
        i = close + runLength;
    }
    return chars.join("");
}

/**
 * Every single-line HTML comment span ("<!-- … -->") in the line blotted to
 * NULs, same length. protectedLines only guards MULTI-line comments (an
 * opener with no closer on its line); the one-line form was invisible to it
 * — found live 2026-07-17 when a commented-out "[^66]: …" had its colon
 * swapped and its number reindexed. Pass the code-masked line: delimiters
 * inside a code span are already NULs, so they can't open a comment here.
 */
export function maskCommentSpans(line: string): string {
    const chars = line.split("");
    let i = 0;
    while (i < line.length) {
        const open = line.indexOf("<!--", i);
        if (open === -1) break;
        const close = line.indexOf("-->", open + 4);
        // opener without a closer on the line belongs to protectedLines'
        // multi-line handling
        if (close === -1) break;
        for (let k = open; k < close + 3; k++) chars[k] = "\0";
        i = close + 3;
    }
    return chars.join("");
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
            : maskLineRegions(line, scan.startsInComment[i]).masked,
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
    const line = lines[i];
    if (line === undefined) return "";
    const scan = scanDocument(lines);
    return scan.isProtected[i]
        ? "\0".repeat(line.length)
        : maskLineRegions(line, scan.startsInComment[i]).masked;
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
