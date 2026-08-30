import { Editor, EditorChange, EditorPosition, MarkdownView, Notice } from "obsidian";

import type FootnotePlugin from "../main";
import {
    computeNextFootnoteNumber,
    emptyReferenceStart,
    idListIncludes,
    isValidFootnoteName,
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
    inlineWrapLandsIntact,
} from "./inline-footnotes";
import {
    ProtectedCreationNotice,
    simulateChanges,
    simulatedAnchor,
    verifyLiveFootnoteInsertion,
} from "../editor/insertion-liveness";
import { maskedLineAt } from "../parsing/markdown-scan";
import {
    createMatchingFootnoteDefinition,
    landDefinitionBackedInsertion,
} from "./create-footnote";
import {
    caretGuardsHandled,
    warnDefinitionCaretIfInside,
    warnPrefilledReferenceIfInside,
    warnProtectedCaretIfInside,
} from "./press-guards";
import { readingViewActive } from "../editor/obsidian-internals";

// Multiple Alt-clicked carets get the SAME footnote at every one of them
// (Jason's ask 2026-08-22 - one source referenced many times; always on,
// no toggle, his call): the autonum key inserts the same "[^N]" at each
// caret with ONE definition; the named/inline keys drop their skeleton at
// each caret and leave a CURSOR inside every bracket pair, so typing fills
// all of them simultaneously (CodeMirror mirrors input at every cursor);
// the paste key wraps the same clipboard text at each caret. Atomic by
// ruling: every caret must sit where a footnote can be created, or the
// whole press refuses with one toast - and the edit is one transaction,
// one undo. Extra carets used to be silently ignored, which served nobody.

export const MultiCaretFootnoteNotice =
    "No footnotes were created: one of the cursors is inside an existing footnote.";

const posCmp = (a: EditorPosition, b: EditorPosition) =>
    a.line - b.line || a.ch - b.ch;

/** What a caret sits inside, for the continuation check - the same probe trio the guard sweep refuses on. Inline wins over reference shape on purpose: an inline body can contain reference-shaped text (single-caret guard precedence). */
type CaretArtifact =
    | { kind: "inline"; empty: boolean }
    | { kind: "empty" }
    | { kind: "ref"; name: string }
    | null;

function caretArtifact(
    doc: Editor,
    ctx: DocContext,
    pos: EditorPosition,
): CaretArtifact {
    const lineText = doc.getLine(pos.line);
    const masked = ctx.maskedLine(pos.line);
    const span = inlineFootnoteSpanAt(masked, pos.ch);
    if (span !== null) {
        return {
            kind: "inline",
            empty: masked.slice(span.open + 2, span.close).trim() === "",
        };
    }
    if (emptyReferenceStart(masked, pos.ch) !== null) return { kind: "empty" };
    const occurrence = occurrenceAtCursor(
        referenceOccurrences(lineText, masked),
        pos.ch,
    );
    if (occurrence !== null) return { kind: "ref", name: occurrence.name };
    return null;
}

/**
 * A press with EVERY caret inside the same footnote artifact is not a
 * refusal - it is the single-caret CONTINUATION, aimed at the LAST
 * artifact in document order (A14 report, 2026-08-27: the named
 * multi-caret flow dead-ended on its second press, and filled inline
 * footnotes could never hop back out). Uniform empties/placeholders warn
 * through the shared guards WITHOUT collapsing, so typing keeps filling
 * every skeleton; a filled-inline press hops one cursor out past the last
 * span; same-named dangling references get their ONE shared definition
 * (popup/jump + creation lint, via createMatchingFootnoteDefinition).
 * Anything mixed - kinds, names, emptiness - or already working (a
 * defined name) keeps the atomic refusal. Always consumes the press.
 */
