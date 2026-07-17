import { Editor, MarkdownView, Notice, TFile } from "obsidian";

import FootnotePlugin from "./main";
import {
    footnotePopupBusy,
    settleFootnotePopupWithFeedback,
    toggleCloseFootnotePopup,
} from "./footnote-popup";
import { runOutsideTableCell } from "./insert-or-navigate-footnotes";
import { footnoteAfterPunctuation } from "./footnote-after-punctuation";
import { normalizeEol, restoreEol } from "./markdown-scan";
import { moveFootnoteDefinitionsToBottom } from "./move-footnotes-to-bottom";
import { AppWithCommands, EditorWithCm } from "./obsidian-internals";
import { reindexFootnotes, ReindexOptions } from "./reindex-footnotes";
import { activeTableCellEditor } from "./table-cursor";

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

// ---------- automatic tidying (Linter-style triggers) ----------

// A sub-editor (an actively edited table cell) owning focus means document
// edits race its sync-back (issue #28 family). The manual command defers
// around this state; the automatic triggers just skip — a save must never
// be delayed or destabilized by its tidy.
function subEditorOwnsFocus(doc: Editor): boolean {
    const cm = (doc as EditorWithCm).cm;
    const active = cm?.contentDOM.ownerDocument.activeElement;
    return !!(
        cm &&
        active &&
        active !== cm.contentDOM &&
        cm.contentDOM.contains(active)
    );
}

// Tidy the active note synchronously when it's safe to; the save hook calls
// this right before delegating, so the save writes the tidied text.
function tidyActiveNoteIfSafe(plugin: FootnotePlugin) {
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView || !mdView.editor) return;
    if (footnotePopupBusy()) return; // a pending popup save owns the file
    const doc = mdView.editor;
    if (activeTableCellEditor(doc) || subEditorOwnsFocus(doc)) return;
    const before = doc.getValue();
    const after = tidyFootnotes(
        before,
        tidyOptionsFromSettings(plugin, configuredSectionHeading(plugin)),
    );
    if (after === before) return;
    replaceMinimal(doc, before, after);
    new Notice("Footnotes tidied.");
}

/**
 * Wrap the core save command so "Tidy on save" runs just before the write.
 * `app.commands` is private API, so a shape change degrades to manual
 * tidying; the original callback is restored on plugin unload.
 */
export function installTidyOnSave(plugin: FootnotePlugin) {
    const command = (plugin.app as AppWithCommands).commands?.commands?.[
        "editor:save-file"
    ];
    if (!command || typeof command.checkCallback !== "function") return;
    const original = command.checkCallback;
    command.checkCallback = (checking: boolean) => {
        if (!checking && plugin.settings.tidyOnSave) {
            tidyActiveNoteIfSafe(plugin);
        }
        return original(checking);
    };
    plugin.register(() => {
        command.checkCallback = original;
    });
}

// the last markdown file that held focus — sidebars and modals don't count,
// so flicking through them never looks like a file change
let lastFocused: { view: MarkdownView; file: TFile } | null = null;

/** Forget the focus tracking state (plugin unload). */
export function resetAutoTidyTracking() {
    lastFocused = null;
}

/**
 * Feed active-leaf changes to "Tidy on focused file change": when the
 * focused markdown FILE changes, the note the user just left gets tidied.
 * Call on every active-leaf-change and once at layout-ready (to seed the
 * tracker with the note open at startup).
 */
export function noteActiveLeafForAutoTidy(plugin: FootnotePlugin) {
    const current = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!current || !current.file) return;
    const previous = lastFocused;
    lastFocused = { view: current, file: current.file };
    if (!plugin.settings.tidyOnFileChange) return;
    if (!previous || previous.file.path === current.file.path) return;
    if (footnotePopupBusy()) return; // its pending save owns that file
    void tidyLeftNote(plugin, previous);
}

async function tidyLeftNote(
    plugin: FootnotePlugin,
    previous: { view: MarkdownView; file: TFile },
) {
    const options = tidyOptionsFromSettings(
        plugin,
        configuredSectionHeading(plugin),
    );
    // the note may still be open in another pane — there its (possibly
    // unsaved) editor buffer is the source of truth, not the file
    if (previous.view.file === previous.file && previous.view.editor) {
        const doc = previous.view.editor;
        if (activeTableCellEditor(doc)) return;
        const before = doc.getValue();
        const after = tidyFootnotes(before, options);
        if (after === before) return;
        replaceMinimal(doc, before, after);
        new Notice(`Tidied footnotes in "${previous.file.basename}".`);
        return;
    }
    // the leaf navigated away or closed — Obsidian has flushed the buffer,
    // so transform the file atomically on disk
    try {
        let changed = false;
        await plugin.app.vault.process(previous.file, (data) => {
            const after = tidyFootnotes(data, options);
            changed = after !== data;
            return after;
        });
        if (changed) {
            new Notice(`Tidied footnotes in "${previous.file.basename}".`);
        }
    } catch {
        // the file vanished between the switch and the tidy — nothing to do
    }
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
