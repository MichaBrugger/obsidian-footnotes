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
 * Lines the transforms must not read or touch: YAML frontmatter, fenced
 * code blocks (both fence delimiter lines included, including fences nested
 * in blockquotes/callouts), and multi-line HTML comments. Indented code
 * blocks are NOT detected — indentation is how definition continuations work.
 */
export function protectedLines(lines: string[]): boolean[] {
    const src = stripCr(lines);
    const isProtected = new Array<boolean>(lines.length).fill(false);
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
            isProtected[i] = true;
            if (src[i].includes("-->")) inComment = false;
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
        // a multi-line HTML comment (an opener with no closer on its own
        // line) hides everything through its closing line — a "[^x]:" inside
        // it is commented-out text, not a live definition
        const commentOpen = src[i].indexOf("<!--");
        if (
            commentOpen !== -1 &&
            src[i].indexOf("-->", commentOpen + 4) === -1
        ) {
            inComment = true;
            isProtected[i] = true;
        }
    }
    return isProtected;
}

/**
 * The line with every inline code span (backtick run + content + matching
 * closing run, CommonMark equal-length rule) overwritten by NULs, so marker
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
 * Every line with code and frontmatter blotted out: protected lines become
 * all-NUL strings, inline code spans are masked in the rest. Lengths and
 * indices line up with the originals, so scans over these see no code
 * while every match position stays valid in the real line.
 */
export function maskProtectedLines(lines: string[]): string[] {
    const isProtected = protectedLines(lines);
    return lines.map((line, i) =>
        isProtected[i] ? "\0".repeat(line.length) : maskInlineCode(line),
    );
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
        // a cut must not drop a paragraph directly onto a "---"/"===" line:
        // that would turn the stranded text into a setext heading. Only when
        // the adjacency is new (mergeBlanks — no blank line survived the cut
        // between them) do we reinstate a blank separator.
        if (
            mergeBlanks &&
            out.length > 0 &&
            out[out.length - 1] !== "" &&
            /^\s{0,3}(-+|=+)\s*$/.test(lines[i])
        ) {
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
