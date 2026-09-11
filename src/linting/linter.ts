import { Editor, MarkdownView } from "obsidian";

import type FootnotePlugin from "../main";
import {
    footnotePopupBusy,
    settleFootnotePopupWithFeedback,
    toggleCloseFootnotePopup,
} from "../commands/footnote-popup";
import { jumpToFootnoteDefinition } from "../commands/navigation";
import { docContext } from "../editor/doc-context";
import { lineDiffChanges, mapFoldLines } from "../editor/document-diff";
import { rewriteDocument } from "./rewrite-document";
import { definitionLabel, definitionLabelWithName } from "../parsing/footnote-grammar";
import { footnotePrefix, footnotePrefixProblem } from "../parsing/footnote-prefix";
import {
    findDefinitionBlocks,
} from "../parsing/markdown-scan";
import { AppWithCommands, AppWithPlugins, readingViewActive, viewEditor, WindowWithVim } from "../editor/obsidian-internals";
import { activeTableCellEditor, nestedSubEditorOwnsFocus, runOutsideTableCell } from "../editor/table-cursor";
// The pipeline calls each rule through its catalogue entry (rule.apply), not
// the bare function behind it. That gives the tests one seam per rule to
// watch, which is how test/lint-pipeline-order.test.ts checks that the order
// below matches the order the catalogue in ./rules/index.ts lists.
import { applyFootnotePrefixRule } from "./rules/apply-footnote-prefix";
import { fixLazyDefinitionsRule } from "./rules/fix-lazy-definitions";
import { footnoteAfterPunctuationRule } from "./rules/footnote-after-punctuation";
import { moveFootnotesToTheBottomRule } from "./rules/move-footnotes-to-the-bottom";
import { reIndexFootnotesRule, ReindexOptions } from "./rules/re-index-footnotes";
import { removeOrphanedDefinitionsRule } from "./rules/remove-orphaned-definitions";
import { removeOrphanedReferencesRule } from "./rules/remove-orphaned-references";
import { mergeDuplicateDefinitionsRule } from "./rules/merge-duplicate-definitions";
import { noticeLintAlerts, orphanSafePrefixFor } from "./lint-alerts";

import { invalidPrefixMessage, LintingCanceled, showNotice } from "../editor/notice";
// The lint: the pass that cleans up footnotes across a whole note.
//
// The actual cleanups live one folder down, in src/linting/rules/. Each of
// those is a pure function (text in, text out) and each gets its own
// command, plus one "lint" command composing all three.
//
// This file is the plumbing around them: talking to the editor, turning the
// user's settings into the options the rules take, and running the lint
// automatically when a trigger fires (on save, and on footnote creation).

function configuredSectionHeading(plugin: FootnotePlugin): string {
    return plugin.settings.enableFootnoteSectionHeading
        ? plugin.settings.footnoteSectionHeading
        : "";
}

/**
 * The reindex policy the user picked in the settings tab.
 *
 * Reindex no longer deletes orphaned definitions on the lint path; the
 * separate orphan rule does that job (ruling 2026-08-10). So reindex keeps
 * every orphaned definition that is still there, and numbers it like any
 * other.
 */
function reindexOptionsFromSettings(
    plugin: FootnotePlugin,
): ReindexOptions {
    return {
        renumberNamedFootnotes: plugin.settings.renumberNamedFootnotes,
    };
}

/**
 * The whole lint pipeline the user picked in the settings tab: which rules
 * run, plus the reindex policy.
 *
 * `markdown` is the text about to be linted. Its frontmatter carries the
 * note's prefix, which names the bare-prefix placeholder (a footnote the
 * user is still naming) that orphan deletion must never touch.
 */
