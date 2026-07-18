import { Editor, MarkdownView, Notice, TFile } from "obsidian";

import FootnotePlugin from "../main";
import {
    footnotePopupBusy,
    settleFootnotePopupWithFeedback,
    toggleCloseFootnotePopup,
} from "../footnote-popup";
import {
    footnotePrefix,
    footnotePrefixProblem,
    runOutsideTableCell,
} from "../insert-or-navigate-footnotes";
import { normalizeEol, restoreEol } from "../markdown-scan";
import { AppWithCommands, EditorWithCm, WindowWithVim } from "../obsidian-internals";
import { activeTableCellEditor } from "../table-cursor";
import { footnoteAfterPunctuation } from "./rules/footnote-after-punctuation";
import { moveFootnoteDefinitionsToBottom } from "./rules/move-footnotes-to-the-bottom";
import { reindexFootnotes, ReindexOptions } from "./rules/re-index-footnotes";

// The whole-document footnote linter: each pure rule (see src/linting/rules/)
// gets a command, plus one "lint" command composing all three. This module
// owns the editor plumbing they share, the mapping from plugin settings to
// the rules' options, and the automatic-lint trigger machinery (lint on save
// and on focused-file change).

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

/** The lint pipeline (steps + reindex policy) the user picked in the settings tab. */
export function lintOptionsFromSettings(
    plugin: FootnotePlugin,
    sectionHeading: string,
): LintOptions {
    return {
        sectionHeading,
        fixPunctuation: plugin.settings.lintFixPunctuation,
        moveDefinitionsToBottom: plugin.settings.lintMoveToBottom,
        reindex: plugin.settings.lintReindex,
        reindexOptions: reindexOptionsFromSettings(plugin),
    };
}

export interface LintOptions {
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
export function lintFootnotes(
    markdown: string,
    options: LintOptions = {},
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

// ---------- automatic linting (Linter-style triggers) ----------

// A sub-editor (an actively edited table cell) owning focus means document
// edits race its sync-back (issue #28 family). The manual command defers
// around this state; the automatic triggers just skip — a save must never
// be delayed or destabilized by its lint.
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

/**
 * The alert blocking a lint of `markdown`, or null when linting may
 * proceed. A digit-ending footnote-prefix makes prefixed markers
 * indistinguishable from plain numbers, so reindexing would collapse the
 * chapter namespace — the lint is refused until the property is fixed.
 */
export function lintBlockedByPrefix(markdown: string): string | null {
    const prefix = footnotePrefix(markdown);
    if (!prefix || footnotePrefixProblem(prefix) === null) return null;
    return `Linting canceled: this note's footnote-prefix ("${prefix}") is invalid. ${footnotePrefixProblem(prefix)}`;
}

// Lint the active note synchronously when it's safe to; the save hook calls
// this right before delegating, so the save writes the linted text.
function lintActiveNoteIfSafe(plugin: FootnotePlugin) {
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView || !mdView.editor) return;
    if (footnotePopupBusy()) return; // a pending popup save owns the file
    const doc = mdView.editor;
    if (activeTableCellEditor(doc) || subEditorOwnsFocus(doc)) return;
    const before = doc.getValue();
    const blocked = lintBlockedByPrefix(before);
    if (blocked) {
        new Notice(blocked);
        return;
    }
    const after = lintFootnotes(
        before,
        lintOptionsFromSettings(plugin, configuredSectionHeading(plugin)),
    );
    if (after === before) return;
    replaceMinimal(doc, before, after);
    new Notice("Footnotes linted.");
}

/**
 * Wrap the core save command so "Lint on save" runs just before the write.
 * `app.commands` is private API, so a shape change degrades to manual
 * linting; the original callback is restored on plugin unload.
 */
export function installLintOnSave(plugin: FootnotePlugin) {
    const command = (plugin.app as AppWithCommands).commands?.commands?.[
        "editor:save-file"
    ];
    if (!command || typeof command.checkCallback !== "function") return;
    const original = command.checkCallback;
    command.checkCallback = (checking: boolean) => {
        if (!checking && plugin.settings.lintOnSave) {
            lintActiveNoteIfSafe(plugin);
        }
        return original(checking);
    };
    plugin.register(() => {
        command.checkCallback = original;
    });
}

// vim's ":w" saves through the CM5 vim adapter, NOT the core save command,
// so the wrapper above never sees it (verified live: handleEx("w") leaves
// editor:save-file uninvoked). Linter parity means ":w" must lint too.
let vimWriteHooked = false;

/**
 * Redefine vim's "write"/":w" ex command to route through the core save
 * command — the one path "Lint on save" already wraps. Behavior with the
 * toggle off is unchanged (the command just saves). The adapter only exists
 * while vim mode is on and it can be toggled anytime, so this is safe and
 * cheap to call repeatedly; the first call that finds the adapter wins.
 * The override deliberately survives plugin unload: it delegates to the
 * app's own save command, which is exactly what ":w" does anyway.
 */
export function installVimWriteHook(plugin: FootnotePlugin) {
    if (vimWriteHooked) return;
    const vim = (activeWindow as WindowWithVim).CodeMirrorAdapter?.Vim;
    if (!vim?.defineEx) return;
    const app = plugin.app as AppWithCommands;
    vim.defineEx("write", "w", () => {
        app.commands?.executeCommandById?.("editor:save-file");
    });
    vimWriteHooked = true;
}

// the last markdown file that held focus — sidebars and modals don't count,
// so flicking through them never looks like a file change
let lastFocused: { view: MarkdownView; file: TFile } | null = null;

/** Forget the focus tracking state (plugin unload). */
export function resetAutoLintTracking() {
    lastFocused = null;
}

/**
 * Feed active-leaf changes to "Lint on focused file change": when the
 * focused markdown FILE changes, the note the user just left gets linted.
 * Call on every active-leaf-change and once at layout-ready (to seed the
 * tracker with the note open at startup).
 */
export function noteActiveLeafForAutoLint(plugin: FootnotePlugin) {
    const current = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!current || !current.file) return;
    const previous = lastFocused;
    lastFocused = { view: current, file: current.file };
    if (!plugin.settings.lintOnFileChange) return;
    if (!previous || previous.file.path === current.file.path) return;
    if (footnotePopupBusy()) return; // its pending save owns that file
    void lintLeftNote(plugin, previous);
}

