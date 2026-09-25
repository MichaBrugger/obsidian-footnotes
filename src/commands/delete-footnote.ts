import {
    definitionLabelWithName,
    quotedDefinitionLabel,
    quotedReference,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { inItemDefinitionLabels } from "../parsing/list-item-definitions";
import {
    DefinitionBlock,
    definitionStartLines,
    findDefinitionBlocks,
    lazyDefinitionLabelLines,
    maskProtectedLines,
    normalizeEol,
    quotedDefinitionEnd,
    removeLineRanges,
    restoreEol,
    scanDocument,
    underlinedDefinitionLabelLines,
} from "../parsing/markdown-scan";
import { linesReadDifferently } from "../linting/rules/remove-orphaned-definitions";
import { cutOne, readsDifferently } from "../linting/rules/remove-orphaned-references";
import { MarkdownView } from "obsidian";

import type FootnotePlugin from "../main";
import { showNotice } from "../editor/notice";
import { runOutsideTableCell } from "../editor/table-cursor";
import { replaceMinimal } from "../editor/write-back";
import { noticeLintAlerts } from "../linting/lint-alerts";
import { withEmptySectionHeadingRemoved } from "../linting/linter";
import { withEditableEditor } from "./insert-or-navigate-footnotes";
import { renameTargetAtCursor, renameTargetInSelection } from "./rename-footnote";

// Deleting a footnote everywhere (T4 of the 2026-09 feature round; Jason's
// rulings 2026-09-19 to 2026-09-21).
//
// Obsidian's own right-click "Delete footnote and reference" removes the
// one reference that was clicked and the definition. A footnote cited in
// two places keeps its other reference, now pointing at nothing (Jason's
// report, 2026-09-19). This command deletes the definition AND every
// reference to it, from whichever end the caret sits on, in one step and
// one undo.
//
// The work is a pure markdown-to-markdown transform, the way the lint
// rules are written, so the command can write it back as one transaction
// that keeps folds and the caret (replaceMinimal), and so the transform can
// be property-tested with the same generator the rules use.

export type DeleteFootnotePlan =
    | {
          kind: "deleted";
          markdown: string;
          /** how many references were cut out of the text (a reference inside a deleted definition's own body is not counted: it went with the block) */
          references: number;
          /** how many definition blocks were removed */
          definitions: number;
      }
    /** the note holds no live reference or definition with this name */
    | { kind: "nothing" }
    /** the deletion would change how Obsidian reads text it was not asked to touch, or the definition is one the plugin never cuts; nothing was changed and `reason` says why, in the toast's words */
    | { kind: "refused"; reason: string };

/**
 * `markdown` with the footnote called `name` gone: every live reference to
 * it cut out of the text with the gap closed, and every definition block
 * of that name removed. Names match without regard to case, as Obsidian
 * matches them. Copies inside code, math, comments, or frontmatter are
 * plain text and stay.
 */
export function deleteFootnoteEverywhere(markdown: string, name: string): DeleteFootnotePlan {
    const folded = name.toLowerCase();
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);

    const blocks: DefinitionBlock[] = findDefinitionBlocks(lines, scan, masked, starts).filter(
        (block) => block.name.toLowerCase() === folded,
    );
    // A definition inside a list item ("- [^x]: text", or a label indented
    // under the item) is deleted when it is one line long, since Obsidian's
    // own delete removes it too (Jason, 2026-09-22). The plugin does not
    // model where such a definition ends, so one that runs on to another
    // line (anything below it that is not blank, the end of the note, or a
    // new list item) is refused with a reason, as the rename command
    // refuses every in-item definition (Jason's ruling 1, 2026-09-20). On
    // a marker line only the definition text goes and the bullet stays, an
    // empty item, because that is what Obsidian's own delete leaves
    // (Jason, 2026-09-24, sheet 19); a label indented under the item has
    // no marker of its own, so its whole line goes.
    const trimmed = new Map<number, number>();
    for (const hit of inItemDefinitionLabels(lines, scan, masked, starts)) {
        if (hit.name.toLowerCase() !== folded) continue;
        const endsHere =
            hit.line + 1 >= lines.length ||
            lines[hit.line + 1].trim() === "" ||
            /^ {0,3}(?:[-+*]|\d{1,9}[.)])(?: |$)/.test(lines[hit.line + 1]);
        if (!endsHere) {
            return {
                kind: "refused",
                reason: `Nothing was deleted: ${quotedReference(name)} is defined inside a list item over more than one line, which the plugin does not delete. Delete it by hand.`,
            };
        }
        const marker = /^ {0,3}(?:[-+*]|\d{1,9}[.)]) +/.exec(lines[hit.line]);
        if (marker && lines[hit.line].startsWith("[^", marker[0].length)) {
            trimmed.set(hit.line, marker[0].length);
        } else {
            blocks.push({ name: hit.name, start: hit.line, end: hit.line });
        }
    }
    // A label inside a blockquote or callout ("> [^x]: ...") is a real
    // definition everywhere else in the plugin but never forms a block, so
    // it is collected here with the quoted continuation Obsidian gives it
    // (the same reading the orphan-definition rule uses). A label that
    // shares its line with the "%%" closing a comment is never cut, since
    // the line would take the closer with it and leave the comment open
    // over the rest of the note; the command refuses and says so.
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] || !starts[i]) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (!hit || hit.name.toLowerCase() !== folded) continue;
        if (hit.label.afterCloser) {
            return {
                kind: "refused",
                reason: `Nothing was deleted: the ${quotedDefinitionLabel(hit.name)} definition shares its line with the "%%" that closes a comment, so cutting it would leave the comment open. Delete it by hand.`,
            };
        }
        if (hit.label.quoted) {
            blocks.push({ name: hit.name, start: i, end: quotedDefinitionEnd(lines, scan, starts, i) });
        }
    }
    // A lazy label (a "[^x]:" line directly under prose, one blank line
    // short of a definition) and an underlined label (a "[^x]:" line with
    // a setext underline under it, which makes it a heading) are the
    // definitions the user MEANT to write, so they go too: the lazy line
    // alone, the underlined line together with its underline, which has
    // no business staying behind under the line above.
    const labelOf = (i: number): boolean =>
        definitionLabelWithName(lines[i], masked[i])?.name.toLowerCase() === folded;
    for (const i of lazyDefinitionLabelLines(lines, scan, masked, starts)) {
        if (labelOf(i)) blocks.push({ name, start: i, end: i });
    }
    for (const i of underlinedDefinitionLabelLines(lines, scan, masked, starts)) {
        if (labelOf(i)) blocks.push({ name, start: i, end: i + 1 });
    }
    blocks.sort((a, b) => a.start - b.start);
    // the lines a block cut takes with it: a reference on one of them
    // goes with the block and is not cut, or counted, on its own
    const cut = new Set<number>();
    for (const block of blocks) {
        for (let i = block.start; i <= block.end; i++) cut.add(i);
    }

    let references = 0;
    const cutLines = lines.map((line, i) => {
        if (scan.isProtected[i] || cut.has(i)) return line;
        const keep = trimmed.get(i);
        if (keep !== undefined) return line.slice(0, keep);
        // rightmost first, so that cutting one keeps the offsets of the
        // ones before it
        const hits = referenceOccurrences(line, masked[i], starts[i])
            .filter((occurrence) => occurrence.name.toLowerCase() === folded)
            .reverse();
        references += hits.length;
        return hits.reduce((kept, { start, end }) => cutOne(kept, start, end), line);
    });
    const definitions = blocks.length + trimmed.size;
    if (references === 0 && definitions === 0) return { kind: "nothing" };

    // The promise the two orphan rules make, kept here too: a deletion
    // that changes how Obsidian reads a line it was not asked to touch is
    // refused whole, rather than half done. Cutting reference text can
    // turn "-[^9] tail" into a bullet; cutting a block can put the line
    // below it under a setext underline or a blank line and so promote a
    // lazy label there into a definition (the guards' own comments list
    // the cases).
    const byHand = " would change how Obsidian reads the text around it. Delete it by hand.";
    if (references > 0 && readsDifferently(lines, scan, starts, cutLines)) {
        return { kind: "refused", reason: `Nothing was deleted: removing ${quotedReference(name)}${byHand}` };
    }
    const out = removeLineRanges(cutLines, blocks);
    if (
        blocks.length > 0 &&
        linesReadDifferently(cutLines, references > 0 ? scanDocument(cutLines) : scan, blocks, out)
    ) {
        return {
            kind: "refused",
            reason: `Nothing was deleted: removing the ${quotedDefinitionLabel(name)} definition${byHand}`,
        };
    }
    return {
        kind: "deleted",
        markdown: restoreEol(out.join("\n"), eol),
        references,
        definitions,
    };
}

