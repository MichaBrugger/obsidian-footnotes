import { Editor, MarkdownView, Notice } from "obsidian";

import FootnotePlugin from "./main";
import {
    settleFootnotePopupWithFeedback,
    toggleCloseFootnotePopup,
} from "./footnote-popup";
import { runOutsideTableCell } from "./insert-or-navigate-footnotes";
import { footnoteAfterPunctuation } from "./footnote-after-punctuation";
import { moveFootnoteDefinitionsToBottom } from "./move-footnotes-to-bottom";
import { reindexFootnotes } from "./reindex-footnotes";

// The whole-document cleanup commands: each pure transform (see its own
// module) gets a command, plus one "tidy" command composing all three. This
// module owns the editor plumbing they share.

function configuredSectionHeading(plugin: FootnotePlugin): string {
    return plugin.settings.enableFootnoteSectionHeading
        ? plugin.settings.footnoteSectionHeading
        : "";
}

/** All three cleanups in dependency order: fix punctuation, gather definitions at the bottom, then renumber and reorder. */
export function tidyFootnotes(markdown: string, sectionHeading = ""): string {
    return reindexFootnotes(
        moveFootnoteDefinitionsToBottom(
            footnoteAfterPunctuation(markdown),
            sectionHeading,
        ),
    );
}

// Replace only the changed middle of the document, so the cursor and the
// scroll position map through the edit instead of resetting to the top.
function replaceMinimal(doc: Editor, before: string, after: string) {
    let start = 0;
    const maxStart = Math.min(before.length, after.length);
    while (start < maxStart && before[start] === after[start]) start++;
    let beforeEnd = before.length;
    let afterEnd = after.length;
    while (
        beforeEnd > start &&
        afterEnd > start &&
        before[beforeEnd - 1] === after[afterEnd - 1]
    ) {
        beforeEnd--;
        afterEnd--;
    }
    doc.transaction({
        changes: [
            {
                from: doc.offsetToPos(start),
                to: doc.offsetToPos(beforeEnd),
                text: after.slice(start, afterEnd),
            },
        ],
    });
}

export async function runFootnoteTransformCommand(
    plugin: FootnotePlugin,
    transform: (markdown: string, sectionHeading: string) => string,
    notices: { done: string; noop: string },
) {
    // an open popup (or a closed one's pending save) would clobber a
    // whole-document edit: wait out any pending save, close the popup, then
    // wait out the save that closing itself starts
    await settleFootnotePopupWithFeedback();
    toggleCloseFootnotePopup();
    await settleFootnotePopupWithFeedback();

    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView || !mdView.editor) return;
    const doc = mdView.editor;

    // same guard as the insert commands: never edit the document while a
    // table cell sub-editor owns focus — its sync-back rewrites its region
    // from pre-edit state (issue #28 family)
    runOutsideTableCell(doc, () => {
        const before = doc.getValue();
        const after = transform(before, configuredSectionHeading(plugin));
        if (after === before) {
            new Notice(notices.noop);
            return;
        }
        replaceMinimal(doc, before, after);
        new Notice(notices.done);
    });
}
