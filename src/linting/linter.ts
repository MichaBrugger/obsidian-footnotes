import { Editor, MarkdownView } from "obsidian";

import type FootnotePlugin from "../main";
import {
    footnotePopupBusy,
    settleFootnotePopupWithFeedback,
    toggleCloseFootnotePopup,
} from "../commands/footnote-popup";
import { jumpToFootnoteDefinition } from "../commands/navigation";
import { docContext } from "../editor/doc-context";
import { rewriteDocument } from "./rewrite-document";
import { definitionLabel, definitionLabelWithName } from "../parsing/footnote-grammar";
import { footnotePrefix, footnotePrefixProblem } from "../parsing/footnote-prefix";
import {
    findDefinitionBlocks,
} from "../parsing/markdown-scan";
import { AppWithCommands, AppWithPlugins, readingViewActive, viewEditor, WindowWithVim } from "../editor/obsidian-internals";
import { activeTableCellEditor, nestedSubEditorOwnsFocus, runOutsideTableCell } from "../editor/table-cursor";
import { applyFootnotePrefix } from "./rules/apply-footnote-prefix";
import { footnoteAfterPunctuation } from "./rules/footnote-after-punctuation";
import { moveFootnoteDefinitionsToBottom } from "./rules/move-footnotes-to-the-bottom";
import { reindexFootnotes, ReindexOptions } from "./rules/re-index-footnotes";
import { removeOrphanedFootnoteDefinitions } from "./rules/remove-orphaned-definitions";
import { removeOrphanedFootnoteReferences } from "./rules/remove-orphaned-references";
import { mergeDuplicateFootnoteDefinitions } from "./rules/merge-duplicate-definitions";
import { noticeLintAlerts, orphanSafePrefixFor } from "./lint-alerts";

import { invalidPrefixMessage, LintingCanceled, showNotice } from "../editor/notice";
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

/** The reindex policy the user picked in the settings tab. Orphaned-definition deletion is NOT reindex's job on the lint path anymore - the standalone rule handles it (2026-08-10), so reindex always keeps (and numbers) whatever orphans remain. */
function reindexOptionsFromSettings(
    plugin: FootnotePlugin,
): ReindexOptions {
    return {
        renumberNamedFootnotes: plugin.settings.renumberNamedFootnotes,
    };
}

/** The lint pipeline (steps + reindex policy) the user picked in the settings tab. `markdown` is the text about to be linted - its frontmatter names the bare-prefix placeholder orphan deletion must never touch. */
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
        mergeDuplicateDefinitions:
            plugin.settings.lintMergeDuplicateDefinitions,
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
    /** Merge later duplicate definitions into the first as continuation lines (default off; the caller gates on the "Merge duplicate definitions" setting). While off, the alerts report duplicates instead - Obsidian renders only the LAST definition (ground truth 2026-08-12). */
    mergeDuplicateDefinitions?: boolean;
    /** The note's own valid footnote-prefix while the prefix feature is on: its untouched "[^2.]" placeholder is an in-progress footnote, never an orphan to delete. */
    orphanSafePrefix?: string;
    /** Rename plain numbered AND named footnotes to carry the note's own footnote-prefix property, AND have reindex treat matching-prefixed footnotes as NUMBERED within that namespace (default off; the caller gates on settings). One flag on purpose: both behaviors ride the apply-prefix rule - renumbering within the namespace while nothing else was being prefixed felt inconsistent (Jason, 2026-08-08), so the separate `prefixAware` knob was folded in (2026-08-11). */
    applyNotePrefix?: boolean;
}

