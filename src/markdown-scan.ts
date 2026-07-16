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
 * Lines the transforms must not read or touch: YAML frontmatter and fenced
 * code blocks (both fence delimiter lines included). Indented code blocks
 * are NOT detected — indentation is how definition continuations work.
 */
export function protectedLines(lines: string[]): boolean[] {
    const isProtected = new Array<boolean>(lines.length).fill(false);
    let i = 0;

    if (lines[0] === "---") {
        for (let j = 1; j < lines.length; j++) {
            if (/^(---|\.\.\.)\s*$/.test(lines[j])) {
                for (let k = 0; k <= j; k++) isProtected[k] = true;
                i = j + 1;
                break;
            }
        }
    }

    let fence: { char: string; length: number } | null = null;
    for (; i < lines.length; i++) {
        if (fence) {
            isProtected[i] = true;
            const close = lines[i].match(/^ {0,3}(`{3,}|~{3,})\s*$/);
            if (
                close &&
                close[1][0] === fence.char &&
                close[1].length >= fence.length
            ) {
                fence = null;
            }
        } else {
            const open = lines[i].match(/^ {0,3}(`{3,}|~{3,})/);
            if (open) {
                fence = { char: open[1][0], length: open[1].length };
                isProtected[i] = true;
            }
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
        if (line[i] !== "`") {
            i++;
            continue;
        }
        const runStart = i;
        while (line[i] === "`") i++;
        const runLength = i - runStart;

        // find the next backtick run of exactly the same length
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
