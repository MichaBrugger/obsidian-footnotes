import { Editor, EditorPosition, MarkdownView, Notice } from "obsidian";

import type FootnotePlugin from "../main";
import {
    footnoteReferenceMatches,
    occurrenceAtCursor,
    referenceAtCursor,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { settleFootnotePopupWithFeedback, toggleCloseFootnotePopup } from "./footnote-popup";
import { adjustFootnotePosition, moveCursorAndSetJumpPoint } from "../editor/cursor-motion";
import {
    createAutonumFootnote,
    createFootnoteReference,
    createMatchingFootnoteDefinition,
    insertInTableCell,
} from "./create-footnote";
import { docContext } from "../editor/doc-context";
import { inlineFootnoteSpanAt, sanitizeInlineFootnoteContent } from "./inline-footnotes";
import { ProtectedCreationNotice, simulatedMaskedLine } from "../editor/insertion-liveness";
import { shouldJumpFromDefinitionToReference, shouldJumpFromReferenceToDefinition } from "./navigation";
import { readingViewActive, viewEditor } from "../editor/obsidian-internals";
import { caretGuardsHandled, warnProtectedCaretIfInside } from "./press-guards";
import { selectionPressHandled, submitActiveNameModal } from "./selection-footnote";
import { activeTableCellEditor, resolveTableCellCursor, runOutsideTableCell, TableCellEditor } from "../editor/table-cursor";

// The command entry points: each press walks the same decision cascade
// against the caret position:
//   1. on a definition line ("[^x]: …")      → jump back to the first reference
//   2. on a reference with an existing definition → jump to (or popup-edit) it
//   3. on a reference with NO definition → create the definition (every key: an
//      accidental press mid-naming must continue the footnote, never
//      nest a new reference into the brackets)
//   4. otherwise → insert a new reference ("[^N]" + definition, or empty "[^]")
// The guards live in press-guards.ts, the creation steps in
// create-footnote.ts, the jump steps in navigation.ts — this file is the
// cascade WIRING plus the shared command preamble (2026-08-12 split).
// Table caveat (see table-cursor.ts): when the caret is in an actively
// edited table cell, reads use the position resolved from the cell's
// sub-editor and reference writes are dispatched INTO that sub-editor.

/**
 * The shared entry preamble of every footnote command: settle a pending
 * popup save, toggle-close an open popup (that press is consumed), then
 * resolve an editable editor. Null means the press must do nothing —
 * popup consumed it, no markdown view, a deferred view without an editor
 * (viewEditor), or Reading view, where the editor API happily edits the
 * HIDDEN buffer: one press invisibly inserted "[^]" and the next press
 * toasted about a reference the user could not see (reported 2026-08-08,
 * probed live; main.ts also disables the commands in the palette, this
 * guards programmatic invocation). ORDER MATTERS: the settle wait comes
 * BEFORE the popup toggle so a same-tick second press sees the popup the
 * first press opened (and closes it) instead of racing past it — and
 * document edits must wait for a just-closed popup's pending definition
 * save, or that save clobbers them.
 *
 * Continuation-passing ON PURPOSE: `action` runs synchronously in the SAME
 * microtask as the settle continuation and the toggle check. Returning the
 * editor to an awaiting caller instead adds a microtask hop between the
 * toggle check and the popup registration the action performs — wide
 * enough for a same-tick second press's toggle check to run first, find no
 * popup, and mint a second footnote (the 2026-07-16 regression class;
 * exactly this happened when the preamble was first extracted as a
 * value-returning helper — caught by the rapid-press smoke tests,
 * 2026-08-11). Exported for the Rename-footnote command (issue #36),
 * which needs the same popup settling: renaming under an open popup would
 * strand its save against the old name.
 */
export async function withEditableEditor(
    plugin: FootnotePlugin,
    action: (doc: Editor) => void | Promise<void>,
): Promise<void> {
    // an open Name-the-footnote modal claims the press FIRST: any footnote
    // command submits it, exactly like Enter (Jason's ask 2026-08-22) —
    // without this the command would act on the editor UNDER the modal,
    // stacking a second modal over the first
    if (submitActiveNameModal()) return;
    await settleFootnotePopupWithFeedback();
    if (toggleCloseFootnotePopup()) return;
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc) return;
    if (readingViewActive(mdView)) return;
    return action(doc);
}