function multiCaretContinuation(
    plugin: FootnotePlugin,
    doc: Editor,
    ctx: DocContext,
    carets: EditorPosition[],
    artifacts: NonNullable<CaretArtifact>[],
    allowDefinitionContinuation: boolean,
): "handled" {
    const refuse = (): "handled" => {
        new Notice(MultiCaretFootnoteNotice, 8000);
        return "handled";
    };
    const last = carets.reduce((a, b) => (posCmp(a, b) >= 0 ? a : b));
    if (new Set(artifacts.map((a) => a.kind)).size !== 1) return refuse();
    const kind = artifacts[0].kind;
    if (kind === "inline") {
        // uniformly empty or uniformly filled, or the meanings are mixed
        if (new Set(artifacts.map((a) => a.kind === "inline" && a.empty)).size !== 1) {
            return refuse();
        }
        // the shared guards do the rest at the last caret: warn while
        // empty (every caret stays), or hop out past the last span
        // (collapsing the multi-cursor - Jason's ask: land right after
        // the LAST footnote)
        caretGuardsHandled(plugin, doc, null, last);
        return "handled";
    }
    if (kind === "empty") {
        // the shared empty-"[^]" warning; every caret stays for typing
        caretGuardsHandled(plugin, doc, null, last);
        return "handled";
    }
    const names = artifacts.map((a) => (a.kind === "ref" ? a.name : ""));
    if (new Set(names.map((n) => n.toLowerCase())).size !== 1) return refuse();
    // an untouched "[^prefix]" placeholder asks for its suffix (all stay)
    if (warnPrefilledReferenceIfInside(plugin, doc, null, last)) {
        return "handled";
    }
    // the paste key has no definition-continuation semantics at a single
    // caret either - its meaning is "wrap the clipboard", so same-named
    // references keep the refusal there
    if (!allowDefinitionContinuation) return refuse();
    const name = names[0];
    if (idListIncludes(listExistingFootnoteDefinitions(doc, ctx), name)) {
        // already a working footnote - nothing to continue
        return refuse();
    }
    if (!isValidFootnoteName(name)) {
        // warns with the shared invalid-name notice, edits nothing
        createMatchingFootnoteDefinition(doc.getLine(last.line), last, plugin, doc, ctx);
        return "handled";
    }
    // collapse to the last caret first, then the single-caret continuation
    // creates the ONE shared definition and lands (popup/jump + lint)
    doc.setCursor(last);
    createMatchingFootnoteDefinition(doc.getLine(last.line), last, plugin, doc, ctx);
    return "handled";
}

/**
 * The press's insertion targets when this is a multi-caret press: every
 * caret guard-checked (a refusal toasts and returns "handled"), adjusted
 * (end-of-word/punctuation hop, like every single-caret insert), deduped,
 * and sorted to document order. Null = not a multi-caret press (fewer
 * than two carets, a real selection, or an active table cell - cells are
 * their own single-caret world); "handled" = consumed without inserting:
 * refused, or settled by the all-carets-inside-one-footnote continuation
 * (see multiCaretContinuation).
 */
function multiCaretTargets(
    plugin: FootnotePlugin,
    doc: Editor,
    ctx: DocContext,
    allowDefinitionContinuation: boolean,
): EditorPosition[] | "handled" | null {
    const ranges = doc.listSelections();
    if (ranges.length < 2) return null;
    // any non-empty range belongs to the selection-conversion claim, which
    // runs before this and would have consumed the press - reaching here
    // with one means the claim declined (e.g. whitespace-only): not ours
    if (ranges.some((range) => posCmp(range.anchor, range.head) !== 0)) {
        return null;
    }
    const artifacts = ranges.map((range) => caretArtifact(doc, ctx, range.head));
    if (artifacts.every((artifact) => artifact !== null)) {
        return multiCaretContinuation(
            plugin,
            doc,
            ctx,
            ranges.map((range) => range.head),
            artifacts,
            allowDefinitionContinuation,
        );
    }
    for (const [index, range] of ranges.entries()) {
        const pos = range.head;
        // a caret inside an existing footnote artifact refuses when the
        // OTHER carets sit in plain text: on a single caret that press
        // means navigate/hop/continue, and mixed meanings across carets
        // are exactly what the atomic rule forbids (all-inside-the-same
        // presses continue instead - see multiCaretContinuation above)
        if (artifacts[index] !== null) {
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
    // end-of-word can gather carets from the same word onto one spot -
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
    const targets = multiCaretTargets(plugin, doc, ctx, true);
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
    const targets = multiCaretTargets(plugin, doc, ctx, false);
    if (targets === null) return false;
    if (targets === "handled") return true;

    let raw: string;
    try {
        raw = await navigator.clipboard.readText();
    } catch {
        new Notice("Couldn't read the clipboard.");
        return true;
    }
    // the view can flip to Reading view while the clipboard prompt is up -
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
// ONE definition appended - then popup or jump per settings, exactly like
// the single-caret insert (the definition is singular, so the landing is
// too). The whole edit is one transaction; the liveness verify covers
// EVERY reference (any dead one refuses the lot - atomicity again).
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
        // the landing owns the creation lint (parity, Jason's ask
        // 2026-08-25): reindexing renames every minted reference
        // consistently, and the relocation targets the ONE new definition
    });
}

// The skeleton flavor shared by named ("[^]"), inline ("^[]"), and paste
// ("^[clipboard]"): the same text at every caret, then a CURSOR placed
// `innerOffset` into each - for named/inline that is inside the brackets,
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
            ? inlineWrapLandsIntact(masked, anchor.ch, text.length)
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
