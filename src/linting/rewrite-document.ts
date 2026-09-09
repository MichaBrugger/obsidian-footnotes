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

// The bookends every rewriting rule used to carry on its own (duplicated-
// logic audit, 2026-09-05): LF-normalize the note, split it, scan it, run
// the rule, and hand back the ORIGINAL bytes when nothing changed -
// restoring the EOL onto an unchanged result would normalize a mixed-EOL
// note and report a phantom lint (decided 2026-08-10,
// spec-mixed-eol-noop-rewrite) - else the original endings restored.

/**
 * What a rewriting rule sees. The scan, the masked twin, and the
 * definition blocks are computed on first use and then cached: not every
 * rule needs all three, and one rule (move-to-bottom) trims `lines`
 * before anything is scanned.
 */
export interface DocumentView {
    readonly lines: string[];
    readonly scan: DocumentScan;
    readonly maskedLines: string[];
    /** Which lines start a live definition (definitionStartLines). */
    readonly definitionStarts: boolean[];
    readonly blocks: DefinitionBlock[];
    /**
     * Drop the note's trailing blank lines and return how many there were.
     * The ONE sanctioned mutation of `lines`, and only before anything
     * derived from them exists: move-to-bottom used to pop the array
     * directly, which worked purely because the scan is lazy and the pops
     * came first - a later read of `scan` above the trim would have
     * described the untrimmed note (review C7, 2026-09-09). Throws if the
     * scan, the masked twin, the starts, or the blocks were already taken.
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
 * Run `rewrite` over the LF-normalized `text` of `markdown` (with its
 * view) and return the rewritten note in the note's own line endings -
 * or `markdown` itself, byte for byte, when the rule returned `text`
 * unchanged.
 */
export function rewriteDocument(
    markdown: string,
    rewrite: (text: string, view: DocumentView) => string,
): string {
    const { text, eol } = normalizeEol(markdown);
    const result = rewrite(text, documentView(text.split("\n")));
    return result === text ? markdown : restoreEol(result, eol);
}
