import { Editor, EditorChange, EditorPosition, Modal, Notice, Setting } from "obsidian";

import type FootnotePlugin from "../main";
import {
    isValidFootnoteName,
    occurrenceAtCursor,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { DocContext, docContext } from "../editor/doc-context";
import { simulateChanges } from "../editor/insertion-liveness";
import {
    definitionLabelIn,
    findDefinitionBlocks,
    maskedLineAt,
    scanDocument,
} from "../parsing/markdown-scan";
import { runOutsideTableCell } from "../editor/table-cursor";
import { withEditableEditor } from "./insert-or-navigate-footnotes";

// Renaming a footnote (issue #36, Jason's calls 2026-08-12): with the
// caret on a "[^name]" reference or a definition label, the Rename
// footnote command opens a modal prefilled with the current name and
// rewrites every masked-LIVE occurrence — references and definition
// labels, case-insensitively (Obsidian folds ids) — in one transaction.
// Copies inside code/math/comments are plain text and stay untouched. A
// name already in use refuses (merging two footnotes is the
// merge-duplicate-definitions lint's job, not a rename side effect), and
// the whole rename simulate-verifies before any edit: a new name can
// complete constructs around an occurrence exactly like an insertion can
// (the "$…$" swallow class), and then NOTHING is renamed.

export const RenameTargetNotice =
    "Place the cursor on a footnote reference or definition to rename it.";

/**
 * The footnote name under the caret — a live reference's name (definition
 * BODIES count: a reference inside one is renameable), or the name of the
 * definition label the caret sits inside — or null. Same raw-gate-then-
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
    // a definition label at column 0 — the caret anywhere before the end
    // of its ":" targets the definition's name
    const label = definitionLabelIn(lineText);
    if (!label || cursorPosition.ch >= label.labelEnd) return null;
    const maskedLabel = definitionLabelIn(ctx.maskedLine(cursorPosition.line));
    if (!maskedLabel) return null;
    return lineText.slice(label.nameStart, label.nameEnd);
}

export type RenamePlan =
    | { kind: "renamed"; changes: EditorChange[]; count: number }
    | { kind: "noop" }
    | { kind: "invalid"; reason: string }
    | { kind: "collision" }
    | { kind: "dead" };

/**
 * The rename decision for `oldName` → `newName`: the changes to apply, or
 * why not. Pure planning — nothing is dispatched here.
 */
export function planFootnoteRename(
    doc: Editor,
    oldName: string,
    newName: string,
    ctx: DocContext = docContext(doc),
): RenamePlan {
    if (newName === oldName || newName === "") return { kind: "noop" };
    if (/[[\]]/.test(newName)) {
        return {
            kind: "invalid",
            reason: "Footnote names can't contain brackets.",
        };
    }
    if (!isValidFootnoteName(newName)) {
        return {
            kind: "invalid",
            reason: "Footnote names can't contain spaces or backticks.",
        };
    }

    const oldFolded = oldName.toLowerCase();
    const newFolded = newName.toLowerCase();
    const blocks = findDefinitionBlocks(ctx.lines, ctx.scan.isProtected, ctx.scan);

    // collision: the new name already names ANOTHER footnote (any casing).
    // A case-only rename of the SAME footnote is fine — that's cosmetics.
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
    return { kind: "renamed", changes, count: changes.length };
}

// Simulate the whole rename and require the document's footnote structure
// to be EXACTLY the old one with the name mapped: on every edited line the
// occurrence list (positions shift-adjusted for the length change) must
// match, and the definition blocks must keep their start lines and mapped
// names. Anything else means the new name reclassified text around an
// occurrence — refuse the whole rename rather than corrupt one copy.
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

/** The "Rename footnote" command: resolve the name under the caret, then hand off to the modal. */
export async function renameFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, (doc) => {
        runOutsideTableCell(doc, (cursorPosition) => {
            const target = renameTargetAtCursor(doc, cursorPosition);
            if (target === null) {
                new Notice(RenameTargetNotice, 8000);
                return;
            }
            new RenameFootnoteModal(plugin, doc, target).open();
        });
    });
}

// One text input prefilled with the current name; Enter (or the Rename
// button) applies. Invalid names, collisions, and names the simulation
// refuses show their reason inline and keep the modal open — same shape
// as the Set-footnote-prefix modal.
class RenameFootnoteModal extends Modal {
    private plugin: FootnotePlugin;
    private doc: Editor;
    private oldName: string;
    private value: string;
    private errorEl!: HTMLElement;

    constructor(plugin: FootnotePlugin, doc: Editor, oldName: string) {
        super(plugin.app);
        this.plugin = plugin;
        this.doc = doc;
        this.oldName = oldName;
        this.value = oldName;
    }

    onOpen() {
        this.setTitle("Rename footnote");
        const { contentEl } = this;

        new Setting(contentEl)
            .setName("New name")
            .setDesc(
                `Renames every "[^${this.oldName}]" reference and its definition in this note. Copies inside code or math stay untouched.`,
            )
            .addText((text) => {
                text.setValue(this.value).onChange((value) => {
                    this.value = value;
                    this.showProblem(null);
                });
                text.inputEl.addEventListener("keydown", (evt) => {
                    if (evt.key === "Enter") {
                        evt.preventDefault();
                        this.submit();
                    }
                });
                text.inputEl.focus();
                text.inputEl.select();
            });

        this.errorEl = contentEl.createDiv({
            cls: "footnote-shortcut-prefix-error",
        });

        new Setting(contentEl).addButton((button) =>
            button
                .setButtonText("Rename")
                .setCta()
                .onClick(() => {
                    this.submit();
                }),
        );
    }

    private showProblem(problem: string | null) {
        this.errorEl.setText(problem ?? "");
    }

    private submit() {
        const newName = this.value.trim();
        // planned against the CURRENT document — the note may have changed
        // while the modal was open
        const plan = planFootnoteRename(this.doc, this.oldName, newName);
        switch (plan.kind) {
            case "noop":
                this.close();
                return;
            case "invalid":
                this.showProblem(plan.reason);
                return;
            case "collision":
                this.showProblem(
                    `"[^${newName}]" is already used by another footnote.`,
                );
                return;
            case "dead":
                this.showProblem(
                    `"[^${newName}]" wouldn't survive as a footnote where it's used. Try a different name.`,
                );
                return;
            case "renamed":
                this.doc.transaction({ changes: plan.changes });
                this.close();
                new Notice(
                    `Renamed "[^${this.oldName}]" to "[^${newName}]" in ${plan.count} ${plan.count === 1 ? "place" : "places"}.`,
                );
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