/** The auto-numbered command ("Insert / navigate auto-numbered footnote"): runs the decision cascade, creating "[^N]" + definition when nothing to navigate to. */
export async function insertAutonumFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, (doc) => {
        // an actively edited table cell owns the real caret; getCursor() is
        // stale there, and editing the row via the main editor corrupts the
        // table — reads use the resolved position, writes go through the cell
        const cell = activeTableCellEditor(doc);
        const run = (cursorPosition: EditorPosition) => {
            // a live selection claims the press before any caret guard —
            // converting it is what the press MEANS then (issue #35)
            if (selectionPressHandled(plugin, doc, cell, "autonum", cursorPosition))
                return;
            // guards run INSIDE run(): the sub-editor fallback resolves the
            // real caret first (2026-08-11 review bug #9)
            if (caretGuardsHandled(plugin, doc, cell, cursorPosition)) return;
            const lineText = doc.getLine(cursorPosition.line);
            // ONE shared document view for the whole cascade (perf F1) — built
            // inside run() so the table-fallback path reads post-sync state
            const ctx = docContext(doc);

            if (shouldJumpFromDefinitionToReference(lineText, cursorPosition, plugin, doc, ctx))
                return;
            if (shouldJumpFromReferenceToDefinition(lineText, cursorPosition, plugin, doc, ctx))
                return;
            // caret inside a reference with NO definition: continue the half-built
            // footnote (create its definition) instead of nesting "[^N]" into the
            // brackets — parity with the named and inline keys, so an
            // accidental numbered press mid-naming is just the next step
            // (reported from beta.9 phone testing, 2026-08-09)
            if (createMatchingFootnoteDefinition(lineText, cursorPosition, plugin, doc, ctx))
                return;

            createAutonumFootnote(lineText, cursorPosition, plugin, doc, cell, ctx);
        };
        if (cell) run(resolveTableCellCursor(doc) ?? doc.getCursor());
        else runOutsideTableCell(doc, run);
    });
}

/** The named command ("Insert / navigate named footnote"): same cascade, but creation is two-step — first press inserts "[^]" for name entry, next press (caret on the named reference) creates its definition. */
export async function insertNamedFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, (doc) => {
        // an actively edited table cell owns the real caret; getCursor() is
        // stale there, and editing the row via the main editor corrupts the
        // table — reads use the resolved position, writes go through the cell
        const cell = activeTableCellEditor(doc);
        const run = (cursorPosition: EditorPosition) => {
            // a selection opens the name modal and converts under the typed
            // name — the usual second press can't carry a body statelessly
            // (issue #35; named flavor added 2026-08-13)
            if (selectionPressHandled(plugin, doc, cell, "named", cursorPosition))
                return;
            // guards run INSIDE run() — same rationale as the autonum command
            if (caretGuardsHandled(plugin, doc, cell, cursorPosition)) return;
            const lineText = doc.getLine(cursorPosition.line);
            // ONE shared document view for the whole cascade (perf F1)
            const ctx = docContext(doc);

            if (shouldJumpFromDefinitionToReference(lineText, cursorPosition, plugin, doc, ctx))
                return;
            if (shouldJumpFromReferenceToDefinition(lineText, cursorPosition, plugin, doc, ctx))
                return;

            if (createMatchingFootnoteDefinition(lineText, cursorPosition, plugin, doc, ctx))
                return;
            createFootnoteReference(lineText, cursorPosition, plugin, doc, cell, ctx);
        };
        if (cell) run(resolveTableCellCursor(doc) ?? doc.getCursor());
        else runOutsideTableCell(doc, run);
    });
}

/**
 * When the caret sits strictly inside a "[^x]" reference, handle the press the
 * way the numbered/named commands would — jump to (or popup-edit) the
 * reference's definition, creating it when missing — and report true. The reverse
 * of exitInlineFootnoteIfInside (QOL, 2026-07-20), shared by both inline
 * commands: inserting "^[…]" into a reference would corrupt it ("[^na^[]med]"),
 * so the inline hotkeys navigate there instead.
 */
export function navigateReferenceIfInside(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null,
): boolean {
    const cursorPosition =
        (cell ? resolveTableCellCursor(doc) : null) ?? doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    // raw-line gate first — masking needs the whole document, and this runs
    // on every inline-command press (same rationale as
    // shouldJumpFromReferenceToDefinition)
    const rawReferences = footnoteReferenceMatches(lineText).map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (referenceAtCursor(rawReferences, cursorPosition.ch) === null) return false;

    // the masked twin decides for real: a "[^x]" inside code is plain text,
    // and inserting an inline footnote there is fine (#41 semantics).
    // One shared context past the gate serves the rest of the press (F1)
    const ctx = docContext(doc);
    const occurrences = referenceOccurrences(
        lineText,
        ctx.maskedLine(cursorPosition.line),
    );
    if (occurrenceAtCursor(occurrences, cursorPosition.ch) === null) return false;

    if (shouldJumpFromReferenceToDefinition(lineText, cursorPosition, plugin, doc, ctx))
        return true;
    if (createMatchingFootnoteDefinition(lineText, cursorPosition, plugin, doc, ctx))
        return true;
    // however the cascade resolved (e.g. an invalid name's warning), the
    // press is handled — "^[…]" must never land inside the reference
    return true;
}

