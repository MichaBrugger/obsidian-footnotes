import { Editor, MarkdownView, Notice } from "obsidian";

import FootnotePlugin from "./main";
import {
    settleFootnotePopupWithFeedback,
    toggleCloseFootnotePopup,
} from "./footnote-popup";
import { runOutsideTableCell } from "./insert-or-navigate-footnotes";
import { footnoteAfterPunctuation } from "./footnote-after-punctuation";
import { normalizeEol, restoreEol } from "./markdown-scan";
import { moveFootnoteDefinitionsToBottom } from "./move-footnotes-to-bottom";
import { reindexFootnotes, ReindexOptions } from "./reindex-footnotes";

// The whole-document cleanup commands: each pure transform (see its own
// module) gets a command, plus one "tidy" command composing all three. This
// module owns the editor plumbing they share and the mapping from plugin
// settings to the transforms' options.

function configuredSectionHeading(plugin: FootnotePlugin): string {
    return plugin.settings.enableFootnoteSectionHeading
        ? plugin.settings.footnoteSectionHeading
        : "";
}

/** The reindex policy the user picked in the settings tab. */
export function reindexOptionsFromSettings(
    plugin: FootnotePlugin,
): ReindexOptions {
    return {
        keepOrphanedDefinitions: plugin.settings.keepOrphanedDefinitions,
        renumberNamedFootnotes: plugin.settings.renumberNamedFootnotes,
    };
}

/** The tidy pipeline (steps + reindex policy) the user picked in the settings tab. */
export function tidyOptionsFromSettings(
    plugin: FootnotePlugin,
    sectionHeading: string,
): TidyOptions {
    return {
        sectionHeading,
        fixPunctuation: plugin.settings.tidyFixPunctuation,
        moveDefinitionsToBottom: plugin.settings.tidyMoveToBottom,
        reindex: plugin.settings.tidyReindex,
        reindexOptions: reindexOptionsFromSettings(plugin),
    };
}

export interface TidyOptions {
    /** Passed through to moveFootnoteDefinitionsToBottom (default none). */
    sectionHeading?: string;
    /** Run footnoteAfterPunctuation (default on). */
    fixPunctuation?: boolean;
    /** Run moveFootnoteDefinitionsToBottom (default on). */
    moveDefinitionsToBottom?: boolean;
    /** Run reindexFootnotes (default on). */
    reindex?: boolean;
    /** Passed through to reindexFootnotes. */
    reindexOptions?: ReindexOptions;
}

/** The enabled cleanups in dependency order: fix punctuation, gather definitions at the bottom, then renumber and reorder. */
export function tidyFootnotes(
    markdown: string,
    options: TidyOptions = {},
): string {
    // normalize once here so the composed steps all see LF and the note's
    // original endings are restored a single time on the way out
    const { text, eol } = normalizeEol(markdown);
    let result = text;
    if (options.fixPunctuation ?? true) {
        result = footnoteAfterPunctuation(result);
    }
    if (options.moveDefinitionsToBottom ?? true) {
        result = moveFootnoteDefinitionsToBottom(
            result,
            options.sectionHeading ?? "",
        );
    }
    if (options.reindex ?? true) {
        result = reindexFootnotes(result, options.reindexOptions);
    }
    return restoreEol(result, eol);
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
