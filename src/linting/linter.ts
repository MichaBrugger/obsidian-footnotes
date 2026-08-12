import { Editor, MarkdownView, Notice } from "obsidian";

import type FootnotePlugin from "../main";
import {
    footnotePopupBusy,
    settleFootnotePopupWithFeedback,
    toggleCloseFootnotePopup,
} from "../footnote-popup";
import { jumpToFootnoteDefinition } from "../navigation";
import { footnotePrefix, footnotePrefixProblem } from "../footnote-prefix";
import { maskProtectedLines, normalizeEol, restoreEol } from "../markdown-scan";
import { AppWithCommands, AppWithPlugins, readingViewActive, viewEditor, WindowWithVim } from "../obsidian-internals";
import { activeTableCellEditor, nestedSubEditorOwnsFocus, runOutsideTableCell } from "../table-cursor";
import { applyFootnotePrefix } from "./rules/apply-footnote-prefix";
import { footnoteAfterPunctuation } from "./rules/footnote-after-punctuation";
import { moveFootnoteDefinitionsToBottom } from "./rules/move-footnotes-to-the-bottom";
import { reindexFootnotes, ReindexOptions } from "./rules/re-index-footnotes";
import {
    orphanedFootnoteDefinitionNames,
    removeOrphanedFootnoteDefinitions,
} from "./rules/remove-orphaned-definitions";
import {
    orphanedFootnoteReferenceNames,
    removeOrphanedFootnoteReferences,
} from "./rules/remove-orphaned-references";

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

/** The reindex policy the user picked in the settings tab. Orphaned-definition deletion is NOT reindex's job on the lint path anymore — the standalone rule handles it (2026-08-10), so reindex always keeps (and numbers) whatever orphans remain. */
function reindexOptionsFromSettings(
    plugin: FootnotePlugin,
): ReindexOptions {
    return {
        renumberNamedFootnotes: plugin.settings.renumberNamedFootnotes,
    };
}

