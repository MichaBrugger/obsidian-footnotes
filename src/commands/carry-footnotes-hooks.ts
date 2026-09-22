import { Editor, EditorPosition, MarkdownView } from "obsidian";

import type FootnotePlugin from "../main";
import { docContext, listExistingFootnoteDefinitions } from "../editor/doc-context";
import { showNotice } from "../editor/notice";
import { readingViewActive, viewEditor } from "../editor/obsidian-internals";
import { activeTableCellEditor } from "../editor/table-cursor";
import { replaceMinimal } from "../editor/write-back";
import { noticeLintAlerts } from "../linting/lint-alerts";
import { lintAfterFootnoteCreation } from "../linting/linter";
import { quotedReference } from "../parsing/footnote-grammar";
import { normalizeEol, removeLineRanges, restoreEol } from "../parsing/markdown-scan";
import {
    CarriedDefinition,
    carriedDefinitions,
    definitionsOrphanedByCut,
    planCarriedPaste,
    splitCarriedText,
    withCarriedText,
} from "./carry-footnotes";
import { buildDefinitionAppend, seedDefinitionBody } from "./definition-append";

// The editor side of carrying footnote definitions on copy, cut, and paste
// (issue #59; Jason's rulings 2026-09-21 and 2026-09-22). The pure pieces
// are in carry-footnotes.ts; this file hooks them to the keys people
// already press.
//
// Copy and cut write the selection AND the definition blocks its
// references need into the clipboard text, after one blank line, and
// remember the same in a register of the plugin's own. The definitions
// travel in the text on purpose (Jason, 2026-09-22): a cut pasted outside
// Obsidian would otherwise lose them, which reads as data loss, and a
// clipboard that carries them costs nothing inside Obsidian, because the
// paste strips them back off before landing them properly. An earlier
// design kept the clipboard clean behind a setting; Jason found no
// downside to carrying and the setting went.
//
// Cut takes the event over whenever the selection needs a definition
// (the editor's own cut would write the bare text) or the deletion
// orphans one: the selection AND the definitions it orphaned leave the
// note in one transaction. A definition still used elsewhere stays, and
// only its copy travels.
//
// Paste: Obsidian's editor-paste event hands over the ClipboardEvent
// before the insert, and its text is read synchronously from the event,
// with no Clipboard API permission (the async read is what makes Copy
// with Footnotes fragile on the phone). When the text matches the
// register, or ends in definition lines from anywhere (a manual copy, a
// Copy with Footnotes clipboard), the plugin takes the paste over and
// lands the body plus the carried definitions in one transaction, merged
// and renamed to fit the destination (planCarriedPaste), where a creation
// press would put them (buildDefinitionAppend). Then the lint-on-creation
// trigger runs, as after every press that creates a footnote.

/** What the last copy or cut from this window took with it. */
export interface CarryRegister {
    /** the clipboard text as written: the body, then the carried blocks */
    text: string;
    /** the selection alone */
    body: string;
    carried: CarriedDefinition[];
    missing: string[];
}

let register: CarryRegister | null = null;

/** The register as it stands, for tests and the paste hook. */
export function carryRegister(): CarryRegister | null {
    return register;
}

/** Forget the last copy (tests; and unload). */
export function resetCarryRegister(): void {
    register = null;
}

/** The single, non-empty selection of the note being edited, or null when the feature is off, no editor is active, the view is Reading view, a table cell owns focus, or the selection is empty or multiple. */
function carryableSelection(plugin: FootnotePlugin): { doc: Editor; from: EditorPosition; to: EditorPosition } | null {
    if (!plugin.settings.carryFootnotesOnCopy) return null;
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc || readingViewActive(mdView)) return null;
    if (activeTableCellEditor(doc)) return null;
    const selections = doc.listSelections();
    if (selections.length !== 1) return null;
    const [a, b] = [selections[0].anchor, selections[0].head];
    const before = a.line < b.line || (a.line === b.line && a.ch <= b.ch);
    const [from, to] = before ? [a, b] : [b, a];
    if (from.line === to.line && from.ch === to.ch) return null;
    return { doc, from, to };
}

