import { EditorView, ViewUpdate } from "@codemirror/view";
import { Notice } from "obsidian";

import {
    definitionLabelWithName,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { maskProtectedLines } from "../parsing/markdown-scan";

// Feedback for a PARTIAL undo (Jason's report 2026-08-27, notice always
// on — his call): creating a footnote from a table cell takes TWO undo
// steps, because the reference is dispatched through the cell's own
// sub-editor (writing the row via the main editor while a cell owns focus
// is the issue #28 corruption family) while the definition rides a main-
// editor transaction — and CodeMirror's history only groups adjacent
// changes from one dispatch, so the two can never share an undo step. The
// first undo silently stranded an orphaned reference in the table; this
// listener says so. It speaks up for every partial-undo orphan, not just
// tables: undoing the named flow's definition press leaves the typed
// reference behind the same way, and the guidance is identical.

/**
 * The names this undo orphaned — defined before it, not defined after it,
 * yet still referenced afterwards — in the definitions' own casing.
 * Masked-aware on both sides (code-span decoys neither trigger nor
 * suppress, the A20 decoy lesson) and case-insensitive like every id
 * compare. Pure; exported for units.
 */
export function orphanedByUndo(before: string, after: string): string[] {
    const beforeDefined = definedNames(before.split("\n"));
    if (beforeDefined.size === 0) return [];
    const afterLines = after.split("\n");
    const afterDefined = definedNames(afterLines);
    const referenced = new Set<string>();
    const masked = maskProtectedLines(afterLines);
    for (let i = 0; i < afterLines.length; i++) {
        for (const occurrence of referenceOccurrences(afterLines[i], masked[i])) {
            referenced.add(occurrence.name.toLowerCase());
        }
    }
    const orphaned: string[] = [];
    for (const [folded, raw] of beforeDefined) {
        if (!afterDefined.has(folded) && referenced.has(folded)) {
            orphaned.push(raw);
        }
    }
    return orphaned;
}

/** Every definition name in `lines`, folded → raw casing (last one wins, matching Obsidian's last-definition-renders rule). */
function definedNames(lines: string[]): Map<string, string> {
    const masked = maskProtectedLines(lines);
    const names = new Map<string, string>();
    for (let i = 0; i < lines.length; i++) {
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (hit) names.set(hit.name.toLowerCase(), hit.name);
    }
    return names;
}

// Stryker disable all: CodeMirror update-listener plumbing against the
// live editor — smoke-test territory, unreachable from units (the pure
// decision above is what units pin)
/**
 * The editor extension (registered app-wide in main.ts): on an UNDO
 * transaction that orphaned footnote references, say so — the note looks
 * half-reverted, and without the notice the leftover reference reads as
 * a bug. Gated hard: doc must have changed, the transaction must be a
 * history undo, and the removed text must even contain "]:", before any
 * whole-document scan runs.
 */
export function undoOrphanNoticeExtension() {
    return EditorView.updateListener.of((update: ViewUpdate) => {
        if (!update.docChanged) return;
        if (!update.transactions.some((tr) => tr.isUserEvent("undo"))) return;
        let removed = "";
        update.changes.iterChanges((fromA, toA) => {
            removed += update.startState.sliceDoc(fromA, toA);
        });
        if (!removed.includes("]:")) return;
        const orphaned = orphanedByUndo(
            update.startState.doc.toString(),
            update.state.doc.toString(),
        );
        if (orphaned.length === 0) return;
        const refs = orphaned.map((name) => `[^${name}]`).join(", ");
        new Notice(
            `The undo removed the footnote definition, but ${refs} ${
                orphaned.length === 1 ? "is" : "are"
            } still in the note. Undo again to remove the reference too.`,
            8000,
        );
    });
}
// Stryker restore all
