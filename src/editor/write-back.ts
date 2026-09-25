import { Editor, EditorPosition, MarkdownView } from "obsidian";

import { lineDiffChanges, lineMapper, mapFoldLines } from "./document-diff";

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
 * former sheet 20, 2026-09-11.) The edits are worked out by lineDiffChanges; all
 * of them are positions in the text BEFORE the rewrite, which is what a
 * transaction expects.
 */
export function replaceMinimal(doc: Editor, before: string, after: string, mdView?: MarkdownView) {
    const changes = lineDiffChanges(before, after);
    if (changes.length === 0) return;
    // the other panes showing this note, and where each one is, read
    // before anything moves (see restoreOtherPanes)
    const otherPanes = mdView ? otherPanesOn(mdView) : [];
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
    if (otherPanes.length > 0) restoreOtherPanes(otherPanes, after, lineMapper(changes, before));
}

/** Another pane's place in the same note: its editor, its selection (anchor and head), and how far it is scrolled. */
interface PanePlace {
    editor: Editor;
    anchor: EditorPosition;
    head: EditorPosition;
    scroll: { top: number; left: number };
}

/**
 * Every other pane that shows the same note as `mdView` (the note split
 * into two panes, or open in a second window), with its caret and scroll
 * position as they are now.
 */
function otherPanesOn(mdView: MarkdownView): PanePlace[] {
    const path = mdView.file?.path;
    // the unit tests hand in a bare stand-in for the view, with no app on
    // it; there are no other panes to find then
    const app = (mdView as Partial<MarkdownView>).app;
    if (path === undefined || !app) return [];
    const places: PanePlace[] = [];
    for (const leaf of app.workspace.getLeavesOfType("markdown")) {
        const view = leaf.view;
        if (!(view instanceof MarkdownView) || view === mdView || view.file?.path !== path) continue;
        const editor = view.editor;
        places.push({
            editor,
            anchor: editor.getCursor("anchor"),
            head: editor.getCursor("head"),
            scroll: editor.getScrollInfo(),
        });
    }
    return places;
}

/**
 * Put every other pane back where it was. Obsidian copies a rewrite into
 * the other panes on the same note a moment later, as one whole
 * replacement, which drops each pane's caret to the top of the note and
 * can shift its scroll (Jason's report, sheet 19, 2026-09-24: the pane he
 * was not typing in jumped, and a split view is on purpose). The copy
 * lands within about 200 ms (probed live, 2026-09-24), so this waits for
 * each pane's text to become the new text, then puts its selection back,
 * carried through the edits the way folds are, and its scroll position
 * after it. A pane whose copy never lands is left alone after a second.
 */
function restoreOtherPanes(places: PanePlace[], after: string, mapLine: (line: number) => number): void {
    let waiting = places;
    let tries = 0;
    const tick = (): void => {
        const stillWaiting: PanePlace[] = [];
        for (const place of waiting) {
            if (place.editor.getValue() !== after) {
                stillWaiting.push(place);
                continue;
            }
            const at = (pos: EditorPosition): EditorPosition => {
                const line = Math.min(mapLine(pos.line), place.editor.lastLine());
                return { line, ch: Math.min(pos.ch, place.editor.getLine(line).length) };
            };
            place.editor.setSelection(at(place.anchor), at(place.head));
            place.editor.scrollTo(place.scroll.left, place.scroll.top);
        }
        waiting = stillWaiting;
        tries++;
        if (waiting.length > 0 && tries < 20) window.setTimeout(tick, 50);
    };
    window.setTimeout(tick, 0);
}

/** The fold half of a MarkdownView's edit mode, as Obsidian ships it without typings: the folds as line ranges, and a way to put a list of them back. */
interface FoldingMode {
    getFoldInfo?: () => { folds: { from: number; to: number }[]; lines: number } | null;
    applyFoldInfo?: (info: { folds: { from: number; to: number }[]; lines: number }) => void;
}