/** The lint pipeline (steps + reindex policy) the user picked in the settings tab. `markdown` is the text about to be linted — its frontmatter names the bare-prefix placeholder orphan deletion must never touch. */
export function lintOptionsFromSettings(
    plugin: FootnotePlugin,
    sectionHeading: string,
    markdown: string,
): LintOptions {
    return {
        sectionHeading,
        fixPunctuation: plugin.settings.lintFixPunctuation,
        moveDefinitionsToBottom: plugin.settings.lintMoveToBottom,
        reindex: plugin.settings.lintReindex,
        reindexOptions: reindexOptionsFromSettings(plugin),
        removeOrphanedReferences: plugin.settings.lintDeleteOrphanedReferences,
        removeOrphanedDefinitions:
            plugin.settings.lintDeleteOrphanedDefinitions,
        orphanSafePrefix: orphanSafePrefixFor(plugin, markdown),
        applyNotePrefix:
            plugin.settings.enableFootnotePrefix &&
            plugin.settings.lintApplyPrefix,
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
    /** Delete references that have no definition anywhere in the note (default off; the caller gates on the "Delete orphaned references" setting). */
    removeOrphanedReferences?: boolean;
    /** Delete definitions nothing references, transitively (default off; the caller gates on the "Delete orphaned definitions" setting). Independent of `reindex`. */
    removeOrphanedDefinitions?: boolean;
    /** The note's own valid footnote-prefix while the prefix feature is on: its untouched "[^2.]" placeholder is an in-progress footnote, never an orphan to delete. */
    orphanSafePrefix?: string;
    /** Rename plain numbered AND named footnotes to carry the note's own footnote-prefix property, AND have reindex treat matching-prefixed footnotes as NUMBERED within that namespace (default off; the caller gates on settings). One flag on purpose: both behaviors ride the apply-prefix rule — renumbering within the namespace while nothing else was being prefixed felt inconsistent (Jason, 2026-08-08), so the separate `prefixAware` knob was folded in (2026-08-11). */
    applyNotePrefix?: boolean;
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
    // FIRST: definitions slated for deletion shouldn't be moved, prefixed,
    // or handed numbers by the rules below — and deleting orphaned
    // definitions can't orphan a live reference (a reference's presence is
    // exactly what keeps a definition alive). Reindex's own
    // keepOrphanedDefinitions:false deletion is hoisted here too (the two
    // routes share orphanedDefinitionBlocks, so they agree; reindex's
    // internal pass then finds nothing left): EVERY definition deletion
    // must precede the reference deletion below, whose refusal guard
    // judges definition geometry — a definition deleted after that
    // judgment flipped the verdict between passes (idempotence property,
    // 2026-08-10).
    const reindexDeletesOrphans =
        (options.reindex ?? true) &&
        options.reindexOptions?.keepOrphanedDefinitions === false;
    if (options.removeOrphanedDefinitions || reindexDeletesOrphans) {
        result = removeOrphanedFootnoteDefinitions(result);
    }
    if (options.fixPunctuation ?? true) {
        result = footnoteAfterPunctuation(result);
    }
    if (options.moveDefinitionsToBottom ?? true) {
        result = moveFootnoteDefinitionsToBottom(
            result,
            options.sectionHeading ?? "",
        );
    }
    // orphaned-REFERENCE deletion runs on the SETTLED layout — after the
    // deletions and moves above, before prefix/reindex hand out numbers.
    // Its classification-refusal guard (bug-orphan-delete-reclassifies)
    // judges the geometry of definitions around the reference, and both
    // definition deletion and move-to-bottom change that geometry: judged
    // any earlier, pass one can refuse a deletion pass two then performs
    // (caught twice by the idempotence property, 2026-08-10). Punctuation
    // may swap a doomed reference first — harmless, the deletion seam
    // heals to the same text. Everything downstream only renames or
    // permutes definitions among existing slots, which never changes
    // whether a definition sits above a reference, so the guard's verdict
    // is stable across passes.
    if (options.removeOrphanedReferences) {
        const beforeDeletion = result;
        result = removeOrphanedFootnoteReferences(
            result,
            options.orphanSafePrefix ?? "",
        );
        // a deleted reference can leave its line blank; where that blank
        // touches the moved definitions' seams, the NEXT pass's move would
        // collapse it — re-settle now so this pass's output is already the
        // fixed point (idempotence property, 2026-08-10)
        if (result !== beforeDeletion && (options.moveDefinitionsToBottom ?? true)) {
            result = moveFootnoteDefinitionsToBottom(
                result,
                options.sectionHeading ?? "",
            );
        }
    }
    // the note's own valid footnote-prefix, when the prefix behavior is on
    // (an invalid property changes nothing here — the lint guard cancels
    // those runs outright anyway)
    const notePrefix = options.applyNotePrefix ? footnotePrefix(result) : "";
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
            // reindex renumbers them within the namespace like plain ones.
            // validPrefix is "" unless applyNotePrefix is on — both prefix
            // behaviors ride the one flag
            prefix: validPrefix,
        });
    }
    // byte-identical no-op: restoring EOL onto an unchanged result would
    // normalize a mixed-EOL note and report a phantom lint (decided
    // 2026-08-10, spec-mixed-eol-noop-rewrite)
    return result === text ? markdown : restoreEol(result, eol);
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

/**
 * True when every lint step is toggled off — the pipeline is a no-op by
 * construction, and the command should say so instead of implying the note
 * was checked and found clean.
 */
export function lintRulesAllDisabled(plugin: FootnotePlugin): boolean {
    const s = plugin.settings;
    return (
        !s.lintFixPunctuation &&
        !s.lintMoveToBottom &&
        !s.lintReindex &&
        !(s.enableFootnotePrefix && s.lintApplyPrefix) &&
        // orphan DELETION is a transform; the alerts that replace it while
        // the toggles are off deliberately stay silent when every rule is off
        !s.lintDeleteOrphanedReferences &&
        !s.lintDeleteOrphanedDefinitions
    );
}

/**
 * Occurrences of unnamed footnote references outside code and frontmatter: the
 * abandoned empty "[^]", plus — when `prefix` is given — its prefix-era twin,
 * the untouched bare-prefix placeholder ("[^3.]" under prefix "3."). Both
 * are footnotes the user started and never named; the rules can't fix them
 * ("[^]" is invisible to the reference regexes, and a bare prefix is
 * indistinguishable from a deliberate name), so the lint paths alert
 * instead — the user should name or delete the fragment ASAP.
 */
