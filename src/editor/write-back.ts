import { Editor, MarkdownView } from "obsidian";

import { lineDiffChanges, mapFoldLines } from "./document-diff";

// Writing a whole new text for the note back into the editor as the
// smallest set of edits, keeping folds and the caret. Moved out of
// linter.ts on 2026-09-16 so the footnote popup can write its definition
// the same way.

/**
 * Rewrite only the lines that actually changed, as separate edits in one
 * transaction. Untouched lines are never rewritten, so a fold on them
 * stays folded and a caret in them stays put. (It used to be one edit from
 * the first changed character to the last, which unfolded everything in
 * between and pushed a caret inside the span to its start: Jason's report,
 * sheet 20, 2026-09-11.) The edits are worked out by lineDiffChanges; all
 * of them are positions in the text BEFORE the rewrite, which is what a
 * transaction expects.
 */
export function replaceMinimal(doc: Editor, before: string, after: string, mdView?: MarkdownView) {
    const changes = lineDiffChanges(before, after);
    if (changes.length === 0) return;
    // Obsidian drops a heading's fold on any edit inside it (probed live,
    // 2026-09-11), so the folds are read before the rewrite and put back
    // after it, with their line numbers carried through the edits
    // (Jason's report: a folded section with footnotes under it still
    // unfolded). The fold API is undocumented, so every step is guarded.
    const mode = (mdView as { currentMode?: FoldingMode } | undefined)?.currentMode;
    const foldInfo = mode?.getFoldInfo?.() ?? null;
    doc.transaction({
        changes: changes.map((change) => ({
            from: doc.offsetToPos(change.from),
            to: doc.offsetToPos(change.to),
            text: change.text,
        })),
    });
    if (foldInfo && foldInfo.folds.length > 0 && mode?.applyFoldInfo) {
        mode.applyFoldInfo({
            folds: mapFoldLines(foldInfo.folds, changes, before),
            lines: after.split("\n").length,
        });
    }
}

/** The fold half of a MarkdownView's edit mode, as Obsidian ships it without typings: the folds as line ranges, and a way to put a list of them back. */
interface FoldingMode {
    getFoldInfo?: () => { folds: { from: number; to: number }[]; lines: number } | null;
    applyFoldInfo?: (info: { folds: { from: number; to: number }[]; lines: number }) => void;
}
