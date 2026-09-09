import {
    DefinitionBlock,
    definitionStartLines,
    DocumentScan,
    findDefinitionBlocks,
    maskProtectedLines,
    normalizeEol,
    restoreEol,
    scanDocument,
} from "../parsing/markdown-scan";

// The setup and teardown every rewriting rule used to repeat for itself,
// gathered here (duplicated-logic audit, 2026-09-05). The steps: convert the
// note's line endings to plain LF, split it into lines, scan it, run the
// rule, then put the note's own line endings back.
//
// The one subtlety is what happens when the rule changed nothing. Then the
// ORIGINAL text is handed back byte for byte, without the ending-restoring
// step. A note with mixed line endings would otherwise come out with them
// all made the same, and the lint would report a change the user never
// asked for. (Decided 2026-08-10; pinned by spec-mixed-eol-noop-rewrite.)

/**
 * The view of the note a rewriting rule works from.
 *
 * The scan, the masked twin (the copy with protected text blanked out) and
 * the definition blocks are each worked out the first time they are asked
 * for, then kept. Two reasons: no rule needs all three, and one rule,
 * move-to-bottom, trims `lines` before anything has been scanned.
 */
export interface DocumentView {
    readonly lines: string[];
    readonly scan: DocumentScan;
    readonly maskedLines: string[];
    /**
     * One entry per line: true where a real definition starts there. Worked
     * out by definitionStartLines.
     */
    readonly definitionStarts: boolean[];
    readonly blocks: DefinitionBlock[];
    /**
     * Drop the blank lines at the end of the note, and say how many there
     * were.
     *
     * This is the ONE change to `lines` that is allowed, and only before
     * anything has been worked out from them. move-to-bottom used to
     * shorten the array itself. That happened to work, but only because
     * the scan is done lazily and the shortening came first: read `scan`
     * anywhere above the trim and it would describe the untrimmed note
     * (review C7, 2026-09-09).
     *
     * So this throws if the scan, the masked twin, the definition starts or
     * the blocks have already been asked for.
     */
    trimTrailingBlankLines(): number;
}

function documentView(lines: string[]): DocumentView {
    let scan: DocumentScan | null = null;
    let masked: string[] | null = null;
    let blocks: DefinitionBlock[] | null = null;
    let starts: boolean[] | null = null;
    return {
        lines,
        trimTrailingBlankLines() {
            if (scan !== null || masked !== null || starts !== null || blocks !== null) {
                throw new Error("trimTrailingBlankLines must run before the view is scanned");
            }
            let trimmed = 0;
            while (lines.length > 1 && lines[lines.length - 1] === "") {
                lines.pop();
                trimmed++;
            }
            return trimmed;
        },
        get scan() {
            if (scan === null) scan = scanDocument(lines);
            return scan;
        },
        get maskedLines() {
            if (masked === null) masked = maskProtectedLines(lines, this.scan);
            return masked;
        },
        get definitionStarts() {
            if (starts === null) {
                const masked = this.maskedLines;
                starts = definitionStartLines(lines, this.scan, (i) => masked[i]);
            }
            return starts;
        },
        get blocks() {
            if (blocks === null) {
                blocks = findDefinitionBlocks(lines, this.scan, this.maskedLines, this.definitionStarts);
            }
            return blocks;
        },
    };
}

/**
 * Run `rewrite` over `markdown` with its line endings converted to plain LF,
 * handing it that text and a view of it.
 *
 * Returns the rewritten note with the note's own line endings put back, or,
 * when the rule handed `text` back unchanged, `markdown` itself, byte for
 * byte.
 */
export function rewriteDocument(
    markdown: string,
    rewrite: (text: string, view: DocumentView) => string,
): string {
    const { text, eol } = normalizeEol(markdown);
    const result = rewrite(text, documentView(text.split("\n")));
    return result === text ? markdown : restoreEol(result, eol);
}