export function lintOptionsFromSettings(
    plugin: FootnotePlugin,
    sectionHeading: string,
    markdown: string,
): LintOptions {
    return {
        sectionHeading,
        fixPunctuation: plugin.settings.lintFixPunctuation,
        fixLazyDefinitions: plugin.settings.lintFixLazyDefinitions,
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
    /**
     * Run fixLazyDefinitions (default on). A "[^x]:" line sitting directly
     * under a line of prose gets the blank line that turns it into a real
     * definition. When this is off, the lazy-definition lint alert reports
     * such lines instead of fixing them.
     */
    fixLazyDefinitions?: boolean;
    /** Run moveFootnoteDefinitionsToBottom (default on). */
    moveDefinitionsToBottom?: boolean;
    /** Run reindexFootnotes (default on). */
    reindex?: boolean;
    /** Passed through to reindexFootnotes. */
    reindexOptions?: ReindexOptions;
    /**
     * Delete orphaned references: references with no definition anywhere in
     * the note (default off; the caller turns it on from the "Delete
     * orphaned references" setting).
     */
    removeOrphanedReferences?: boolean;
    /**
     * Delete orphaned definitions: definitions nothing references (default
     * off; the caller turns it on from the "Delete orphaned definitions"
     * setting). It works transitively, so deleting one definition can orphan
     * another, which then goes too. Nothing to do with `reindex`.
     */
    removeOrphanedDefinitions?: boolean;
    /**
     * When one name has several definitions, fold the later ones into the
     * first as continuation lines (default off; the caller turns it on from
     * the "Merge duplicate definitions" setting). While it is off, the lint
     * alerts report duplicates instead. Worth knowing: Obsidian renders only
     * the LAST definition of a name (ground truth 2026-08-12).
     */
    mergeDuplicateDefinitions?: boolean;
    /**
     * The note's own footnote-prefix, when the prefix feature is on and the
     * prefix is valid. A bare "[^2.]" placeholder is a footnote the user is
     * still typing a name for, so orphan deletion must leave it alone.
     */
    orphanSafePrefix?: string;
    /**
     * Two behaviors on one flag (default off; the caller turns it on from
     * the settings). First, rename footnotes - plain numbered ones AND named
     * ones - so they carry the note's own footnote-prefix property. Second,
     * have reindex treat footnotes that already match the prefix as NUMBERED
     * inside that namespace.
     *
     * They share a flag on purpose. Renumbering inside the namespace while
     * nothing else was being prefixed felt inconsistent (Jason, 2026-08-08),
     * so the separate `prefixAware` knob was folded into this one
     * (2026-08-11). Both behaviors ride the apply-prefix rule.
     */
    applyNotePrefix?: boolean;
}

/**
 * Run the enabled cleanups, in the order they depend on each other: fix
 * punctuation, gather the definitions at the bottom, then renumber them and
 * put them in matching order.
 */
export function lintFootnotes(
    markdown: string,
    options: LintOptions = {},
): string {
    // Notes can use any line endings. rewriteDocument converts them to plain
    // LF once here, so every step below sees the same thing, and puts the
    // note's original endings back once on the way out.
    return rewriteDocument(markdown, (text) => {
        let result = text;
        // Hidden definitions come FIRST of all. A "[^x]:" line directly
        // under a line of prose is not a definition to Obsidian; it is more
        // paragraph text (a "lazy label") until a blank line separates them.
        // Every rule below - the duplicate merge, both orphan rules, the
        // move, prefixing, reindex - must judge the definition the user
        // meant, not the prose line Obsidian sees. (Ruling: Jason,
        // 2026-09-09.)
        if (options.fixLazyDefinitions ?? true) {
            result = fixLazyDefinitionsRule.apply(result);
        }
        // Duplicates merge next, so every rule below sees exactly one
        // definition block per name: orphan deletion judges one block, the
        // move gathers one, reindex reorders one. It also means a second run
        // of the lint finds no duplicates left, which is what keeps running
        // the lint twice from changing anything the second time.
        if (options.mergeDuplicateDefinitions) {
            result = mergeDuplicateDefinitionsRule.apply(result);
        }
        // Orphaned definitions go next, before the rules that move, prefix,
        // and number things: there is no point doing any of that to a
        // definition that is about to be deleted. Deleting an orphaned
        // definition can never orphan a live reference, because a reference
        // pointing at a definition is exactly what keeps that definition
        // alive.
        //
        // Reindex has its own orphan deletion (keepOrphanedDefinitions:
        // false); it is hoisted up to here as well. Both routes call the
        // same orphanedDefinitionBlocks, so they always agree, and reindex's
        // own pass later finds nothing left to do.
        //
        // The order matters: EVERY definition deletion has to happen before
        // the reference deletion further down. That rule looks at where the
        // definitions sit before it decides whether to refuse a deletion, so
        // a definition deleted after it looked would flip its verdict on the
        // next run. (Caught by the idempotence property, 2026-08-10.)
        //
        // One more thing about keepOrphanedDefinitions: the settings tab
        // never sets it, because the user-facing route is
        // removeOrphanedDefinitions. So the branch is dead on every path a
        // user can take. It stays for code that calls lintFootnotes
        // directly, the property test suite among it, so that reindexOptions
        // keeps meaning what reindexFootnotes says it means. (Review C6,
        // 2026-09-09: documented rather than removed.)
        const reindexDeletesOrphans =
            (options.reindex ?? true) &&
            options.reindexOptions?.keepOrphanedDefinitions === false;
        if (options.removeOrphanedDefinitions || reindexDeletesOrphans) {
            result = removeOrphanedDefinitionsRule.apply(result);
        }
        if (options.fixPunctuation ?? true) {
            result = footnoteAfterPunctuationRule.apply(result);
        }
        if (options.moveDefinitionsToBottom ?? true) {
            result = moveFootnotesToTheBottomRule.apply(
                result,
                options.sectionHeading ?? "",
            );
        }
        // Orphaned REFERENCE deletion runs once the layout has settled:
        // after the deletions and moves above, and before prefixing and
        // reindex start handing out numbers.
        //
        // Why here and nowhere else: this rule has a guard that refuses a
        // deletion when removing the reference would change how Obsidian
        // reads the lines around it (the bug-orphan-delete-reclassifies
        // guard). That guard looks at where the definitions sit relative to
        // the reference, and both definition deletion and move-to-bottom
        // shift them. Run any earlier, the first pass could refuse a
        // deletion that a second pass then goes ahead and makes. (The
        // idempotence property caught exactly that, twice, 2026-08-10.)
        //
        // The punctuation rule running before this is harmless: it may move
        // a reference that is about to be deleted anyway, and the text left
        // behind after the deletion comes out the same either way. Nothing
        // downstream matters either, because prefixing and reindex only
        // rename definitions or shuffle them between slots that already
        // exist. Neither can change whether a definition sits above a
        // reference, so the guard's verdict stays the same on every pass.
        if (options.removeOrphanedReferences) {
            const beforeDeletion = result;
            result = removeOrphanedReferencesRule.apply(result, {
                orphanSafePrefix: options.orphanSafePrefix,
            });
            // Deleting a reference can leave its line empty. If that empty
            // line lands where the moved definitions were joined on, the
            // NEXT run of the move would collapse it, so this run's output
            // would not match the next one's. Run the move again now, so
            // this run already produces the final text. (Idempotence
            // property, 2026-08-10.)
            if (result !== beforeDeletion && (options.moveDefinitionsToBottom ?? true)) {
                result = moveFootnotesToTheBottomRule.apply(
                    result,
                    options.sectionHeading ?? "",
                );
            }
        }
        // The note's own footnote-prefix, when the prefix behavior is on and
        // the prefix is valid. An invalid one changes nothing here, since
        // the lint guard cancels those runs before they get this far.
        const notePrefix = options.applyNotePrefix ? footnotePrefix(result) : "";
        const validPrefix =
            notePrefix && footnotePrefixProblem(notePrefix) === null
                ? notePrefix
                : "";
        if (options.applyNotePrefix && validPrefix) {
            // This runs BEFORE reindex on purpose. Footnotes that do not
            // carry the prefix yet adopt it here: a plain number is given
            // the next free slot past the current highest, and a named
            // footnote keeps its name behind the prefix. Reindex then
            // renumbers the whole namespace in reading order. Doing it this
            // way round means one lint settles the note; the other order
            // would need a second pass.
            result = applyFootnotePrefixRule.apply(result, { prefix: validPrefix });
        }
        if (options.reindex ?? true) {
            result = reIndexFootnotesRule.apply(result, {
                ...options.reindexOptions,
                // A footnote that carries this note's prefix counts as a numbered
                // footnote too: reindex renumbers "2-1", "2-2", "2-3" inside their
                // own prefix namespace, the same way it renumbers plain "1", "2",
                // "3". This is a quality-of-life choice. validPrefix is the empty
                // string unless the apply-prefix rule is on, so one flag drives
                // both prefix behaviours.
                prefix: validPrefix,
            });
        }
        return result;
    });
}

// Rewrite only the lines that actually changed, as separate edits in one
// transaction. Untouched lines are never rewritten, so a fold on them
// stays folded and a caret in them stays put. (It used to be one edit from
// the first changed character to the last, which unfolded everything in
// between and pushed a caret inside the span to its start: Jason's report,
// sheet 20, 2026-09-11.) The edits are worked out by lineDiffChanges; all
// of them are positions in the text BEFORE the rewrite, which is what a
// transaction expects.
function replaceMinimal(doc: Editor, before: string, after: string, mdView?: MarkdownView) {
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

/**
 * True when the user has turned every lint rule off.
 *
 * With nothing enabled the lint cannot change anything, so the command says
 * that plainly. Reporting "nothing to fix" would wrongly suggest the note
 * had been checked and come back clean.
 */
export function lintRulesAllDisabled(plugin: FootnotePlugin): boolean {
    const s = plugin.settings;
    return (
        !s.lintFixPunctuation &&
        !s.lintFixLazyDefinitions &&
        !s.lintMoveToBottom &&
        !s.lintReindex &&
        !(s.enableFootnotePrefix && s.lintApplyPrefix) &&
        // Deleting orphans and merging duplicates are rules that change the
        // note, so they count here. The lint alerts that speak in their place
        // while those toggles are off do not count: when every rule is off,
        // lint is off, and the alerts deliberately stay silent too.
        !s.lintDeleteOrphanedReferences &&
        !s.lintDeleteOrphanedDefinitions &&
        !s.lintMergeDuplicateDefinitions
    );
}

// ---------- automatic linting (Linter-style triggers) ----------

// When a table cell is being edited it runs its own little sub-editor, and
// while that has focus any edit to the document races the cell writing its
// text back (the issue #28 corruption family).
//
// The manual lint command waits for that state to pass. The automatic
// triggers simply skip instead: a save must never be delayed or made
// unreliable by the lint attached to it. (The shared check is
// nestedSubEditorOwnsFocus in table-cursor.ts.)

/**
 * The message explaining why `markdown` cannot be linted, or null when the
 * lint may go ahead.
 *
 * There is one such case: a footnote-prefix ending in a digit. With a prefix
 * like that, a prefixed reference is impossible to tell apart from a plain
 * number, so reindex would fold the whole chapter namespace back into the
 * ordinary numbers. The lint refuses to run until the property is fixed.
 */
export function lintBlockedByPrefix(markdown: string): string | null {
    const prefix = footnotePrefix(markdown);
    if (!prefix) return null;
    const problem = footnotePrefixProblem(prefix);
    if (problem === null) return null;
    return invalidPrefixMessage(LintingCanceled, prefix, problem);
}

/**
 * The safety check both automatic triggers share (lint-on-save and
 * lint-on-footnote-creation each used to spell it out separately). It
 * returns the active markdown view and its editor, or null when the lint
 * must not touch the document.
 *
 * The four reasons to say no:
 *
 * - There is no editable view. viewEditor is used because a deferred view
 *   has no editor, despite what the type definitions claim.
 * - Reading view is showing: never edit the hidden buffer behind it
 *   (2026-08-08).
 * - The popup has a save in flight and owns the file.
 * - A table cell or other nested sub-editor has focus (the issue #28
 *   corruption family).
 *
 * Unlike the live-Obsidian code further down, this function is covered by
 * mutation testing: the unit tests reach it through
 * lintAfterFootnoteCreation, and bug-reading-view-deferred-lint pins the
 * Reading-view refusal.
 */
function safeLintTarget(
    plugin: FootnotePlugin,
): { mdView: MarkdownView; doc: Editor } | null {
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc) return null;
    if (readingViewActive(mdView)) return null;
    // Stryker disable next-line all: whether the popup is busy lives in the
    // footnote-popup module, and only a real running embedRegistry can set
    // it, so only the smoke tests can reach this line (2026-08-12)
    if (footnotePopupBusy()) return null;
    if (activeTableCellEditor(doc) || nestedSubEditorOwnsFocus(doc)) return null;
    return { mdView, doc };
}

// Stryker disable all: everything below plugs straight into a running
// Obsidian (workspace views, the save-command wrapper, the vim adapter).
// Only the smoke tests can reach it, so mutation testing here would report
// nothing but noise by design (coverage-verified 2026-08-11).

// Lint the note the user is in, right now, if that is safe. The save hook
// calls this just before handing off to Obsidian's own save, so what gets
// written to disk is the linted text.
function lintActiveNoteIfSafe(plugin: FootnotePlugin) {
    const target = safeLintTarget(plugin);
    if (!target) return;
    const doc = target.doc;
    // Same message the Lint footnotes command shows. With every rule off
    // the lint cannot change anything, and "No linting needed." would
    // wrongly imply the note had been checked and found clean (E34).
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
    // A manual save (Ctrl+S, or vim's ":w") is something you asked for, so
    // it tells you the outcome either way, just like the Lint footnotes
    // command does. (Jason's call, 2026-08-08, reversing an earlier change
    // that stayed quiet when the note was already clean.) Only the
    // lint-on-footnote-creation trigger says nothing when there was nothing
    // to do.
    if (after === before) {
        showNotice("No linting needed.");
    } else {
        replaceMinimal(doc, before, after);
        showNotice("Footnotes linted.");
    }
    noticeLintAlerts(plugin, after);
}

/**
 * Wrap Obsidian's own save command so "Lint on save" runs just before the
 * file is written.
 *
 * `app.commands` is private API, not part of what Obsidian promises plugins.
 * If its shape ever changes, this quietly does nothing and the user is back
 * to linting by hand. The original callback is put back when the plugin
 * unloads.
 */
export function installLintOnSave(plugin: FootnotePlugin) {
    const command = (plugin.app as AppWithCommands).commands?.commands?.[
        "editor:save-file"
    ];
    if (!command || typeof command.checkCallback !== "function") return;
    const original = command.checkCallback;
    const wrapped = (checking: boolean) => {
        // Only lint while THIS copy of the plugin is still the one Obsidian
        // has loaded. Reloading the plugin can leave an old wrapper buried
        // inside a newer one's chain, and the restore below correctly
        // refuses to unpick someone else's wrapper, so the old one stays.
        // Without this check that old wrapper kept linting forever, using
        // the settings frozen at the moment it was made (observed live,
        // 2026-08-10).
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
        // Put the original back only if OUR wrapper is still the outermost
        // one. Another plugin may have wrapped the same command after us,
        // and writing `original` back regardless would throw that plugin's
        // wrapper away without a word (E30).
        if (command.checkCallback === wrapped) {
            command.checkCallback = original;
        }
    });
}

