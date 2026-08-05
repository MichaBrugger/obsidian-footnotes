import { Editor, MarkdownView, Notice } from "obsidian";

import FootnotePlugin from "../main";
import {
    footnotePopupBusy,
    settleFootnotePopupWithFeedback,
    toggleCloseFootnotePopup,
} from "../footnote-popup";
import {
    footnotePrefix,
    footnotePrefixProblem,
    jumpToFootnoteDetail,
    runOutsideTableCell,
} from "../insert-or-navigate-footnotes";
import { maskProtectedLines, normalizeEol, restoreEol } from "../markdown-scan";
import { AppWithCommands, EditorWithCm, WindowWithVim } from "../obsidian-internals";
import { activeTableCellEditor } from "../table-cursor";
import { applyFootnotePrefix } from "./rules/apply-footnote-prefix";
import { footnoteAfterPunctuation } from "./rules/footnote-after-punctuation";
import { moveFootnoteDefinitionsToBottom } from "./rules/move-footnotes-to-the-bottom";
import { reindexFootnotes, ReindexOptions } from "./rules/re-index-footnotes";

// The whole-document footnote linter: each pure rule (see src/linting/rules/)
// gets a command, plus one "lint" command composing all three. This module
// owns the editor plumbing they share, the mapping from plugin settings to
// the rules' options, and the automatic-lint trigger machinery (lint on save
// and on footnote creation).

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
        // both gated on the whole per-note prefix feature being enabled
        applyNotePrefix:
            plugin.settings.enableFootnotePrefix &&
            plugin.settings.lintApplyPrefix,
        prefixAware: plugin.settings.enableFootnotePrefix,
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
    /** Rename plain numbered AND named footnotes to carry the note's own footnote-prefix property (default off; the caller gates on settings). */
    applyNotePrefix?: boolean;
    /** Treat footnotes matching the note's own footnote-prefix as NUMBERED — reindex renumbers them within the namespace like plain ones (default off; set when the per-note prefix feature is on). */
    prefixAware?: boolean;
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
    // the note's own valid footnote-prefix, when any prefix behavior is on
    // (an invalid property changes nothing here — the lint guard cancels
    // those runs outright anyway)
    const notePrefix =
        options.applyNotePrefix || options.prefixAware
            ? footnotePrefix(result)
            : "";
    const validPrefix =
        notePrefix && footnotePrefixProblem(notePrefix) === null
            ? notePrefix
            : "";
    if (options.applyNotePrefix && validPrefix) {
        // BEFORE reindex: strays adopt the prefix (plain numbers slot past
        // the existing maximum, names keep their name behind it), and the
        // prefix-aware reindex below then renumbers the WHOLE namespace by
        // reading order — one lint converges instead of needing a second pass
        result = applyFootnotePrefix(result, validPrefix);
    }
    if (options.reindex ?? true) {
        result = reindexFootnotes(result, {
            ...options.reindexOptions,
            // matching-prefixed footnotes are numbered footnotes (QOL):
            // reindex renumbers them within the namespace like plain ones
            prefix: options.prefixAware ? validPrefix : "",
        });
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
    if (after === before) {
        new Notice("No linting needed.");
        return;
    }
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

// masked-line shape of a footnote definition with NOTHING typed yet
const EmptyDetailLine = /^\[\^([^[\]]+)\]:[ \t]*$/;

// The name of the note's single empty detail ("[^x]: " with no content),
// or null when there are none or several. Linting a note right after a
// footnote was created can RENAME the new footnote (reindex swaps ids by
// appearance order), so the id alone can't relocate it — but the fresh
// detail is empty, and as long as it is the only empty one, it is
// unambiguously the footnote just created.
function uniqueEmptyDetailName(doc: Editor): string | null {
    const lines: string[] = [];
    for (let i = 0; i < doc.lineCount(); i++) lines.push(doc.getLine(i));
    let found: string | null = null;
    for (const line of maskProtectedLines(lines)) {
        const match = line.match(EmptyDetailLine);
        if (!match) continue;
        if (found !== null) return null; // ambiguous
        found = match[1];
    }
    return found;
}

/**
 * "Lint on footnote creation" (replacing lint-on-focused-file-change,
 * 2026-08-05): lint the active note right after a new footnote detail was
 * created there. Quiet by design — a clean creation (the usual case) shows
 * no notice at all; only an actual cleanup announces itself, and it happens
 * in the note the user is LOOKING AT, unlike the old file-change trigger.
 *
 * The creation sites call this directly on the jump-to-detail path (and
 * `relandCursor` puts the caret back on the new — possibly renumbered —
 * empty detail afterwards). On the popup path they defer it through
 * runAfterNextPopupSettle instead: linting under a live popup could
 * renumber the id the popup is bound to. Table-cell creations skip the
 * trigger entirely (editing the document while a cell sub-editor owns
 * focus is the issue #28 corruption family).
 */
export function lintAfterFootnoteCreation(
    plugin: FootnotePlugin,
    relandCursor: boolean,
    expectedFilePath?: string,
) {
    if (!plugin.settings.lintOnFootnoteCreation) return;
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView || !mdView.editor) return;
    // a deferred (popup-path) lint must not fire on some OTHER note the
    // user has since switched to
    if (expectedFilePath && mdView.file?.path !== expectedFilePath) return;
    if (footnotePopupBusy()) return;
    const doc = mdView.editor;
    if (activeTableCellEditor(doc) || subEditorOwnsFocus(doc)) return;
    const before = doc.getValue();
    // silent on a blocked prefix: the insert path already explained it
    if (lintBlockedByPrefix(before)) return;
    const after = lintFootnotes(
        before,
        lintOptionsFromSettings(plugin, configuredSectionHeading(plugin)),
    );
    if (after === before) return;
    replaceMinimal(doc, before, after);
    new Notice("Footnotes linted.");
    if (relandCursor) {
        const target = uniqueEmptyDetailName(doc);
        if (target !== null) {
            jumpToFootnoteDetail(target, doc.getCursor(), doc, plugin);
        }
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