export const DeleteTargetNotice =
    "Place the cursor on a footnote reference or definition to delete it.";

/** The toast after a deletion: what went, in numbers. A zero count is left out rather than said, as the paste toast does (Jason, 2026-09-25). */
function deleteFootnoteNotice(name: string, references: number, definitions: number): string {
    const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const went = [
        references > 0 ? count(references, "reference") : null,
        definitions > 0 ? count(definitions, "definition") : null,
    ].filter((part): part is string => part !== null);
    return `Deleted ${quotedReference(name)} everywhere: ${went.join(" and ")}.`;
}

/**
 * The "Delete footnote everywhere" command. It works
 * out the name under the caret (or under the selection, the way the
 * rename command does for a phone's long-press selection), runs the
 * transform, and writes the result back as one transaction that keeps
 * folds and the caret. Then the lint alerts speak, since a deletion can
 * leave something for them to say (a definition only the deleted one's
 * body was citing is now an orphan).
 */
export async function deleteFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(
        plugin,
        (doc) => {
            runOutsideTableCell(doc, (cursorPosition) => {
                const selection = doc.listSelections()[0];
                const collapsed =
                    selection.anchor.line === selection.head.line &&
                    selection.anchor.ch === selection.head.ch;
                // the rename command's resolvers find the footnote under a
                // caret or a selection; they are about the caret, not the
                // rename, so this command shares them
                const target = collapsed
                    ? renameTargetAtCursor(doc, cursorPosition)
                    : renameTargetInSelection(doc, selection.anchor, selection.head);
                if (target === null) {
                    showNotice(DeleteTargetNotice, 8000);
                    return;
                }
                const before = doc.getValue();
                const plan = deleteFootnoteEverywhere(before, target);
                switch (plan.kind) {
                    case "nothing":
                        // the target came from this very document, so this
                        // is unreachable in practice; say something honest
                        // rather than nothing if it ever happens
                        showNotice(`Nothing was deleted: ${quotedReference(target)} was not found in this note.`, 8000);
                        return;
                    case "refused":
                        showNotice(plan.reason, 8000);
                        return;
                    case "deleted": {
                        const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView) ?? undefined;
                        // the section heading goes with the last footnote when
                        // the setting says so (Jason, 2026-09-25)
                        const markdown = withEmptySectionHeadingRemoved(plugin, plan.markdown);
                        replaceMinimal(doc, before, markdown, mdView);
                        showNotice(deleteFootnoteNotice(target, plan.references, plan.definitions));
                        noticeLintAlerts(plugin, markdown);
                    }
                }
            });
        },
        // focus in the Properties panel: no footnote under a property
        // field, and the editor's caret is stale (the rename command's
        // reasoning)
        DeleteTargetNotice,
    );
}

/**
 * "Delete footnote everywhere" in the editor's
 * right-click menu, beside the rename item and Obsidian's own "Delete
 * footnote and reference", when the click landed on a reference or a
 * definition label. Desktop only in practice, as the rename item is: on a
 * phone Obsidian owns the long-press menu and never fires this event for a
 * reference, so the phone's route is the toolbar icon.
 */
export function registerDeleteFootnoteMenu(plugin: FootnotePlugin) {
    plugin.registerEvent(
        plugin.app.workspace.on("editor-menu", (menu, editor, info) => {
            if (!(info instanceof MarkdownView)) return;
            const selection = editor.listSelections()[0];
            const target = renameTargetInSelection(editor, selection.anchor, selection.head);
            if (target === null) return;
            menu.addItem((item) =>
                item
                    .setTitle("Delete footnote everywhere")
                    .setIcon("footnote-delete")
                    .setSection("selection")
                    .onClick(() => {
                        void deleteFootnote(plugin);
                    }),
            );
        }),
    );
}
