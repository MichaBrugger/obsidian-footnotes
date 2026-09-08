import { Editor, EditorChange, EditorPosition, MarkdownView } from "obsidian";

import type FootnotePlugin from "../main";
import { ValidatedTextModal } from "./validated-text-modal";
import {
    footnoteNameProblem,
    occurrenceAtCursor,
    quotedReference,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { DocContext, docContext } from "../editor/doc-context";
import { footnotePrefixFromEditor, footnotePrefixProblem } from "../parsing/footnote-prefix";
import { simulateChanges } from "../editor/insertion-liveness";
import {
    definitionLabelIn,
    findDefinitionBlocks,
    maskedLineAt,
    scanDocument,
} from "../parsing/markdown-scan";
import { runOutsideTableCell } from "../editor/table-cursor";
import { withEditableEditor } from "./insert-or-navigate-footnotes";

import { nameAlreadyUsed, showNotice } from "../editor/notice";
// Renaming a footnote (issue #36, Jason's calls 2026-08-12): with the
// caret on a "[^name]" reference or a definition label, the Rename
// footnote command opens a modal prefilled with the current name and
// rewrites every masked-LIVE occurrence - references and definition
// labels, case-insensitively (Obsidian folds ids) - in one transaction.
// Copies inside code/math/comments are plain text and stay untouched. A
// name already in use refuses (merging two footnotes is the
// merge-duplicate-definitions lint's job, not a rename side effect), and
// the whole rename simulate-verifies before any edit: a new name can
// complete constructs around an occurrence exactly like an insertion can
// (the "$…$" swallow class), and then NOTHING is renamed.

export const RenameTargetNotice =
    "Place the cursor on a footnote reference or definition to rename it.";

/**
 * The footnote name under the caret - a live reference's name (definition
 * BODIES count: a reference inside one is renameable), or the name of the
 * definition label the caret sits inside - or null. Same raw-gate-then-
 * masked-confirm shape as the navigation guards.
 */
export function renameTargetAtCursor(
    doc: Editor,
    cursorPosition: EditorPosition,
    ctx: DocContext = docContext(doc),
): string | null {
    const lineText = doc.getLine(cursorPosition.line);
    if (!lineText.includes("[^")) return null;
    const occurrence = occurrenceAtCursor(
        referenceOccurrences(lineText, ctx.maskedLine(cursorPosition.line)),
        cursorPosition.ch,
    );
    if (occurrence !== null) return occurrence.name;
    // a definition label at column 0 - the caret anywhere before the end
    // of its ":" targets the definition's name
    const label = definitionLabelIn(lineText);
    if (!label || cursorPosition.ch >= label.labelEnd) return null;
    const maskedLabel = definitionLabelIn(ctx.maskedLine(cursorPosition.line));
    if (!maskedLabel) return null;
    return lineText.slice(label.nameStart, label.nameEnd);
}

export type RenamePlan =
    | {
          kind: "renamed";
          changes: EditorChange[];
          count: number;
          /** the name actually written - the typed one, or the typed one behind the note's prefix (see prefixAdded) */
          newName: string;
          /** the ARMED apply-prefix sweep would have re-prefixed the typed name on the next lint, so the rename applied the prefix itself (Jason's ruling 2026-08-29, replacing the 2026-08-25 refusal); the toast says so */
          prefixAdded: boolean;
      }
    | { kind: "noop" }
    | { kind: "invalid"; reason: string }
    | { kind: "collision" }
    | { kind: "dead" };

/**
 * The rename decision for `oldName` → `newName`: the changes to apply, or
 * why not. Pure planning - nothing is dispatched here.
 */
export function planFootnoteRename(
    doc: Editor,
    oldName: string,
    newName: string,
    ctx: DocContext = docContext(doc),
    options?: {
        /**
         * The note's footnote-prefix when the Apply-footnote-prefix
         * sweep is ARMED (prefix feature on + that lint rule on + a
         * valid prefix) - an out-of-namespace new name is then written
         * BEHIND the prefix (effectiveRenameName), because the very
         * next lint would rename it that way anyway; the 2026-08-25
         * hunt fix refused such names instead (bug-rename-swept-back-
         * by-apply-prefix), and Jason's ruling 2026-08-29 swapped the
         * refusal for doing the lint's work up front and saying so.
         * Callers with the sweep unarmed omit it; bare names stay legal
         * and durable.
         */
        sweepPrefix?: string;
    },
): RenamePlan {
    if (newName === oldName || newName === "") return { kind: "noop" };
    const problem = footnoteNameProblem(newName);
    if (problem !== null) return { kind: "invalid", reason: problem };
    const effective = effectiveRenameName(newName, options?.sweepPrefix);
    const prefixAdded = effective !== newName;
    newName = effective;
    if (newName === oldName) return { kind: "noop" };

    const oldFolded = oldName.toLowerCase();
    const newFolded = newName.toLowerCase();
    const blocks = findDefinitionBlocks(ctx.lines, ctx.scan.isProtected, ctx.scan);

    // collision: the new name already names ANOTHER footnote (any casing).
    // A case-only rename of the SAME footnote is fine - that's cosmetics.
    if (newFolded !== oldFolded) {
        const taken =
            blocks.some((block) => block.name.toLowerCase() === newFolded) ||
            ctx.lines.some(
                (lineText, line) =>
                    lineText.includes("[^") &&
                    referenceOccurrences(lineText, ctx.maskedLine(line)).some(
                        (occurrence) =>
                            occurrence.name.toLowerCase() === newFolded,
                    ),
            );
        if (taken) return { kind: "collision" };
    }

    const changes: EditorChange[] = [];
    const referenceLines = new Set<number>();
    for (let line = 0; line < ctx.lines.length; line++) {
        const lineText = ctx.lines[line];
        if (!lineText.includes("[^")) continue;
        for (const occurrence of referenceOccurrences(
            lineText,
            ctx.maskedLine(line),
        )) {
            if (occurrence.name.toLowerCase() !== oldFolded) continue;
            changes.push({
                from: { line, ch: occurrence.start + 2 },
                to: { line, ch: occurrence.end - 1 },
                text: newName,
            });
            referenceLines.add(line);
        }
    }
    for (const block of blocks) {
        if (block.name.toLowerCase() !== oldFolded) continue;
        const label = definitionLabelIn(ctx.lines[block.start]);
        if (!label) continue;
        changes.push({
            from: { line: block.start, ch: label.nameStart },
            to: { line: block.start, ch: label.nameEnd },
            text: newName,
        });
    }
    if (changes.length === 0) return { kind: "noop" };

    if (!renameSurvives(ctx, changes, oldFolded, newName, referenceLines, blocks)) {
        return { kind: "dead" };
    }
    return { kind: "renamed", changes, count: changes.length, newName, prefixAdded };
}

/**
 * The name a rename actually writes: the typed `newName`, or the typed
 * name behind the note's prefix when the apply-prefix sweep is armed
 * (`sweepPrefix` given) and the name doesn't already carry it in any
 * casing. Shared by the planner and the modal's messages so they never
 * disagree about which name is being talked about.
 */
function effectiveRenameName(
    newName: string,
    sweepPrefix: string | undefined,
): string {
    if (
        !sweepPrefix ||
        newName.toLowerCase().startsWith(sweepPrefix.toLowerCase())
    ) {
        return newName;
    }
    return `${sweepPrefix}${newName}`;
}

// Simulate the whole rename and require the document's footnote structure
// to be EXACTLY the old one with the name mapped: on every edited line the
// occurrence list (positions shift-adjusted for the length change) must
// match, and the definition blocks must keep their start lines and mapped
// names. Anything else means the new name reclassified text around an
// occurrence - refuse the whole rename rather than corrupt one copy.
function renameSurvives(
    ctx: DocContext,
    changes: EditorChange[],
    oldFolded: string,
    newName: string,
    referenceLines: Set<number>,
    blocksBefore: { start: number; name: string }[],
): boolean {
    const simulated = simulateChanges(ctx.lines, changes);
    for (const line of referenceLines) {
        const before = referenceOccurrences(ctx.lines[line], ctx.maskedLine(line));
        const expected: { start: number; name: string }[] = [];
        let shift = 0;
        for (const occurrence of before) {
            const renamed = occurrence.name.toLowerCase() === oldFolded;
            expected.push({
                start: occurrence.start + shift,
                name: renamed ? newName : occurrence.name,
            });
            if (renamed) shift += newName.length - occurrence.name.length;
        }
        const after = referenceOccurrences(
            simulated[line],
            maskedLineAt(simulated, line),
        );
        if (after.length !== expected.length) return false;
        for (let i = 0; i < expected.length; i++) {
            if (
                after[i].start !== expected[i].start ||
                after[i].name !== expected[i].name
            ) {
                return false;
            }
        }
    }
    const simulatedScan = scanDocument(simulated);
    const blocksAfter = findDefinitionBlocks(
        simulated,
        simulatedScan.isProtected,
        simulatedScan,
    );
    if (blocksAfter.length !== blocksBefore.length) return false;
    for (let i = 0; i < blocksBefore.length; i++) {
        const wanted =
            blocksBefore[i].name.toLowerCase() === oldFolded
                ? newName
                : blocksBefore[i].name;
        if (
            blocksAfter[i].start !== blocksBefore[i].start ||
            blocksAfter[i].name !== wanted
        ) {
            return false;
        }
    }
    return true;
}

/**
 * Add "Rename footnote" to the editor's right-click (and mobile
 * long-press) menu when the click landed on a reference or a definition
 * label - the same pattern as Obsidian's own "Rename this heading" on
 * heading lines (Jason's ask, 2026-08-13). Obsidian moves the caret to
 * the click point before firing editor-menu, so the caret resolution is
 * the command's own.
 */
export function registerRenameFootnoteMenu(plugin: FootnotePlugin) {
    plugin.registerEvent(
        plugin.app.workspace.on("editor-menu", (menu, editor, info) => {
            // markdown views only: a canvas card's editor would pass the
            // target check here while the command later resolves the
            // ACTIVE markdown view's editor instead
            if (!(info instanceof MarkdownView)) return;
            if (renameTargetAtCursor(editor, editor.getCursor()) === null) {
                return;
            }
            menu.addItem((item) =>
                item
                    .setTitle("Rename footnote")
                    .setIcon("footnote-rename")
                    .setSection("selection")
                    .onClick(() => {
                        void renameFootnote(plugin);
                    }),
            );
        }),
    );
}

/** The "Rename footnote" command: resolve the name under the caret, then hand off to the modal. */
export async function renameFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(
        plugin,
        (doc) => {
            runOutsideTableCell(doc, (cursorPosition) => {
                const target = renameTargetAtCursor(doc, cursorPosition);
                if (target === null) {
                    showNotice(RenameTargetNotice, 8000);
                    return;
                }
                new RenameFootnoteModal(plugin, doc, target).open();
            });
        },
        // focus in the Properties widget: there is no footnote under a
        // property field, and the editor's caret is stale - same answer
        // as a caret on plain prose
        RenameTargetNotice,
    );
}