export function countEmptyFootnoteReferences(
    markdown: string,
    prefix = "",
): number {
    const needles = prefix ? ["[^]", `[^${prefix}]`] : ["[^]"];
    // masking only ever REMOVES needle occurrences, so a raw miss is
    // definitive — this runs on every lint, and most notes have no "[^]"
    // (perf F4: skip the whole-document masking pass)
    if (!needles.some((needle) => markdown.includes(needle))) return 0;
    let count = 0;
    const lines = maskProtectedLines(normalizeEol(markdown).text.split("\n"));
    for (const line of lines) {
        for (const needle of needles) {
            for (
                let i = 0;
                (i = line.indexOf(needle, i)) !== -1;
                i += needle.length
            ) {
                count++;
            }
        }
    }
    return count;
}

/** The bare-prefix placeholder the alert should also count: the note's own valid prefix, only while the feature is on. */
function orphanSafePrefixFor(plugin: FootnotePlugin, markdown: string): string {
    if (!plugin.settings.enableFootnotePrefix) return "";
    const prefix = footnotePrefix(markdown);
    return prefix && footnotePrefixProblem(prefix) === null ? prefix : "";
}

function noticeEmptyReferences(plugin: FootnotePlugin, markdown: string) {
    const prefix = orphanSafePrefixFor(plugin, markdown);
    const count = countEmptyFootnoteReferences(markdown, prefix);
    if (count === 0) return;
    const hint = prefix ? `"[^]" or the bare prefix "[^${prefix}]"` : '"[^]"';
    new Notice(
        count === 1
            ? `This note has an unnamed footnote reference (${hint}). Give it a name or delete it.`
            : `This note has ${count} unnamed footnote references (${hint}). Give them names or delete them.`,
        8000,
    );
}

/** "[^a], [^b], …" — at most three names spelled out, an ellipsis for the rest. */
function referenceList(names: string[]): string {
    const shown = names.slice(0, 3).map((name) => `[^${name}]`).join(", ");
    return names.length > 3 ? `${shown}, …` : shown;
}

// the alert half of "Delete orphaned references": while the toggle is off,
// linting reports them instead — orphans are never silent
function noticeOrphanedReferences(plugin: FootnotePlugin, markdown: string) {
    if (plugin.settings.lintDeleteOrphanedReferences) return;
    const names = orphanedFootnoteReferenceNames(
        markdown,
        orphanSafePrefixFor(plugin, markdown),
    );
    if (names.length === 0) return;
    new Notice(
        names.length === 1
            ? `This note has a footnote reference with no definition (${referenceList(names)}). Write its definition or delete the reference.`
            : `This note has ${names.length} footnote references with no definition (${referenceList(names)}). Write their definitions or delete the references.`,
        8000,
    );
}

// kept orphaned definitions alert too (Jason, 2026-08-10) — every orphan
// kind is either deleted or surfaced, never silently preserved
function noticeOrphanedDefinitions(plugin: FootnotePlugin, markdown: string) {
    if (plugin.settings.lintDeleteOrphanedDefinitions) return;
    const names = orphanedFootnoteDefinitionNames(markdown);
    if (names.length === 0) return;
    new Notice(
        names.length === 1
            ? `This note has a footnote definition nothing references (${referenceList(names)}). Add its reference in the text or delete the definition.`
            : `This note has ${names.length} footnote definitions nothing references (${referenceList(names)}). Add their references in the text or delete the definitions.`,
        8000,
    );
}

// every lint entry point calls this with the POST-lint text, so the alerts
// fire whether or not the rules changed anything
function noticeLintAlerts(plugin: FootnotePlugin, markdown: string) {
    noticeEmptyReferences(plugin, markdown);
    noticeOrphanedReferences(plugin, markdown);
    noticeOrphanedDefinitions(plugin, markdown);
}

// ---------- automatic linting (Linter-style triggers) ----------

// A sub-editor (an actively edited table cell) owning focus means document
// edits race its sync-back (issue #28 family). The manual command defers
// around this state; the automatic triggers just skip — a save must never
// be delayed or destabilized by its lint. (Shared predicate:
// nestedSubEditorOwnsFocus in table-cursor.ts.)