/** The text between two positions, read line by line (the fake editor has no getRange). */
function textBetween(doc: Editor, from: EditorPosition, to: EditorPosition): string {
    if (from.line === to.line) return doc.getLine(from.line).slice(from.ch, to.ch);
    const parts = [doc.getLine(from.line).slice(from.ch)];
    for (let line = from.line + 1; line < to.line; line++) parts.push(doc.getLine(line));
    parts.push(doc.getLine(to.line).slice(0, to.ch));
    return parts.join("\n");
}

/** Remember what the selection needs, and return it with the editor and the range. Null when there is nothing to remember. */
function remember(plugin: FootnotePlugin): { doc: Editor; from: EditorPosition; to: EditorPosition; entry: CarryRegister } | null {
    const selection = carryableSelection(plugin);
    if (!selection) return null;
    const { doc, from, to } = selection;
    const body = textBetween(doc, from, to);
    const { carried, missing } = carriedDefinitions(doc.getValue(), from, to);
    const entry = { text: withCarriedText(body, carried), body, carried, missing };
    register = entry;
    return { doc, from, to, entry };
}

/**
 * The copy hook (a bubbling document listener, so it runs after the
 * editor's own copy has written the clipboard and can override the text).
 * A selection that needs no definition is left to the editor.
 */
export function handleCopy(plugin: FootnotePlugin, event: ClipboardEvent): void {
    const remembered = remember(plugin);
    if (!remembered || remembered.entry.carried.length === 0 || !event.clipboardData) return;
    event.clipboardData.setData("text/plain", remembered.entry.text);
    event.preventDefault();
}

/**
 * The cut hook (a capturing document listener, so it runs before the
 * editor's own cut and can take the event over). It takes over when the
 * selection needs a definition or the deletion orphans one; a cut that
 * needs neither is the editor's own.
 */
export function handleCut(plugin: FootnotePlugin, event: ClipboardEvent): void {
    const remembered = remember(plugin);
    if (!remembered || !event.clipboardData) return;
    const { doc, from, to, entry } = remembered;
    const before = doc.getValue();
    const orphaned = definitionsOrphanedByCut(before, from, to);
    if (entry.carried.length === 0 && orphaned.length === 0) return;
    event.clipboardData.setData("text/plain", entry.text);
    event.preventDefault();
    event.stopPropagation();
    // the note as it reads without the selection and without the orphaned
    // blocks, written back as the smallest set of edits in one transaction
    const { text: normalised, eol } = normalizeEol(before);
    const lines = normalised.split("\n");
    const joined = [
        ...lines.slice(0, from.line),
        lines[from.line].slice(0, from.ch) + lines[to.line].slice(to.ch),
        ...lines.slice(to.line + 1),
    ];
    // the orphaned blocks were reported in the note's own line numbers;
    // after the deletion the lines below the selection sit higher up
    const shift = to.line - from.line;
    const ranges = orphaned.map((block) => ({
        start: block.start < from.line ? block.start : block.start - shift,
        end: block.end < from.line ? block.end : block.end - shift,
    }));
    const after = restoreEol(removeLineRanges(joined, ranges).join("\n"), eol);
    replaceMinimal(doc, before, after, plugin.app.workspace.getActiveViewOfType(MarkdownView) ?? undefined);
    doc.setCursor(from);
    if (orphaned.length > 0) {
        const count = orphaned.length;
        showNotice(`Cut with ${count} footnote definition${count === 1 ? "" : "s"} that nothing else used; paste to carry ${count === 1 ? "it" : "them"} along.`);
    }
}

/**
 * The paste hook, on Obsidian's editor-paste event. Takes the paste over
 * when the text matches the register or ends in definition lines; leaves
 * every other paste, and one another plugin already handled, alone.
 * Returns whether it took the paste over.
 */