async function lintLeftNote(
    plugin: FootnotePlugin,
    previous: { view: MarkdownView; file: TFile },
) {
    const options = lintOptionsFromSettings(
        plugin,
        configuredSectionHeading(plugin),
    );
    // the note may still be open in another pane — there its (possibly
    // unsaved) editor buffer is the source of truth, not the file
    if (previous.view.file === previous.file && previous.view.editor) {
        const doc = previous.view.editor;
        if (activeTableCellEditor(doc)) return;
        const before = doc.getValue();
        const blocked = lintBlockedByPrefix(before);
        if (blocked) {
            new Notice(blocked);
            return;
        }
        const after = lintFootnotes(before, options);
        if (after === before) return;
        replaceMinimal(doc, before, after);
        new Notice(`Linted footnotes in "${previous.file.basename}".`);
        return;
    }
    // the leaf navigated away or closed — Obsidian has flushed the buffer,
    // so transform the file atomically on disk
    try {
        let changed = false;
        let blocked: string | null = null;
        await plugin.app.vault.process(previous.file, (data) => {
            blocked = lintBlockedByPrefix(data);
            if (blocked) return data;
            const after = lintFootnotes(data, options);
            changed = after !== data;
            return after;
        });
        if (blocked) {
            new Notice(blocked);
        } else if (changed) {
            new Notice(`Linted footnotes in "${previous.file.basename}".`);
        }
    } catch {
        // the file vanished between the switch and the lint — nothing to do
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
        // an invalid footnote-prefix cancels the lint outright — reindexing
        // would otherwise renumber the prefixed markers as plain ones
        const blocked = lintBlockedByPrefix(before);
        if (blocked) {
            new Notice(blocked);
            return;
        }
        const after = transform(before, configuredSectionHeading(plugin));
        if (after === before) {
            new Notice(notices.noop);
            return;
        }
        replaceMinimal(doc, before, after);
        new Notice(notices.done);
    });
}
