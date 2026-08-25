import { Editor, EditorChange, EditorPosition, MarkdownView, Notice } from "obsidian";

import type FootnotePlugin from "../main";
import {
    computeNextFootnoteNumber,
    emptyReferenceStart,
    occurrenceAtCursor,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { activeFootnotePrefix, footnotePrefixFromEditor } from "../parsing/footnote-prefix";
import { adjustFootnotePosition } from "../editor/cursor-motion";
import { buildDefinitionAppend } from "./definition-append";
import { DocContext, docContext, listExistingFootnoteDefinitions } from "../editor/doc-context";
import {
    inlineFootnoteSpanAt,
    sanitizeInlineFootnoteContent,
} from "./inline-footnotes";
import {
    ProtectedCreationNotice,
    simulateChanges,
    simulatedAnchor,
    verifyLiveFootnoteInsertion,
} from "../editor/insertion-liveness";
import { maskedLineAt } from "../parsing/markdown-scan";
import { landDefinitionBackedInsertion } from "./create-footnote";
import { lintAfterFootnoteCreation } from "../linting/linter";
import {
    warnDefinitionCaretIfInside,
    warnProtectedCaretIfInside,
} from "./press-guards";
import { readingViewActive } from "../editor/obsidian-internals";

// Multiple Alt-clicked carets get the SAME footnote at every one of them
// (Jason's ask 2026-08-22 — one source referenced many times; always on,
// no toggle, his call): the autonum key inserts the same "[^N]" at each
// caret with ONE definition; the named/inline keys drop their skeleton at
// each caret and leave a CURSOR inside every bracket pair, so typing fills
// all of them simultaneously (CodeMirror mirrors input at every cursor);
// the paste key wraps the same clipboard text at each caret. Atomic by
// ruling: every caret must sit where a footnote can be created, or the
// whole press refuses with one toast — and the edit is one transaction,
// one undo. Extra carets used to be silently ignored, which served nobody.

export const MultiCaretFootnoteNotice =
    "No footnotes were created: one of the cursors is inside an existing footnote.";

const posCmp = (a: EditorPosition, b: EditorPosition) =>
    a.line - b.line || a.ch - b.ch;

/**
 * The press's insertion targets when this is a multi-caret press: every
 * caret guard-checked (a refusal toasts and returns "handled"), adjusted
 * (end-of-word/punctuation hop, like every single-caret insert), deduped,
 * and sorted to document order. Null = not a multi-caret press (fewer
 * than two carets, a real selection, or an active table cell — cells are
 * their own single-caret world); "handled" = refused, press consumed.
 */
function multiCaretTargets(
    plugin: FootnotePlugin,
    doc: Editor,
    ctx: DocContext,
): EditorPosition[] | "handled" | null {
    const ranges = doc.listSelections();
    if (ranges.length < 2) return null;
    // any non-empty range belongs to the selection-conversion claim, which
    // runs before this and would have consumed the press — reaching here
    // with one means the claim declined (e.g. whitespace-only): not ours
    if (ranges.some((range) => posCmp(range.anchor, range.head) !== 0)) {
        return null;
    }
    for (const range of ranges) {
        const pos = range.head;
        const lineText = doc.getLine(pos.line);
        const masked = ctx.maskedLine(pos.line);
        // a caret inside ANY existing footnote artifact refuses: on a
        // single caret that press means navigate/hop/continue, and mixed
        // meanings across carets are exactly what the atomic rule forbids
        if (
            emptyReferenceStart(masked, pos.ch) !== null ||
            occurrenceAtCursor(referenceOccurrences(lineText, masked), pos.ch) !==
                null ||
            inlineFootnoteSpanAt(masked, pos.ch) !== null
        ) {
            new Notice(MultiCaretFootnoteNotice, 8000);
            return "handled";
        }
        // protected text and definition interiors refuse with their own
        // notices, exactly like the single-caret creation guards
        if (warnProtectedCaretIfInside(doc, null, pos, ctx)) return "handled";
        if (warnDefinitionCaretIfInside(doc, null, pos, ctx)) return "handled";
    }
    const adjusted = ranges.map((range) =>
        adjustFootnotePosition(
            range.head,
            doc,
            doc.getLine(range.head.line),
            plugin,
        ),
    );
    adjusted.sort(posCmp);
    // end-of-word can gather carets from the same word onto one spot —
    // that spot gets ONE insert
    return adjusted.filter(
        (pos, i) => i === 0 || posCmp(pos, adjusted[i - 1]) !== 0,
    );
}

/**
 * The multi-caret claim for the synchronous keys. True = the press was a
 * multi-caret press and is settled: inserted at every caret, or refused
 * with its toast. False = not multi-caret; the normal cascade owns it.
 */
export function multiCaretPressHandled(
    plugin: FootnotePlugin,
    doc: Editor,
    cellActive: boolean,
    command: "autonum" | "named" | "inline",
): boolean {
    if (cellActive) return false;
    const ctx = docContext(doc);
    const targets = multiCaretTargets(plugin, doc, ctx);
    if (targets === null) return false;
    if (targets === "handled") return true;

    if (command === "autonum") {
        insertReferenceAtEveryCaret(plugin, doc, ctx, targets);
        return true;
    }
    if (command === "named") {
        const prefix = plugin.settings.enableFootnotePrefix
            ? activeFootnotePrefix(plugin, footnotePrefixFromEditor(doc))
            : "";
        // an invalid prefix already toasted its reason
        if (prefix === null) return true;
        const skeleton = `[^${prefix}]`;
        insertSkeletonAtEveryCaret(doc, ctx, targets, skeleton, 2 + prefix.length);
        return true;
    }
    insertSkeletonAtEveryCaret(doc, ctx, targets, "^[]", 2);
    return true;
}

/**
 * The multi-caret claim for the paste key: same clipboard text wrapped as
 * "^[…]" at every caret. Async only for the clipboard read, which happens
 * AFTER the guard sweep so a refused press never touches the clipboard.
 */
export async function multiCaretPastePressHandled(
    plugin: FootnotePlugin,
    doc: Editor,
    cellActive: boolean,
): Promise<boolean> {
    if (cellActive) return false;
    const ctx = docContext(doc);
    const targets = multiCaretTargets(plugin, doc, ctx);
    if (targets === null) return false;
    if (targets === "handled") return true;

    let raw: string;
    try {
        raw = await navigator.clipboard.readText();
    } catch {
        new Notice("Couldn't read the clipboard.");
        return true;
    }
    // the view can flip to Reading view while the clipboard prompt is up —
    // same post-await re-check as the single-caret paste path
    const viewAfterAwait = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!viewAfterAwait || readingViewActive(viewAfterAwait)) return true;
    const content = sanitizeInlineFootnoteContent(raw);
    if (!content) {
        new Notice(
            "The clipboard is empty, so there is nothing to put in an inline footnote.",
        );
        return true;
    }
    const text = `^[${content}]`;
    insertSkeletonAtEveryCaret(doc, ctx, targets, text, text.length);
    return true;
}