// One text input prefilled with the current name; Enter (or the Rename
// button) applies. Invalid names, collisions, and names the simulation
// refuses show their reason inline and keep the modal open - same shape
// as the Set-footnote-prefix modal.
// Stryker disable all: modal DOM against the live app - smoke-test
// territory, unreachable from units (the whole prefix modal's FILE is
// excluded for the same reason; this one shares a file with the pure
// planners, so the exemption is scoped here). Coverage-verified by the
// 2026-08-12 incremental run: every mutant below was no-coverage.
class RenameFootnoteModal extends ValidatedTextModal {
    private plugin: FootnotePlugin;
    private doc: Editor;
    private oldName: string;

    constructor(plugin: FootnotePlugin, doc: Editor, oldName: string) {
        // with the sweep armed, only the SUFFIX is preselected: the prefix
        // visibly stays put, so typing the new name naturally keeps it
        // (Jason's consistency concern 2026-08-29) - deleting it anyway
        // still works, the plan adds it back and the toast says so
        const prefix = armedSweepPrefix(plugin, doc);
        super(plugin.app, {
            title: "Rename footnote",
            fieldName: "New name",
            fieldDesc: `Renames every "[^${oldName}]" reference and its definition in this note. Copies inside code or math stay untouched.`,
            buttonText: "Rename",
            initialValue: oldName,
            selectFrom:
                prefix && oldName.toLowerCase().startsWith(prefix.toLowerCase())
                    ? prefix.length
                    : undefined,
        });
        this.plugin = plugin;
        this.doc = doc;
        this.oldName = oldName;
    }