/**
 * The alert blocking a lint of `markdown`, or null when linting may
 * proceed. A digit-ending footnote-prefix makes prefixed references
 * indistinguishable from plain numbers, so reindexing would collapse the
 * chapter namespace — the lint is refused until the property is fixed.
 */
export function lintBlockedByPrefix(markdown: string): string | null {
    const prefix = footnotePrefix(markdown);
    if (!prefix || footnotePrefixProblem(prefix) === null) return null;
    return `Linting canceled: this note's footnote-prefix ("${prefix}") is invalid. ${footnotePrefixProblem(prefix)}`;
}

// Stryker disable all: live-Obsidian integration (workspace views, the
// save-command wrapper, the vim adapter) — smoke-test territory the unit
// suite never reaches, so mutants here are unkillable noise by design
// (coverage-verified 2026-08-11).
// Lint the active note synchronously when it's safe to; the save hook calls
// this right before delegating, so the save writes the linted text.
function lintActiveNoteIfSafe(plugin: FootnotePlugin) {
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    // viewEditor: a deferred view has no editor despite the typings
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc) return;
    // Reading view: never edit the hidden buffer (2026-08-08)
    if (readingViewActive(mdView)) return;
    if (footnotePopupBusy()) return; // a pending popup save owns the file
    if (activeTableCellEditor(doc) || nestedSubEditorOwnsFocus(doc)) return;
    // same message as the Lint footnotes command: with every rule off the
    // pipeline is a no-op by construction, and "No linting needed." would
    // wrongly imply the note was checked and found clean (E34)
    if (lintRulesAllDisabled(plugin)) {
        new Notice(
            "All lint rules are turned off in the plugin settings, so there is nothing to lint.",
        );
        return;
    }
    const before = doc.getValue();
    const blocked = lintBlockedByPrefix(before);
    if (blocked) {
        new Notice(blocked, 8000);
        return;
    }
    const after = lintFootnotes(
        before,
        lintOptionsFromSettings(plugin, configuredSectionHeading(plugin), before),
    );
    // a manual save (Ctrl+S / vim :w) is an explicit user command, so it
    // reports its outcome either way — same as the Lint footnotes command
    // (Jason's call, 2026-08-08, revisiting an earlier quiet-on-clean
    // change); only the lint-on-footnote-creation trigger stays silent
    // when there is nothing to do
    if (after === before) {
        new Notice("No linting needed.");
    } else {
        replaceMinimal(doc, before, after);
        new Notice("Footnotes linted.");
    }
    noticeLintAlerts(plugin, after);
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
    const wrapped = (checking: boolean) => {
        // only lint while THIS plugin instance is still the registered one:
        // when reload timing stacks a stale wrapper inside a newer one's
        // chain, the identity-checked restore below rightly leaves it in
        // place — and without this gate the stale closure kept linting
        // with FROZEN settings forever (observed live 2026-08-10)
        const active = (plugin.app as AppWithPlugins).plugins?.plugins?.[
            "obsidian-footnotes"
        ];
        if (!checking && active === plugin && plugin.settings.lintOnSave) {
            lintActiveNoteIfSafe(plugin);
        }
        return original(checking);
    };
    command.checkCallback = wrapped;
    plugin.register(() => {
        // restore only OUR wrapper: another plugin may have wrapped the
        // command after us, and blindly writing `original` back would
        // silently strip its wrapper too (E30)
        if (command.checkCallback === wrapped) {
            command.checkCallback = original;
        }
    });
}

// vim's ":w" saves through the CM5 vim adapter, NOT the core save command,
// so the wrapper above never sees it (verified live: handleEx("w") leaves
// editor:save-file uninvoked). Linter parity means ":w" must lint too.
// Tracked by adapter IDENTITY, not a boolean: toggling vim off and on can
// build a fresh adapter that our defineEx never touched (E31).
let hookedVim: unknown = null;

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
    const vim = (activeWindow as WindowWithVim).CodeMirrorAdapter?.Vim;
    if (!vim?.defineEx || hookedVim === vim) return;
    const app = plugin.app as AppWithCommands;
    vim.defineEx("write", "w", () => {
        app.commands?.executeCommandById?.("editor:save-file");
    });
    hookedVim = vim;
}
// Stryker restore all