// Shared tail of both inline commands: place `text` at the caret (through
// the cell sub-editor inside tables — see the table notes above) with the
// caret landing `caretOffsetInText` characters into the insertion.
function insertInlineText(
    plugin: FootnotePlugin,
    text: string,
    caretOffsetInText: number,
) {
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const doc = mdView && viewEditor(mdView);
    if (!doc) return;

    const cell = activeTableCellEditor(doc);
    if (cell) {
        insertInTableCell(cell, plugin, text, caretOffsetInText);
        return;
    }
    runOutsideTableCell(doc, (cursorPosition) => {
        const lineText = doc.getLine(cursorPosition.line);
        const at = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
        // born-dead check (see simulatedMaskedLine): the "^[…]" must still
        // parse as an inline-footnote span on the masked result — content
        // it carries (pasted inline code) may mask INSIDE the brackets
        const masked = simulatedMaskedLine(doc, at, text);
        if (inlineFootnoteSpanAt(masked, at.ch + 2)?.open !== at.ch) {
            new Notice(ProtectedCreationNotice, 8000);
            return;
        }
        const newCursorPos = { line: at.line, ch: at.ch + caretOffsetInText };
        moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
            { from: at, text },
        ]);
    });
}

/**
 * Inline-footnote command: inserts `^[]` with the caret between the
 * brackets for quick writing. A second press while the cursor is still
 * inside an inline footnote instead hops it just past the closing bracket,
 * so typing continues without reaching for the arrow keys. Inside a
 * regular "[^x]" reference the press navigates like the numbered/named
 * commands instead of nesting.
 */
export async function insertInlineFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, (doc) => {
        const cell = activeTableCellEditor(doc);
        // a live selection claims the press: it becomes "^[…]" in place
        // (issue #35)
        if (selectionPressHandled(plugin, doc, cell, "inline")) return;
        if (caretGuardsHandled(plugin, doc, cell)) return;
        const cursorPosition =
            (cell ? resolveTableCellCursor(doc) : null) ?? doc.getCursor();
        const ctx = docContext(doc);
        // anywhere inside a definition (label, body, continuation), jump
        // back to the reference EXACTLY like the numbered/named keys —
        // nested footnotes are nonstandard markdown the plugin won't
        // create, and a jump beats a toast (Jason's rulings 2026-08-13)
        if (
            !cell &&
            shouldJumpFromDefinitionToReference(
                doc.getLine(cursorPosition.line),
                cursorPosition,
                plugin,
                doc,
                ctx,
            )
        ) {
            return;
        }
        // inside a real reference, navigate instead of nesting "^[]"
        if (navigateReferenceIfInside(plugin, doc, cell)) return;
        // creation in code/math/comment/frontmatter is blocked outright
        if (warnProtectedCaretIfInside(doc, cell, cursorPosition, ctx)) return;

        insertInlineText(plugin, "^[]", 2);
    });
}

/** Inline-footnote paste command: inserts `^[<clipboard>]` with the caret after it. Inside a "[^x]" reference it navigates like the named command instead (the clipboard stays untouched). */
export async function pasteInlineFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, async (doc) => {
        const pasteCell = activeTableCellEditor(doc);
        // a selection redirects to the auto-numbered/inline keys — the
        // clipboard already carries this key's body (issue #35); before the
        // clipboard await, like the guards below
        if (selectionPressHandled(plugin, doc, pasteCell, "paste")) return;
        // the same guards every other insert command runs (missed here until
        // the 2026-08-07 QOL sweep; pinned by test/paste-inline-in-inline.test.ts)
        if (caretGuardsHandled(plugin, doc, pasteCell)) return;
        const pastePosition =
            (pasteCell ? resolveTableCellCursor(doc) : null) ?? doc.getCursor();
        const pasteCtx = docContext(doc);
        // inside a definition, jump back like every other footnote key —
        // before the clipboard await, so a handled press never reads it
        if (
            !pasteCell &&
            shouldJumpFromDefinitionToReference(
                doc.getLine(pastePosition.line),
                pastePosition,
                plugin,
                doc,
                pasteCtx,
            )
        ) {
            return;
        }
        if (navigateReferenceIfInside(plugin, doc, pasteCell)) return;
        // creation in code/math/comment/frontmatter is blocked outright —
        // before the clipboard await, so a blocked press never reads it
        if (warnProtectedCaretIfInside(doc, pasteCell, pastePosition, pasteCtx)) {
            return;
        }

        // read the clipboard BEFORE resolving positions — it's the only await,
        // and everything position-dependent should happen after it
        let raw: string;
        try {
            raw = await navigator.clipboard.readText();
        } catch {
            new Notice("Couldn't read the clipboard.");
            return;
        }
        // re-check the view mode after the await: the user (or a script)
        // can flip to Reading view while the clipboard prompt is up, and
        // the editor API would then edit the hidden buffer (Kimi,
        // 2026-08-11 review — same hazard the preamble guards against)
        const viewAfterAwait =
            plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!viewAfterAwait || readingViewActive(viewAfterAwait)) return;
        const content = sanitizeInlineFootnoteContent(raw);
        if (!content) {
            new Notice("The clipboard is empty, so there is nothing to put in an inline footnote.");
            return;
        }
        const text = `^[${content}]`;
        insertInlineText(plugin, text, text.length);
    });
}