    protected submit() {
        const typed = this.value.trim();
        // read at submit time, like the plan itself: the frontmatter may
        // have changed while the modal was open
        const sweepPrefix = armedSweepPrefix(this.plugin, this.doc);
        const newName = effectiveRenameName(typed, sweepPrefix);
        // planned against the CURRENT document - the note may have changed
        // while the modal was open
        const plan = planFootnoteRename(this.doc, this.oldName, typed, undefined, {
            sweepPrefix,
        });
        switch (plan.kind) {
            case "noop":
                this.close();
                return;
            case "invalid":
                this.showProblem(plan.reason);
                return;
            case "collision":
                this.showProblem(
                    nameAlreadyUsed(newName),
                );
                return;
            case "dead":
                this.showProblem(
                    `${quotedReference(newName)} wouldn't survive as a footnote where it's used. Try a different name.`,
                );
                return;
            case "renamed":
                this.doc.transaction({ changes: plan.changes });
                this.close();
                showNotice(
                    `Renamed "[^${this.oldName}]" to "[^${plan.newName}]" in ${plan.count} ${plan.count === 1 ? "place" : "places"}.` +
                        (plan.prefixAdded
                            ? ` The note's prefix "${sweepPrefix}" was added.`
                            : ""),
                );
        }
    }
}

/** The note's prefix when the Apply-footnote-prefix sweep is armed (prefix feature on + that lint rule on + a valid note prefix) and would re-prefix a bare rename on the very next lint. Invalid prefixes don't arm: lint refuses to run under one (lintBlockedByPrefix). */
function armedSweepPrefix(plugin: FootnotePlugin, doc: Editor): string | undefined {
    if (!plugin.settings.enableFootnotePrefix || !plugin.settings.lintApplyPrefix) {
        return undefined;
    }
    const prefix = footnotePrefixFromEditor(doc);
    if (!prefix || footnotePrefixProblem(prefix) !== null) return undefined;
    return prefix;
}