// In vim mode, ":w" saves through vim's own adapter and never goes near
// Obsidian's save command, so the wrapper above never sees it (verified
// live: calling handleEx("w") leaves editor:save-file uninvoked). ":w" is a
// save like any other, so it has to lint too.
//
// What is remembered here is the adapter object itself, not a yes/no flag.
// Turning vim mode off and on again can build a brand new adapter that our
// defineEx never touched, and a flag would wrongly say it was done (E31).
let hookedVim: unknown = null;

/**
 * Redefine vim's "write" / ":w" command so it goes through Obsidian's own
 * save command instead, which is the path "Lint on save" already wraps.
 *
 * With the toggle off nothing changes for the user: ":w" still just saves.
 * The vim adapter only exists while vim mode is on, and the user can toggle
 * that at any moment, so this is cheap and safe to call over and over; the
 * first call that finds an adapter is the one that takes effect.
 *
 * The override deliberately outlives the plugin: all it does is call the
 * app's own save command, which is what ":w" was going to do anyway.
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

// The name of the note's one and only empty definition ("[^x]: " with
// nothing after it), or null when there are none or more than one.
//
// Why look for it that way: linting a note right after a footnote was
// created can rename that footnote, because reindex hands out names by
// order of appearance. So the name it had a moment ago is no help in
// finding it again. What is reliable is that the brand new definition is
// empty, and as long as it is the only empty one in the note, it can only
// be the footnote just created.
function uniqueEmptyDefinitionName(doc: Editor): string | null {
    const ctx = docContext(doc);
    const starts = ctx.definitionStarts();
    let found: string | null = null;
    for (let i = 0; i < ctx.lines.length; i++) {
        if (!starts[i]) continue;
        // The shared label reader. It finds the label against the masked
        // twin (the copy of the note with protected text blanked out) but
        // cuts the name from the raw line, because a code span inside a name
        // is blanked to NUL characters in the twin. The name then goes to
        // jumpToFootnoteDefinition, which compares raw names. After that,
        // check that nothing has been typed after the label yet.
        const hit = definitionLabelWithName(ctx.lines[i], ctx.maskedLine(i));
        if (!hit || ctx.lines[i].slice(hit.label.labelEnd).trim() !== "") continue;
        // A "> [^x]: " inside a blockquote is a real definition, but it can
        // never be the one being hunted here: the plugin only ever creates
        // definitions at the left margin (or indented). Counting it would
        // make the note look ambiguous, and the caret would be left
        // stranded.
        if (hit.label.quoted) continue;
        if (found !== null) return null; // ambiguous
        found = hit.name;
    }
    return found;
}

// The same idea as uniqueEmptyDefinitionName, but for conversions: turning
// selected text into a footnote (A8 report, 2026-08-26).
//
// A conversion's new definition is never empty, since it holds the text
// that was selected. So after a lint that may have both renumbered and
// moved it, that body text is what identifies it.
//
// A definition matches when its whole definition block is exactly
// "[^name]: " plus the body, continuation lines and all. That works because
// the conversion wrote those lines itself, and the lint rules only move and
// rename definition blocks; they never edit the text inside one. More than
// one match is ambiguous, exactly as with the empty version above.
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
 * The "Lint on footnote creation" trigger: lint the note the user is in,
 * right after a new footnote definition was made there. It replaced the old
 * lint-on-focused-file-change trigger (2026-08-05).
 *
 * It is quiet on purpose. A creation that needed no cleanup, which is the
 * usual case, shows no notice at all; only real changes announce
 * themselves. And they happen in the note the user is LOOKING AT, which the
 * old file-change trigger could not promise.
 *
 * Every creation that makes a definition runs this as part of the press
 * itself, not later. There are two arms:
 *
 * The jump arm runs right after the caret lands. With `relandCursor` set,
 * the caret is put back on the new definition even if the lint renumbered
 * or moved it. It is found again as the note's only empty definition, or,
 * when `seededBody` is given, as the only definition holding exactly that
 * text. That second route is how a conversion's pre-filled footnote is
 * found again (A8 report, 2026-08-26).
 *
 * The popup arm runs right BEFORE the popup opens. Jason asked for that on
 * 2026-08-27: the note must already look linted the moment the popup
 * appears. The old version waited for the popup to settle, which left the
 * text visibly unlinted for as long as the popup was up.
 *
 * Linting before the popup binds also removes the danger the waiting was
 * there to avoid, because the popup now opens on the name the footnote has
 * AFTER the lint. That is why this function RETURNS that name. Null means
 * either that the lint changed nothing, or that the new definition could
 * not be picked out for certain; either way the caller keeps the name it
 * started with.
 *
 * Creations inside a table cell skip this trigger completely: editing the
 * document while a cell's sub-editor has focus is the issue #28 corruption
 * family.
 */