export function handlePaste(plugin: FootnotePlugin, event: ClipboardEvent, doc: Editor): boolean {
    if (event.defaultPrevented || !plugin.settings.carryFootnotesOnCopy || !event.clipboardData) return false;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return false;
    let body: string;
    let carried: CarriedDefinition[];
    let missing: string[];
    if (register && normalizeEol(register.text).text === normalizeEol(text).text) {
        // the plugin's own copy: the exact blocks it remembered, and the
        // names it could not find
        ({ body, carried, missing } = register);
    } else {
        // a clipboard from anywhere that ends in definition lines
        ({ body, carried } = splitCarriedText(text));
        missing = [];
    }
    if (carried.length === 0) {
        // nothing to land, so the editor pastes as usual; a reference that
        // travelled without a definition is still worth a word
        if (missing.length > 0) {
            showNotice(`${missing.map(quotedReference).join(", ")} ${missing.length === 1 ? "has" : "have"} no definition to carry.`, 8000);
        }
        return false;
    }
    if (activeTableCellEditor(doc)) return false;
    const selections = doc.listSelections();
    if (selections.length !== 1) return false;
    const [a, b] = [selections[0].anchor, selections[0].head];
    const [from, to] = a.line < b.line || (a.line === b.line && a.ch <= b.ch) ? [a, b] : [b, a];
    event.preventDefault();

    const ctx = docContext(doc);
    const plan = planCarriedPaste(doc.getValue(), body, carried);
    const bodyLines = plan.body.split("\n");
    const changes = [{ from, to, text: plan.body }];
    if (plan.definitions.length > 0) {
        // where a creation press would put a definition, seeded with the
        // first carried block's body and extended with the rest, all in
        // the same transaction as the body
        const first = plan.definitions[0];
        const isFirstFootnote = listExistingFootnoteDefinitions(doc, ctx).length === 0;
        const definition = seedDefinitionBody(
            buildDefinitionAppend(doc, first.name, isFirstFootnote, plugin, ctx, { from, to }),
            first.name,
            blockBody(first),
        );
        const textLines = definition.change.text.split("\n");
        textLines.splice(
            definition.labelLineOffset + blockBody(first).split("\n").length,
            0,
            ...plan.definitions.slice(1).flatMap((block) => block.lines),
        );
        if (definition.prepend) changes.push(definition.prepend as { from: EditorPosition; to: EditorPosition; text: string });
        changes.push({ ...definition.change, to: definition.change.to ?? definition.change.from, text: textLines.join("\n") });
    }
    const end: EditorPosition =
        bodyLines.length === 1
            ? { line: from.line, ch: from.ch + plan.body.length }
            : { line: from.line + bodyLines.length - 1, ch: bodyLines[bodyLines.length - 1].length };
    doc.transaction({ changes, selection: { from: end } });

    const total = plan.added + plan.reused;
    let notice =
        `Pasted with ${total} footnote definition${total === 1 ? "" : "s"}: ${plan.added} added, ${plan.reused} reused` +
        (plan.repointed > 0 ? ` (${plan.repointed} under a name this note already had)` : "") +
        `, ${plan.renamed} renamed.`;
    if (missing.length > 0) {
        notice += ` ${missing.map(quotedReference).join(", ")} ${missing.length === 1 ? "has" : "have"} no definition to carry.`;
    }
    showNotice(notice, missing.length > 0 ? 8000 : undefined);
    if (lintAfterFootnoteCreation(plugin, false) === null && !plugin.settings.lintOnFootnoteCreation) {
        noticeLintAlerts(plugin, doc.getValue());
    }
    return true;
}

/** A carried block's text after its label, continuation lines joined with newlines, the way seedDefinitionBody wants a body. */
function blockBody(block: CarriedDefinition): string {
    const first = block.lines[0];
    const label = first.indexOf("]:");
    const head = label === -1 ? first : first.slice(label + 2).replace(/^ /, "");
    return [head, ...block.lines.slice(1)].join("\n");
}

/** Install the three hooks. Copy bubbles (after the editor's own), cut captures (before it), paste is Obsidian's event. */
export function installCarryFootnoteHooks(plugin: FootnotePlugin): void {
    plugin.registerDomEvent(document, "copy", (event) => {
        handleCopy(plugin, event);
    });
    plugin.registerDomEvent(document, "cut", (event) => {
        handleCut(plugin, event);
    }, { capture: true });
    plugin.registerEvent(
        plugin.app.workspace.on("editor-paste", (evt, editor) => {
            if (evt.defaultPrevented) return;
            if (handlePaste(plugin, evt, editor)) evt.preventDefault();
        }),
    );
}