// The autonum flavor: the same next-numbered reference at every caret,
// ONE definition appended — then popup or jump per settings, exactly like
// the single-caret insert (the definition is singular, so the landing is
// too). The whole edit is one transaction; the liveness verify covers
// EVERY reference (any dead one refuses the lot — atomicity again).
function insertReferenceAtEveryCaret(
    plugin: FootnotePlugin,
    doc: Editor,
    ctx: DocContext,
    targets: EditorPosition[],
): void {
    const prefix = activeFootnotePrefix(plugin, footnotePrefixFromEditor(doc));
    if (prefix === null) return;
    const masked = ctx.maskedLines().join("\n");
    const footnoteId = `${prefix}${computeNextFootnoteNumber(masked, prefix, masked)}`;
    const footnoteReference = `[^${footnoteId}]`;
    const isFirstFootnote = listExistingFootnoteDefinitions(doc, ctx).length === 0;

    const definition = buildDefinitionAppend(doc, footnoteId, isFirstFootnote, plugin, ctx);
    const changes: EditorChange[] = targets.map((pos) => ({
        from: pos,
        text: footnoteReference,
    }));
    changes.push(definition.change);
    if (definition.prepend) changes.push(definition.prepend);

    const verified = verifyLiveFootnoteInsertion({
        lines: ctx.lines,
        changes,
        referenceChangeIndices: targets.map((_, index) => index),
        footnoteId,
        definitionLabelLine: definition.cursor.line,
    });
    if (!verified) {
        new Notice(ProtectedCreationNotice, 8000);
        return;
    }

    landDefinitionBackedInsertion({
        plugin,
        doc,
        changes,
        origin: targets[0],
        footnoteId,
        definitionCursor: definition.cursor,
        afterReference: {
            line: verified.anchors[0].line,
            ch: verified.anchors[0].ch + footnoteReference.length,
        },
        // full parity with the single-caret insert (Jason's ask
        // 2026-08-25): creating the footnote lints the note when the
        // setting says so — reindexing renames every minted reference
        // consistently, and the reland targets the ONE new definition
        afterJump: () => {
            lintAfterFootnoteCreation(plugin, true);
        },
    });
}

// The skeleton flavor shared by named ("[^]"), inline ("^[]"), and paste
// ("^[clipboard]"): the same text at every caret, then a CURSOR placed
// `innerOffset` into each — for named/inline that is inside the brackets,
// so typing the name/body types into all of them at once (CodeMirror
// multi-cursor input); for paste it is just past each wrapper. Born-dead
// verify per caret on the one simulated result; any dead landing refuses
// the lot.
function insertSkeletonAtEveryCaret(
    doc: Editor,
    ctx: DocContext,
    targets: EditorPosition[],
    text: string,
    innerOffset: number,
): void {
    const changes: EditorChange[] = targets.map((pos) => ({ from: pos, text }));
    const simulated = simulateChanges(ctx.lines, changes);
    const anchors = targets.map((_, index) =>
        simulatedAnchor(ctx.lines, changes, index, simulated),
    );
    const everyLive = anchors.every((anchor) => {
        const masked = maskedLineAt(simulated, anchor.line);
        return text.startsWith("^[")
            ? inlineFootnoteSpanAt(masked, anchor.ch + 2)?.open === anchor.ch
            : masked.slice(anchor.ch, anchor.ch + text.length) === text;
    });
    if (!everyLive) {
        new Notice(ProtectedCreationNotice, 8000);
        return;
    }
    doc.transaction({
        changes,
        selections: anchors.map((anchor) => ({
            from: { line: anchor.line, ch: anchor.ch + innerOffset },
        })),
    });
}