/** The enabled cleanups in dependency order: fix punctuation, gather definitions at the bottom, then renumber and reorder. */
export function lintFootnotes(
    markdown: string,
    options: LintOptions = {},
): string {
    // normalize once here so the composed steps all see LF and the note's
    // original endings are restored a single time on the way out
    return rewriteDocument(markdown, (text) => {
        let result = text;
        // duplicates merge FIRST of all: every rule below then sees one
        // definition block per name - orphan deletion judges one block, move
        // gathers one, reindex permutes one - and a second pass has no
        // duplicates left, so the pipeline stays idempotent
        if (options.mergeDuplicateDefinitions) {
            result = mergeDuplicateFootnoteDefinitions(result);
        }
        // definitions slated for deletion shouldn't be moved, prefixed,
        // or handed numbers by the rules below - and deleting orphaned
        // definitions can't orphan a live reference (a reference's presence is
        // exactly what keeps a definition alive). Reindex's own
        // keepOrphanedDefinitions:false deletion is hoisted here too (the two
        // routes share orphanedDefinitionBlocks, so they agree; reindex's
        // internal pass then finds nothing left): EVERY definition deletion
        // must precede the reference deletion below, whose refusal guard
        // judges definition geometry - a definition deleted after that
        // judgment flipped the verdict between passes (idempotence property,
        // 2026-08-10).
        // the settings tab never sets keepOrphanedDefinitions (the UI's
        // deletion route is removeOrphanedDefinitions), so this branch is
        // dead on every user path - it stays for PROGRAMMATIC callers of
        // lintFootnotes, the property suite among them, so that
        // reindexOptions keeps meaning what reindexFootnotes says it means
        // (review C6, 2026-09-09: documented rather than removed)
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
        // orphaned-REFERENCE deletion runs on the SETTLED layout - after the
        // deletions and moves above, before prefix/reindex hand out numbers.
        // Its classification-refusal guard (bug-orphan-delete-reclassifies)
        // judges the geometry of definitions around the reference, and both
        // definition deletion and move-to-bottom change that geometry: judged
        // any earlier, pass one can refuse a deletion pass two then performs
        // (caught twice by the idempotence property, 2026-08-10). Punctuation
        // may swap a doomed reference first - harmless, the deletion seam
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
            // collapse it - re-settle now so this pass's output is already the
            // fixed point (idempotence property, 2026-08-10)
            if (result !== beforeDeletion && (options.moveDefinitionsToBottom ?? true)) {
                result = moveFootnoteDefinitionsToBottom(
                    result,
                    options.sectionHeading ?? "",
                );
            }
        }
        // the note's own valid footnote-prefix, when the prefix behavior is on
        // (an invalid property changes nothing here - the lint guard cancels
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
            // reading order - one lint converges instead of needing a second pass
            result = applyFootnotePrefix(result, validPrefix);
        }
        if (options.reindex ?? true) {
            result = reindexFootnotes(result, {
                ...options.reindexOptions,
                // matching-prefixed footnotes are numbered footnotes (QOL):
                // reindex renumbers them within the namespace like plain ones.
                // validPrefix is "" unless applyNotePrefix is on - both prefix
                // behaviors ride the one flag
                prefix: validPrefix,
            });
        }
        return result;
    });
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
 * True when every lint step is toggled off - the pipeline is a no-op by
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
        // orphan DELETION and duplicate MERGING are transforms; the alerts
        // that replace them while the toggles are off deliberately stay
        // silent when every rule is off
        !s.lintDeleteOrphanedReferences &&
        !s.lintDeleteOrphanedDefinitions &&
        !s.lintMergeDuplicateDefinitions
    );
}

// ---------- automatic linting (Linter-style triggers) ----------

// A sub-editor (an actively edited table cell) owning focus means document
// edits race its sync-back (issue #28 family). The manual command defers
// around this state; the automatic triggers just skip - a save must never
// be delayed or destabilized by its lint. (Shared predicate:
// nestedSubEditorOwnsFocus in table-cursor.ts.)

/**
 * The alert blocking a lint of `markdown`, or null when linting may
 * proceed. A digit-ending footnote-prefix makes prefixed references
 * indistinguishable from plain numbers, so reindexing would collapse the
 * chapter namespace - the lint is refused until the property is fixed.
 */
export function lintBlockedByPrefix(markdown: string): string | null {
    const prefix = footnotePrefix(markdown);
    if (!prefix) return null;
    const problem = footnotePrefixProblem(prefix);
    if (problem === null) return null;
    return invalidPrefixMessage(LintingCanceled, prefix, problem);
}

/**
 * The automatic triggers' shared safety gate (lint-on-save and
 * lint-on-footnote-creation both used to spell it out): the active
 * markdown view and its editor, or null when linting must not touch the
 * document - no editable view (viewEditor: a deferred view has no
 * editor despite the typings), Reading view (never edit the hidden
 * buffer, 2026-08-08), a pending popup save owning the file, or a
 * table-cell / nested sub-editor owning focus (the issue-#28 corruption
 * family). Mutable territory: units reach it through
 * lintAfterFootnoteCreation (bug-reading-view-deferred-lint pins the
 * Reading-view bail).
 */
