import { Editor, EditorChange, EditorPosition } from "obsidian";
import { NoFootnoteCreated } from "./notice";

import { docLines } from "./doc-context";
import { escapedAt, referenceOccurrences } from "../parsing/footnote-grammar";
import {
    definitionStartLines,
    findDefinitionBlocks,
    maskedLineAt,
    maskProtectedLines,
    scanDocument,
} from "../parsing/markdown-scan";

// The born-dead safety kit. One question: once the text lands, will it
// still MEAN what it says?
//
// Two ways it can fail. The insertion is swallowed by whatever sits
// directly before it: an escaping backslash, or an inline-footnote opener.
// Or the insertion RECLASSIFIES the text around it, by completing a "$…$"
// math pair, or by demoting a quote whose region then swallows the appended
// definition. Every failure mode here was found by the command-press
// property suite (2026-08-12).
//
// Split out of the all-in-one commands file 2026-08-12: one subject, and
// mutation-testable on its own.

export const ProtectedCreationNotice =
    NoFootnoteCreated + "footnotes can't go inside code, math, or other protected text.";

/**
 * The furthest right column, at or left of `ch`, where an insertion still
 * means what it says.
 *
 * Two hazards. Text placed directly after an ESCAPING backslash is itself
 * escaped: "\" plus "[^N]" is literal prose, so the definition appended for
 * it is an orphaned definition the moment it lands, while the character the
 * backslash used to protect goes LIVE. And a reference placed directly
 * after an unescaped "^" is swallowed as inline-footnote text: "^" plus
 * "[^N]" reads as "^[^N]".
 *
 * Both were found by the command-press property suite (2026-08-12). Each
 * hazard steps the column one to the left, and a run of them is walked
 * until the insertion is safe.
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
 * The caret line's masked twin (a copy of the line with protected text
 * blanked out) as it WOULD look after replacing the columns from
 * `position.ch` up to `toCh` with `insert`. Leave `toCh` out for a plain
 * insertion.
 *
 * This is how a single-change edit is checked for liveness. An insertion
 * can COMPLETE a construct around itself and so be masked into it at birth:
 * the case found was a "$…$" math pair whose contents previously had a
 * space at the edge (command-press property suite, 2026-08-12). A selection
 * REPLACEMENT (issue #35) can also do the opposite and un-close a construct
 * by deleting its closer. The simulation runs against the whole document,
 * so region state spanning several lines is honored.
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

// Shared by simulateChanges and simulatedAnchor: how many characters into
// `lines` a position sits, counting the lines as joined by a single "\n",
// which is how CodeMirror counts them.
function offsetIn(lines: string[], pos: EditorPosition): number {
    let offset = 0;
    for (let i = 0; i < pos.line && i < lines.length; i++) {
        offset += lines[i].length + 1;
    }
    return offset + pos.ch;
}

// The ONE sorted view of a transaction's changes, shared by simulateChanges
// and simulatedAnchor so the two can never disagree about them.
//
// The rules: every offset is measured against the ORIGINAL text, which is
// how CodeMirror transactions work; the changes are sorted by position; a
// zero-length INSERT at the same offset as a range change comes first,
// REGARDLESS of the order the array had; and inserts at the same position
// keep their array order. Both tie rules were checked by experiment against
// @codemirror/state 6.5 (hunt 2026-08-25: the old back-to-front splice
// worked out a tied replace's `to` against a string it had already changed,
// and silently dropped a character of the tied insert).
//
// Range changes never overlap, because CodeMirror itself refuses
// overlapping spans.
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
        // Stryker disable ConditionalExpression, ArithmeticOperator: changing this comparator's tiebreak may or may not alter anything, depending only on which argument order the sort happens to probe with, not on real behavior - the tie ORDER contract itself (an insert comes before a replace, stacked inserts keep array order) is pinned in bug-simulate-changes-tie-drops-text
        .sort(
            (a, b) =>
                a.from - b.from ||
                Number(a.to > a.from) - Number(b.to > b.from) ||
                a.index - b.index,
        );
    // Stryker restore all
}

// Apply the sorted changes left to right against the original text, and
// note where each change's text BEGINS in the result, stored under the
// change's ORIGINAL position in the array. Those landing offsets fall out
// of the building itself, so the anchor arithmetic can never drift away
// from what was actually applied.
function applyResolvedChanges(
    text: string,
    resolved: ReturnType<typeof resolveChanges>,
): { out: string; landing: number[] } {
    let out = "";
    let pos = 0;
    // Stryker disable next-line ArrayDeclaration: the length is only a hint about how much room to reserve up front - every slot is filled in by index just below, so a plain new Array() behaves identically
    const landing = new Array<number>(resolved.length);
    for (const change of resolved) {
        out += text.slice(pos, Math.max(pos, change.from));
        landing[change.index] = out.length;
        out += change.text;
        pos = Math.max(pos, change.to);
    }
    return { out: out + text.slice(pos), landing };
}

/** The document `changes` would produce. Every change is measured against
 * the ORIGINAL text, the way CodeMirror transactions work. */
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
 * document.
 *
 * It is read straight off the same construction simulateChanges applies, so
 * it is exact by definition. The shift arithmetic used before 2026-08-25
 * disagreed with the applied result whenever two changes tied at one
 * offset.
 *
 * The reference-liveness checks used to look up the anchor's ORIGINAL line
 * number in the simulated document instead. That wrongly refused perfectly
 * good creations whenever the definition was appended ABOVE the caret,
 * which happens with definitions under a heading partway down the note that
 * has prose below them (found by the entry corpus, 2026-08-12).
 */
