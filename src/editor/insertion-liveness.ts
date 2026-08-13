import { Editor, EditorChange, EditorPosition } from "obsidian";

import { docLines } from "./doc-context";
import { escapedAt } from "../parsing/footnote-grammar";
import { maskedLineAt } from "../parsing/markdown-scan";

// The born-dead safety kit: will inserted text still MEAN what it says
// once it lands? An insertion can be swallowed by an escape or an
// inline-footnote opener directly before it, or RECLASSIFY the document
// around it (complete a "$…$" pair, demote a quote whose region then
// swallows the append) — every failure mode here was found by the
// command-press property suite (2026-08-12). Split out of the all-in-one
// commands file 2026-08-12: one subject, independently mutation-testable.

export const ProtectedCreationNotice =
    "No footnote was created: footnotes can't go inside code, math, or other protected text.";

/**
 * The rightmost column at or left of `ch` where an insertion keeps its
 * meaning: text inserted directly after an ESCAPING backslash would itself
 * be escaped ("\" + "[^N]" is literal prose, its appended definition
 * instantly orphaned — while the character the backslash used to protect
 * goes LIVE), and a reference inserted directly after an unescaped "^"
 * would be swallowed as inline-footnote content ("^" + "[^N]" reads as
 * "^[^N]"). Both found by the command-press property suite (2026-08-12).
 * Each hazard steps one column left; runs of hazards walk left until the
 * insertion is safe.
 */
export function safeInsertionCh(lineText: string, ch: number): number {
    for (;;) {
        if (escapedAt(lineText, ch)) {
            ch--;
            continue;
        }
        if (
            ch > 0 &&
            lineText[ch - 1] === "^" &&
            !escapedAt(lineText, ch - 1)
        ) {
            ch--;
            continue;
        }
        return ch;
    }
}

/**
 * The caret line's masked twin AFTER replacing `[position.ch, toCh)` with
 * `insert` (a plain insertion when `toCh` is omitted) — the liveness
 * oracle for single-change edits: an insertion can COMPLETE a construct
 * around it and be masked into it at birth ("$…$" whose content
 * previously had a space edge is the found case — command-press property
 * suite, 2026-08-12), and a selection REPLACEMENT (issue #35) can
 * additionally un-close a construct whose closer it deletes. Simulated
 * against the whole document so multi-line region state is honored.
 */
export function simulatedMaskedLine(
    doc: Editor,
    position: EditorPosition,
    insert: string,
    toCh: number = position.ch,
): string {
    const lines = docLines(doc);
    const lineText = lines[position.line];
    lines[position.line] =
        lineText.slice(0, position.ch) + insert + lineText.slice(toCh);
    return maskedLineAt(lines, position.line);
}

/** The document `changes` would produce — every change addresses the ORIGINAL text (CodeMirror transaction semantics), so they apply back-to-front. */
export function simulateChanges(
    lines: string[],
    changes: EditorChange[],
): string[] {
    const text = lines.join("\n");
    const offsetOf = (pos: EditorPosition): number => {
        let offset = 0;
        for (let i = 0; i < pos.line && i < lines.length; i++) {
            offset += lines[i].length + 1;
        }
        return offset + pos.ch;
    };
    const resolved = changes
        .map((change, index) => ({
            from: offsetOf(change.from),
            to: change.to ? offsetOf(change.to) : offsetOf(change.from),
            text: change.text,
            index,
        }))
        // back-to-front; SAME-POSITION insertions concatenate in change
        // order (CodeMirror semantics — the reference and the EOF-append
        // definition share an offset when the caret sits at line end), so
        // ties apply the later change first
        .sort((a, b) => b.from - a.from || b.index - a.index);
    let out = text;
    for (const change of resolved) {
        out = out.slice(0, change.from) + change.text + out.slice(change.to);
    }
    return out.split("\n");
}

/** Whether `ch` sits STRICTLY inside a masked (NUL) span — the text on both sides is claimed. Boundaries are fine: just before an opener or just after a closer inserts outside the span. `openAtStart`/`openAtEnd` stand in for the off-line neighbor at ch 0 / end of line. */
export function caretInsideMaskedSpan(
    masked: string,
    ch: number,
    openAtStart: boolean,
    openAtEnd: boolean,
): boolean {
    const before = ch > 0 ? masked[ch - 1] === "\0" : openAtStart;
    const after = ch < masked.length ? masked[ch] === "\0" : openAtEnd;
    return before && after;
}