function safeLintTarget(
    plugin: FootnotePlugin,
): { mdView: MarkdownView; doc: Editor } | null {
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc) return null;
    if (readingViewActive(mdView)) return null;
    // Stryker disable next-line all: popup liveness is footnote-popup module
    // state only a live embedRegistry can set - smoke territory (2026-08-12)
    if (footnotePopupBusy()) return null;
    if (activeTableCellEditor(doc) || nestedSubEditorOwnsFocus(doc)) return null;
    return { mdView, doc };
}

// Stryker disable all: live-Obsidian integration (workspace views, the
// save-command wrapper, the vim adapter) - smoke-test territory the unit
// suite never reaches, so mutants here are unkillable noise by design
// (coverage-verified 2026-08-11).
// Lint the active note synchronously when it's safe to; the save hook calls
// this right before delegating, so the save writes the linted text.
function lintActiveNoteIfSafe(plugin: FootnotePlugin) {
    const target = safeLintTarget(plugin);
    if (!target) return;
    const doc = target.doc;
    // same message as the Lint footnotes command: with every rule off the
    // pipeline is a no-op by construction, and "No linting needed." would
    // wrongly imply the note was checked and found clean (E34)
    if (lintRulesAllDisabled(plugin)) {
        showNotice(
            "All lint rules are turned off in the plugin settings, so there is nothing to lint.",
        );
        return;
    }
    const before = doc.getValue();
    const blocked = lintBlockedByPrefix(before);
    if (blocked) {
        showNotice(blocked, 8000);
        return;
    }
    const after = lintFootnotes(
        before,
        lintOptionsFromSettings(plugin, configuredSectionHeading(plugin), before),
    );
    // a manual save (Ctrl+S / vim :w) is an explicit user command, so it
    // reports its outcome either way - same as the Lint footnotes command
    // (Jason's call, 2026-08-08, revisiting an earlier quiet-on-clean
    // change); only the lint-on-footnote-creation trigger stays silent
    // when there is nothing to do
    if (after === before) {
        showNotice("No linting needed.");
    } else {
        replaceMinimal(doc, before, after);
        showNotice("Footnotes linted.");
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
        // place - and without this gate the stale closure kept linting
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
 * command - the one path "Lint on save" already wraps. Behavior with the
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

// The name of the note's single empty definition ("[^x]: " with no content),
// or null when there are none or several. Linting a note right after a
// footnote was created can RENAME the new footnote (reindex swaps ids by
// appearance order), so the id alone can't relocate it - but the fresh
// definition is empty, and as long as it is the only empty one, it is
// unambiguously the footnote just created.
function uniqueEmptyDefinitionName(doc: Editor): string | null {
    const ctx = docContext(doc);
    const starts = ctx.definitionStarts();
    let found: string | null = null;
    for (let i = 0; i < ctx.lines.length; i++) {
        if (!starts[i]) continue;
        // the shared label reader (raw name re-sliced from the masked match:
        // a code span in the name masks to NULs, and the name feeds
        // jumpToFootnoteDefinition, which compares RAW names), then "nothing
        // typed after the label yet"
        const hit = definitionLabelWithName(ctx.lines[i], ctx.maskedLine(i));
        if (!hit || ctx.lines[i].slice(hit.label.labelEnd).trim() !== "") continue;
        // a blockquoted "> [^x]: " is a definition of its own, but never the
        // one this walk hunts for - the plugin only ever creates column-0
        // (or indented) definitions, and counting it would make the note
        // look ambiguous and strand the caret
        if (hit.label.quoted) continue;
        if (found !== null) return null; // ambiguous
        found = hit.name;
    }
    return found;
}

// The seeded twin of uniqueEmptyDefinitionName, for the selection
// conversions (A8 report, 2026-08-26): their fresh definition is never
// empty - it carries the converted text - so after a lint that may have
// renumbered AND moved it, the seeded body is what identifies the footnote
// just created. A definition matches when its whole block is exactly
// "[^name]: " plus the body (continuation lines included - the conversion
// wrote them, and the lint rules move and rename blocks without editing
// their bodies). Several matches are ambiguous, same as the empty twin.
function uniqueSeededDefinitionName(doc: Editor, body: string): string | null {
    const ctx = docContext(doc);
    const bodyLines = body.split("\n");
    let found: string | null = null;
    for (const block of findDefinitionBlocks(ctx.lines, ctx.scan)) {
        if (block.end - block.start !== bodyLines.length - 1) continue;
        const hit = definitionLabelWithName(
            ctx.lines[block.start],
            ctx.maskedLine(block.start),
        );
        if (!hit) continue;
        if (ctx.lines[block.start] !== `${definitionLabel(hit.name)} ${bodyLines[0]}`) {
            continue;
        }
        let same = true;
        for (let j = 1; j < bodyLines.length; j++) {
            if (ctx.lines[block.start + j] !== bodyLines[j]) {
                same = false;
                break;
            }
        }
        if (!same) continue;
        if (found !== null) return null; // ambiguous
        found = hit.name;
    }
    return found;
}

/**
 * "Lint on footnote creation" (replacing lint-on-focused-file-change,
 * 2026-08-05): lint the active note right after a new footnote definition was
 * created there. Quiet by design - a clean creation (the usual case) shows
 * no notice at all; only an actual cleanup announces itself, and it happens
 * in the note the user is LOOKING AT, unlike the old file-change trigger.
 *
 * Every definition-backed creation runs this synchronously as part of the
 * press: the jump arm right after landing (with `relandCursor` putting the
 * caret back on the new - possibly renumbered - definition: the unique
 * empty one, or with `seededBody` the unique definition carrying exactly
 * that body, which is how a selection conversion's pre-filled footnote is
 * found again after the lint moved or renumbered it - A8 report,
 * 2026-08-26), and the popup arm right BEFORE the popup opens (Jason's
 * ask 2026-08-27: the note must look linted the moment the popup appears,
 * not after it closes - the old settle-deferred lint left the text
 * visibly unlinted the whole time the popup was up). Linting before the
 * popup BINDS also retires the hazard the deferral existed for: the popup
 * opens on the post-lint id, which is why the relocated definition name is
 * RETURNED (null = the lint changed nothing, or the new definition could
 * not be identified unambiguously - the caller keeps its original id).
 * Table-cell creations skip the trigger entirely (editing the document
 * while a cell sub-editor owns focus is the issue #28 corruption family).
 */
export function lintAfterFootnoteCreation(
    plugin: FootnotePlugin,
    relandCursor: boolean,
    seededBody?: string,
): string | null {
    if (!plugin.settings.lintOnFootnoteCreation) return null;
    // the shared gate covers Reading view too - defense in depth: the
    // creation commands are already guarded, but this keeps a
    // programmatic caller from editing the hidden buffer
    const target = safeLintTarget(plugin);
    if (!target) return null;
    const doc = target.doc;
    const before = doc.getValue();
    // silent on a blocked prefix: the insert path already explained it
    if (lintBlockedByPrefix(before)) return null;
    const after = lintFootnotes(
        before,
        lintOptionsFromSettings(plugin, configuredSectionHeading(plugin), before),
    );
    if (after === before) {
        noticeLintAlerts(plugin, after);
        return null;
    }
    replaceMinimal(doc, before, after);
    showNotice("Footnotes linted.");
    noticeLintAlerts(plugin, after);
    const relocated =
        seededBody === undefined
            ? uniqueEmptyDefinitionName(doc)
            : uniqueSeededDefinitionName(doc, seededBody);
    if (relandCursor && relocated !== null) {
        jumpToFootnoteDefinition(relocated, doc.getCursor(), plugin, doc);
    }
    return relocated;
}

// Stryker disable all: live-Obsidian integration (popup settling, active
// view, table-cell guard) - smoke-test territory, unreachable from units
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
    // table cell sub-editor owns focus - its sync-back rewrites its region
    // from pre-edit state (issue #28 family)
    runOutsideTableCell(doc, () => {
        const before = doc.getValue();
        // an invalid footnote-prefix cancels the lint outright - reindexing
        // would otherwise renumber the prefixed references as plain ones
        const blocked = lintBlockedByPrefix(before);
        if (blocked) {
            showNotice(blocked, 8000);
            return;
        }
        const after = transform(before, configuredSectionHeading(plugin));
        if (after === before) {
            showNotice(notices.noop);
        } else {
            replaceMinimal(doc, before, after);
            showNotice(notices.done);
        }
        noticeLintAlerts(plugin, after);
    });
}