export function simulatedAnchor(
    lines: string[],
    changes: EditorChange[],
    anchorIndex: number,
    simulated: string[],
): EditorPosition {
    return simulatedAnchors(lines, changes, [anchorIndex], simulated)[0];
}

/** Every requested landing spot from ONE pass. The single-anchor form above
 * re-joined and re-sorted the whole document once per reference (review B4,
 * 2026-09-09). */
export function simulatedAnchors(
    lines: string[],
    changes: EditorChange[],
    anchorIndices: number[],
    simulated: string[],
): EditorPosition[] {
    const { landing } = applyResolvedChanges(
        lines.join("\n"),
        resolveChanges(lines, changes),
    );
    return anchorIndices.map((anchorIndex) => {
        let offset = landing[anchorIndex];
        let line = 0;
        while (line < simulated.length && offset > simulated[line].length) {
            offset -= simulated[line].length + 1;
            line++;
        }
        return { line, ch: offset };
    });
}

/** Whether `ch` sits STRICTLY inside a masked span (the run of NULs that
 * stands in for protected text), meaning the characters on both sides of it
 * are claimed. The edges are fine: just before an opener, or just after a
 * closer, inserts outside the span. At column 0 there is no character to
 * the left, and at end of line none to the right, so `openAtStart` and
 * `openAtEnd` say whether a masked span is already open there. */
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
 * The shared born-dead verdict for any insertion that comes with a
 * definition. The single-caret insert, the multi-caret press, and the
 * selection conversion each had their own copy of this block before
 * 2026-08-25.
 *
 * It judges the SIMULATED result, and two things must hold. Every reference
 * the press writes must still read as a live "[^id]" at its shifted landing
 * spot (simulatedAnchor: a definition appended ABOVE the caret pushes later
 * lines down, and a selection collapsing pulls the lines below it up). And
 * the definition must read as a live definition block that starts at
 * `definitionLabelLine` and claims every continuation line seeded under it.
 *
 * Null means something died. The caller then shows ProtectedCreationNotice
 * and refuses the whole press: one dead landing refuses the lot. Every
 * failure mode this guards against was found by the command-press property
 * suite (2026-08-12).
 *
 * Pass `simulated` when you have already simulated (to work out the label
 * line); otherwise it is computed here.
 */
export function verifyLiveFootnoteInsertion(opts: {
    lines: string[];
    changes: EditorChange[];
    /** which entries of `changes` write a "[^id]" reference */
    referenceChangeIndices: number[];
    footnoteId: string;
    /** the definition label's line number, counted in the document AFTER
     * the changes land */
    definitionLabelLine: number;
    /** how many continuation lines are seeded under the label, for a
     * definition whose body runs over several lines */
    definitionBodyExtraLines?: number;
    simulated?: string[];
}): { anchors: EditorPosition[] } | null {
    const simulated = opts.simulated ?? simulateChanges(opts.lines, opts.changes);
    const simulatedScan = scanDocument(simulated);
    const bodyExtraLines = opts.definitionBodyExtraLines ?? 0;
    const definitionLive = findDefinitionBlocks(simulated, simulatedScan).some(
        (block) =>
            block.start === opts.definitionLabelLine &&
            block.end >= opts.definitionLabelLine + bodyExtraLines,
    );
    if (!definitionLive) return null;
    const anchors = simulatedAnchors(opts.lines, opts.changes, opts.referenceChangeIndices, simulated);
    // build the masked twin once from the scan already taken: maskedLineAt
    // would re-scan the whole simulated document once per reference
    // (review B4)
    const simulatedMasked = maskProtectedLines(simulated, simulatedScan);
    const simulatedStarts = definitionStartLines(simulated, simulatedScan, (i) => simulatedMasked[i]);
    const everyReferenceLive = anchors.every((anchor) =>
        referenceOccurrences(
            simulated[anchor.line],
            simulatedMasked[anchor.line],
            simulatedStarts[anchor.line],
        ).some(
            (occurrence) =>
                occurrence.start === anchor.ch &&
                occurrence.name === opts.footnoteId,
        ),
    );
    return everyReferenceLive ? { anchors } : null;
}
