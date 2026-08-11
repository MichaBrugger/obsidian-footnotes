import { Editor, MarkdownView } from "obsidian";

import {
    DocumentScan,
    maskLineRegions,
    maskProtectedLines,
    scanDocument,
} from "./markdown-scan";

// One press's shared read-only view of the document, plus the editor-mode
// guard every command runs. Depends only on markdown-scan + Obsidian types
// — split out of the all-in-one commands file 2026-08-11.

/** Whether `mdView` is in Reading view — where every text-editing command must be inert. The structural parameter type keeps getMode honestly optional: bare test fakes without it count as editable. */
export function readingViewActive(mdView: {
    getMode?: MarkdownView["getMode"];
}): boolean {
    return mdView.getMode?.() === "preview";
}

// Scans run against the document's masked twin (code and frontmatter
// blotted out, indices preserved): a "[^x]" inside a code sample is plain
// text, not a footnote (issue #41).
export function docLines(doc: Editor): string[] {
    const lines: string[] = [];
    for (let i = 0; i < doc.lineCount(); i++) {
        lines.push(doc.getLine(i));
    }
    return lines;
}

/**
 * One press's shared read-only view of the document (perf F1): the cascade
 * steps used to each re-materialize the lines and re-walk the protection
 * scan — 3–5 full-document passes per press. Every step takes an optional
 * DocContext (defaulting to a fresh one, so direct/unit callers are
 * unchanged) and the command entry points build ONE per press. Masking is
 * lazy: per line on demand, whole-twin memoized on first full need. Built
 * strictly BEFORE any edit of the press — creation steps edit last, so the
 * context never goes stale within a press.
 */
export interface DocContext {
    lines: string[];
    scan: DocumentScan;
    /** Line `i` of the masked twin ("" when out of range), cached per line. */
    maskedLine(i: number): string;
    /** The whole masked twin, memoized. */
    maskedLines(): string[];
}

export function docContext(doc: Editor): DocContext {
    const lines = docLines(doc);
    const scan = scanDocument(lines);
    const perLine: (string | undefined)[] = new Array<string | undefined>(
        lines.length,
    );
    let full: string[] | null = null;
    const maskedLine = (i: number): string => {
        if (i < 0 || i >= lines.length) return "";
        const line = lines[i];
        if (full) return full[i];
        let masked = perLine[i];
        if (masked === undefined) {
            masked = scan.isProtected[i]
                ? "\0".repeat(line.length)
                : maskLineRegions(line, {
                      comment: scan.startsInComment[i],
                      math: scan.startsInMath[i],
                  }).masked;
            perLine[i] = masked;
        }
        return masked;
    };
    const maskedLines = (): string[] =>
        full ?? (full = maskProtectedLines(lines, scan));
    return { lines, scan, maskedLine, maskedLines };
}
