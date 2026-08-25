import { Editor, EditorPosition } from "obsidian";

import {
    DocumentScan,
    maskLineRegions,
    maskProtectedLines,
    scanDocument,
} from "../parsing/markdown-scan";
import {
    definitionLabelWithName,
    footnoteReferenceMatches,
    occurrenceAtCursor,
    referenceAtCursor,
    ReferenceOccurrence,
    referenceOccurrences,
} from "../parsing/footnote-grammar";

// One press's shared read-only view of the document. Depends only on
// markdown-scan + Obsidian types — split out of the all-in-one commands
// file 2026-08-11.

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

/** Names of all footnote definitions ("[^x]: …" lines) in document order, one per line at most. Code blocks don't count. */
export function listExistingFootnoteDefinitions(
    doc: Editor,
    ctx: DocContext = docContext(doc),
) {
    const definitionNames: string[] = [];

    //search each line for footnote definitions — column-0 labels and
    //blockquote/callout ones ("> [^x]: …", C22) — and list their names
    const lines = ctx.lines;
    const masked = ctx.maskedLines();
    for (let i = 0; i < lines.length; i++) {
        // definitionLabelWithName owns the masked-match/raw-re-slice
        // invariant (a code span inside the name masks to NULs)
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (hit) definitionNames.push(hit.name);
    }
    return definitionNames;
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

/**
 * The shared "is the caret on a LIVE reference?" lookup — cascade steps
 * 2–3 and the inline commands all start with it (three byte-identical
 * copies before 2026-08-25). The RAW line gates first: this runs on
 * every press, masking needs the whole document, and most presses sit
 * on plain text (perf F1). Only past that gate is the DocContext built
 * and the masked twin consulted — a "[^x]" inside a fence or inline
 * code is plain text, so the press falls through to insertion (#41).
 * referenceOccurrences re-slices each name from the raw line, so a code
 * span inside the name can't leak NULs (bug-masked-name-identity).
 * Returns the occurrence together with the context that judged it —
 * pass that ctx onward so the press keeps its one-scan budget.
 */
export function referenceOccurrenceAtCursor(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    ctx?: DocContext,
): { target: ReferenceOccurrence; ctx: DocContext } | null {
    const rawReferences = footnoteReferenceMatches(lineText).map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (referenceAtCursor(rawReferences, cursorPosition.ch) === null) {
        return null;
    }
    ctx ??= docContext(doc);
    const target = occurrenceAtCursor(
        referenceOccurrences(lineText, ctx.maskedLine(cursorPosition.line)),
        cursorPosition.ch,
    );
    return target === null ? null : { target, ctx };
}
