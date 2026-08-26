import { Editor, EditorChange, EditorPosition } from "obsidian";

import { docLines } from "./doc-context";
import { escapedAt, referenceOccurrences } from "../parsing/footnote-grammar";
import { findDefinitionBlocks, maskedLineAt, scanDocument } from "../parsing/markdown-scan";

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

// shared by simulateChanges and simulatedAnchor: the character offset of a
// position in `lines` (LF-joined, matching CodeMirror's coordinates)
function offsetIn(lines: string[], pos: EditorPosition): number {
    let offset = 0;
    for (let i = 0; i < pos.line && i < lines.length; i++) {
        offset += lines[i].length + 1;
    }
    return offset + pos.ch;
}

// The ONE resolved, ordered view of a transaction's changes, shared by
// simulateChanges and simulatedAnchor so the two can never disagree:
// offsets against the ORIGINAL text (CodeMirror transaction semantics),
// sorted by position, with zero-length INSERTS landing BEFORE a range
// change at the same offset REGARDLESS of array order and same-position
// inserts keeping array order — both verified empirically against
// @codemirror/state 6.5 (hunt 2026-08-25: the old back-to-front splice
// resolved a tied replace's `to` against the already-mutated string and
// silently dropped a character of the tied insert). Range changes never
// overlap; CodeMirror itself refuses overlapping spans.
function resolveChanges(lines: string[], changes: EditorChange[]) {
    return changes
        .map((change, index) => ({
            from: offsetIn(lines, change.from),
            to: change.to
                ? offsetIn(lines, change.to)
                : offsetIn(lines, change.from),
            text: change.text,
            index,
        }))
        .sort(
            (a, b) =>
                a.from - b.from ||
                Number(a.to > a.from) - Number(b.to > b.from) ||
                a.index - b.index,
        );
}

// Apply the resolved changes left-to-right against the original text,
// recording where each change's text BEGINS in the output (indexed by
// the change's ORIGINAL array position). Landing offsets fall out of the
// construction itself, so the anchor arithmetic cannot drift from the
// applied result.
function applyResolvedChanges(
    text: string,
    resolved: ReturnType<typeof resolveChanges>,
): { out: string; landing: number[] } {
    let out = "";
    let pos = 0;
    const landing = new Array<number>(resolved.length);
    for (const change of resolved) {
        out += text.slice(pos, Math.max(pos, change.from));
        landing[change.index] = out.length;
        out += change.text;
        pos = Math.max(pos, change.to);
    }
    return { out: out + text.slice(pos), landing };
}

/** The document `changes` would produce — every change addresses the ORIGINAL text (CodeMirror transaction semantics). */
export function simulateChanges(
    lines: string[],
    changes: EditorChange[],
): string[] {
    const { out } = applyResolvedChanges(
        lines.join("\n"),
        resolveChanges(lines, changes),
    );
    return out.split("\n");
}

/**
 * Where the text of `changes[anchorIndex]` BEGINS in the simulated
 * document — read off the same construction simulateChanges applies, so
 * it is exact by definition (the pre-2026-08-25 shift arithmetic
 * disagreed with the applied result on same-offset ties). The
 * reference-liveness checks used to read the anchor's ORIGINAL line
 * index off the simulated document instead, falsely refusing legitimate
 * creations whenever the definition appended ABOVE the caret —
 * definitions under a mid-document heading with prose below them (found
 * by the entry corpus, 2026-08-12).
 */
export function simulatedAnchor(
    lines: string[],
    changes: EditorChange[],
    anchorIndex: number,
    simulated: string[],
): EditorPosition {
    const { landing } = applyResolvedChanges(
        lines.join("\n"),
        resolveChanges(lines, changes),
    );
    let offset = landing[anchorIndex];
    let line = 0;
    while (line < simulated.length && offset > simulated[line].length) {
        offset -= simulated[line].length + 1;
        line++;
    }
    return { line, ch: offset };
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

/**
 * The shared born-dead verdict for definition-backed insertions — the
 * single-caret insert, the multi-caret insert, and the selection
 * conversion each cloned this block before 2026-08-25. On the SIMULATED
 * result: every reference change must still parse as a live "[^id]"
 * occurrence at its shifted anchor (simulatedAnchor — a definition
 * appended ABOVE the caret shifts later lines, a collapsing selection
 * shifts lines below it), and the definition must parse as a live block
 * starting at `definitionLabelLine` that claims every seeded
 * continuation line. Null = something died — the caller toasts
 * ProtectedCreationNotice and refuses the whole press (atomicity: one
 * dead landing refuses the lot). Every failure mode this guards was
 * found by the command-press property suite (2026-08-12).
 *
 * Pass `simulated` when the caller already simulated (to derive the
 * label line); otherwise it is computed here.
 */
export function verifyLiveFootnoteInsertion(opts: {
    lines: string[];
    changes: EditorChange[];
    /** indices into `changes` that write a "[^id]" reference */
    referenceChangeIndices: number[];
    footnoteId: string;
    /** the definition label's line in POST-transaction coordinates */
    definitionLabelLine: number;
    /** seeded continuation lines under the label (multi-line bodies) */
    definitionBodyExtraLines?: number;
    simulated?: string[];
}): { anchors: EditorPosition[] } | null {
    const simulated = opts.simulated ?? simulateChanges(opts.lines, opts.changes);
    const simulatedScan = scanDocument(simulated);
    const bodyExtraLines = opts.definitionBodyExtraLines ?? 0;
    const definitionLive = findDefinitionBlocks(
        simulated,
        simulatedScan.isProtected,
        simulatedScan,
    ).some(
        (block) =>
            block.start === opts.definitionLabelLine &&
            block.end >= opts.definitionLabelLine + bodyExtraLines,
    );
    if (!definitionLive) return null;
    const anchors = opts.referenceChangeIndices.map((index) =>
        simulatedAnchor(opts.lines, opts.changes, index, simulated),
    );
    const everyReferenceLive = anchors.every((anchor) =>
        referenceOccurrences(
            simulated[anchor.line],
            maskedLineAt(simulated, anchor.line),
        ).some(
            (occurrence) =>
                occurrence.start === anchor.ch &&
                occurrence.name === opts.footnoteId,
        ),
    );
    return everyReferenceLive ? { anchors } : null;
}