// masked-line shape of a footnote definition with NOTHING typed yet
const EmptyDefinitionLine = /^\[\^([^[\]]+)\]:[ \t]*$/;

// The name of the note's single empty definition ("[^x]: " with no content),
// or null when there are none or several. Linting a note right after a
// footnote was created can RENAME the new footnote (reindex swaps ids by
// appearance order), so the id alone can't relocate it — but the fresh
// definition is empty, and as long as it is the only empty one, it is
// unambiguously the footnote just created.
function uniqueEmptyDefinitionName(doc: Editor): string | null {
    const lines: string[] = [];
    for (let i = 0; i < doc.lineCount(); i++) lines.push(doc.getLine(i));
    let found: string | null = null;
    const masked = maskProtectedLines(lines);
    for (let i = 0; i < masked.length; i++) {
        const match = masked[i].match(EmptyDefinitionLine);
        if (!match) continue;
        if (found !== null) return null; // ambiguous
        // re-slice the original line: the name feeds jumpToFootnoteDefinition,
        // which compares RAW names (a code span in the name masks to NULs)
        found = lines[i].slice(2, 2 + match[1].length);
    }
    return found;
}

/**
 * "Lint on footnote creation" (replacing lint-on-focused-file-change,
 * 2026-08-05): lint the active note right after a new footnote definition was
 * created there. Quiet by design — a clean creation (the usual case) shows
 * no notice at all; only an actual cleanup announces itself, and it happens
 * in the note the user is LOOKING AT, unlike the old file-change trigger.
 *
 * The creation sites call this directly on the jump-to-definition path (and
 * `relandCursor` puts the caret back on the new — possibly renumbered —
 * empty definition afterwards). On the popup path they defer it through
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
    // viewEditor: a deferred view has no editor despite the typings
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc) return;
    // Reading view: never edit the hidden buffer (2026-08-08) — the popup
    // path defers this call, so the user may have flipped modes since the
    // footnote was created (no leaf change fires on a mode flip)
    if (readingViewActive(mdView)) return;
    // a deferred (popup-path) lint must not fire on some OTHER note the
    // user has since switched to
    if (expectedFilePath && mdView.file?.path !== expectedFilePath) return;
    if (footnotePopupBusy()) return;
    if (activeTableCellEditor(doc) || nestedSubEditorOwnsFocus(doc)) return;
    const before = doc.getValue();
    // silent on a blocked prefix: the insert path already explained it
    if (lintBlockedByPrefix(before)) return;
    const after = lintFootnotes(
        before,
        lintOptionsFromSettings(plugin, configuredSectionHeading(plugin), before),
    );
    if (after === before) {
        noticeLintAlerts(plugin, after);
        return;
    }
    replaceMinimal(doc, before, after);
    new Notice("Footnotes linted.");
    noticeLintAlerts(plugin, after);
    if (relandCursor) {
        const target = uniqueEmptyDefinitionName(doc);
        if (target !== null) {
            jumpToFootnoteDefinition(target, doc.getCursor(), plugin, doc);
        }
    }
}

// Stryker disable all: live-Obsidian integration (popup settling, active
// view, table-cell guard) — smoke-test territory, unreachable from units
// (coverage-verified 2026-08-11).
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
    // viewEditor: a deferred view has no editor despite the typings
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc) return;
    // Reading view: never edit the hidden buffer (2026-08-08)
    if (readingViewActive(mdView)) return;

    // same guard as the insert commands: never edit the document while a
    // table cell sub-editor owns focus — its sync-back rewrites its region
    // from pre-edit state (issue #28 family)
    runOutsideTableCell(doc, () => {
        const before = doc.getValue();
        // an invalid footnote-prefix cancels the lint outright — reindexing
        // would otherwise renumber the prefixed references as plain ones
        const blocked = lintBlockedByPrefix(before);
        if (blocked) {
            new Notice(blocked, 8000);
            return;
        }
        const after = transform(before, configuredSectionHeading(plugin));
        if (after === before) {
            new Notice(notices.noop);
        } else {
            replaceMinimal(doc, before, after);
            new Notice(notices.done);
        }
        noticeLintAlerts(plugin, after);
    });
}