export function lintAfterFootnoteCreation(
    plugin: FootnotePlugin,
    relandCursor: boolean,
    seededBody?: string,
): string | null {
    if (!plugin.settings.lintOnFootnoteCreation) return null;
    // The shared safety check covers Reading view as well. That is belt and
    // braces: the creation commands already refuse it, but this also stops
    // code calling in directly from editing the hidden buffer.
    const target = safeLintTarget(plugin);
    if (!target) return null;
    const doc = target.doc;
    const before = doc.getValue();
    // Say nothing when a bad prefix blocks the lint. The insert that just
    // happened has already told the user about it.
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

// Stryker disable all: this too plugs straight into a running Obsidian
// (waiting for the popup to settle, the active view, the table-cell guard).
// The unit tests cannot reach it; only the smoke tests can
// (coverage-verified 2026-08-11).
export async function runFootnoteTransformCommand(
    plugin: FootnotePlugin,
    transform: (markdown: string, sectionHeading: string) => string,
    notices: { done: string; noop: string },
) {
    // An open popup, or one that has just closed and still has a save in
    // flight, would write over a whole-document edit. So: wait for any save
    // already running, close the popup, then wait for the save that closing
    // it starts.
    await settleFootnotePopupWithFeedback();
    toggleCloseFootnotePopup();
    await settleFootnotePopupWithFeedback();

    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    // viewEditor is used because a deferred view has no editor, whatever
    // the type definitions say
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc) return;
    // In Reading view, never edit the hidden buffer behind it (2026-08-08)
    if (readingViewActive(mdView)) return;

    // The same guard the insert commands use: never edit the document while
    // a table cell's sub-editor has focus. When that cell writes its text
    // back, it does so from the state it saw before the edit, which
    // overwrites its part of the note (issue #28 family).
    runOutsideTableCell(doc, () => {
        const before = doc.getValue();
        // An invalid footnote-prefix cancels the lint outright. Left to
        // run, reindex would treat the prefixed references as plain
        // numbers and renumber them.
        const blocked = lintBlockedByPrefix(before);
        if (blocked) {
            showNotice(blocked, 8000);
            return;
        }
        const after = transform(before, configuredSectionHeading(plugin));
        if (after === before) {
            showNotice(notices.noop);
        } else {
            replaceMinimal(doc, before, after, mdView);
            showNotice(notices.done);
        }
        noticeLintAlerts(plugin, after);
    });
}
