import {
    Editor,
    EditorChange,
    EditorPosition,
    MarkdownView,
    Notice,
} from "obsidian";

import type FootnotePlugin from "./main";
import {
    computeNextFootnoteNumber,
    emptyReferenceStart,
    footnoteReferenceMatches,
    idListIncludes,
    isValidFootnoteName,
    occurrenceAtCursor,
    referenceAtCursor,
    referenceOccurrences,
} from "./footnote-grammar";
import { footnotePopupBusy, openFootnotePopup, popupEditingAvailable, runAfterNextPopupSettle, settleFootnotePopupWithFeedback, toggleCloseFootnotePopup } from "./footnote-popup";
import { activeFootnotePrefix, footnotePrefix, footnotePrefixFromEditor, footnotePrefixProblem } from "./footnote-prefix";
import { adjustFootnotePosition, endOfWordOffset, moveCursorAndSetJumpPoint } from "./cursor-motion";
import { buildDefinitionAppend } from "./definition-append";
import { DocContext, docContext, docLines, listExistingFootnoteDefinitions } from "./doc-context";
import { shouldJumpFromDefinitionToReference, shouldJumpFromReferenceToDefinition } from "./navigation";
import { exitInlineFootnoteIfInside, sanitizeInlineFootnoteContent, warnEmptyInlineFootnoteIfInside } from "./inline-footnotes";
import { lintAfterFootnoteCreation } from "./linting/linter";
import { maskInlineRegions, maskedLineAt } from "./markdown-scan";
import { readingViewActive, viewEditor } from "./obsidian-internals";
import { activeTableCellEditor, resolveTableCellCursor, runOutsideTableCell, TableCellEditor } from "./table-cursor";

// Core logic for both hotkey commands. Each press walks the same decision
// cascade against the caret position:
//   1. on a definition line ("[^x]: …")      → jump back to the first reference
//   2. on a reference with an existing definition → jump to (or popup-edit) it
//   3. on a reference with NO definition → create the definition (every key: an
//      accidental press mid-naming must continue the footnote, never
//      nest a new reference into the brackets)
//   4. otherwise → insert a new reference ("[^N]" + definition, or empty "[^]")
// Table caveat (see table-cursor.ts): when the caret is in an actively
// edited table cell, reads use the position resolved from the cell's
// sub-editor and reference writes are dispatched INTO that sub-editor.

// Insert `text` at the caret of an actively edited table cell, through the
// cell's own editor so the widget handles the markdown write-back. Respects
// the end-of-word setting and leaves the cell caret `caretOffsetInText`
// characters into the inserted text (focus stays in the cell).
export function insertInTableCell(
    cell: TableCellEditor,
    plugin: FootnotePlugin,
    text: string,
    caretOffsetInText: number,
) {
    const cellText = cell.state.doc.toString();
    const head = cell.state.selection.main.head;
    const at = plugin.settings.insertAtEndOfWord
        ? endOfWordOffset(cellText, head)
        : head;
    cell.dispatch({
        changes: { from: at, insert: text },
        selection: { anchor: at + caretOffsetInText },
    });
}

// "Lint on footnote creation", popup flavor: the lint must wait for the
// popup that is about to open to close and settle — linting under it could
// renumber the id it is bound to. Registered BEFORE openFootnotePopup; the
// returned canceller is for its fallback path, where the press degrades to
// the jump flow and the immediate trigger takes over.
// Stryker disable all: popup-settle scheduling against the live workspace —
// smoke-test territory, unreachable from units (coverage-verified 2026-08-11)
function scheduleCreationLintAfterPopup(plugin: FootnotePlugin): () => void {
    if (!plugin.settings.lintOnFootnoteCreation) return () => {};
    const path =
        plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path;
    return runAfterNextPopupSettle(() => {
        lintAfterFootnoteCreation(plugin, false, path);
    });
}
// Stryker restore all

//FUNCTIONS FOR AUTONUMBERED FOOTNOTES

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
 * 2026-08-11).
 */
async function withEditableEditor(
    plugin: FootnotePlugin,
    action: (doc: Editor) => void | Promise<void>,
): Promise<void> {
    await settleFootnotePopupWithFeedback();
    if (toggleCloseFootnotePopup()) return;
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const doc = mdView && viewEditor(mdView);
    if (!mdView || !doc) return;
    if (readingViewActive(mdView)) return;
    return action(doc);
}

/**
 * The caret guards every footnote command runs before acting, IN THIS
 * ORDER (load-bearing): an EMPTY inline footnote asks for its text before
 * the filled-inline "done typing" hop can trigger; the hop beats the
 * reference guards (an inline body can contain reference-shaped text); an
 * abandoned "[^]" asks for a name instead of nesting; an untouched
 * "[^7-]" prefix placeholder asks for a suffix. True = the press was
 * consumed (toast or hop) and the command stops. The inline/paste
 * commands additionally navigate from inside a real reference
 * (navigateReferenceIfInside) at their call sites — the autonum/named
 * commands run their own jump cascade instead.
 *
 * `cursorPosition` is the RESOLVED caret: the autonum/named commands call
 * this inside runOutsideTableCell's callback, whose sub-editor fallback
 * resolves the real position — the guards used to run before it with a
 * stale getCursor() (2026-08-11 review bug #9).
 */
function caretGuardsHandled(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null,
    cursorPosition?: EditorPosition,
): boolean {
    if (warnEmptyInlineFootnoteIfInside(doc, cell, cursorPosition)) return true;
    if (exitInlineFootnoteIfInside(doc, cell, cursorPosition)) return true;
    if (warnEmptyReferenceIfInside(doc, cell, cursorPosition)) return true;
    if (warnPrefilledReferenceIfInside(plugin, doc, cell, cursorPosition)) {
        return true;
    }
    return false;
}

/**
 * Footnote CREATION is blocked when the caret sits inside code, math, a
 * comment, or frontmatter (Jason's rule 2026-08-12 — always on, inline
 * spans included): a reference minted there is dead text Obsidian never
 * renders, which the next lint's orphan handling then deletes. Runs at
 * the CREATION steps only — navigation never reaches protected text (its
 * masked gates fall through). True = warned, press consumed.
 */
function warnProtectedCaretIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
    cursorPosition: EditorPosition,
    ctx: DocContext,
): boolean {
    let inside: boolean;
    if (cell) {
        // cell text is a single line, so line-local masking suffices
        inside = caretInsideMaskedSpan(
            maskInlineRegions(cell.state.doc.toString()),
            cell.state.selection.main.head,
            false,
            false,
        );
    } else {
        const { scan } = ctx;
        const line = cursorPosition.line;
        // at the line's edges, "inside" is decided by whether an open
        // region crosses that edge: a caret at ch 0 of a comment CLOSER
        // line, or at the end of a line whose tail opened a region, is
        // inside it even though the neighboring character is off-line
        const openAtStart =
            scan.startsInComment[line] || scan.startsInMath[line];
        const openAtEnd =
            line + 1 < ctx.lines.length
                ? scan.startsInComment[line + 1] || scan.startsInMath[line + 1]
                : scan.endsProtected;
        inside =
            scan.isProtected[line] ||
            caretInsideMaskedSpan(
                ctx.maskedLine(line),
                cursorPosition.ch,
                openAtStart,
                openAtEnd,
            );
    }
    if (!inside) return false;
    new Notice(
        "No footnote was created: footnotes can't go inside code, math, or other protected text.",
        8000,
    );
    return true;
}

/** Whether `ch` sits STRICTLY inside a masked (NUL) span — the text on both sides is claimed. Boundaries are fine: just before an opener or just after a closer inserts outside the span. `openAtStart`/`openAtEnd` stand in for the off-line neighbor at ch 0 / end of line. */
function caretInsideMaskedSpan(
    masked: string,
    ch: number,
    openAtStart: boolean,
    openAtEnd: boolean,
): boolean {
    const before = ch > 0 ? masked[ch - 1] === "\0" : openAtStart;
    const after = ch < masked.length ? masked[ch] === "\0" : openAtEnd;
    return before && after;
}

/**
 * The shared creation tail of the autonum and named commands' popup path:
 * open the popup editor bound to the new definition. Its fallback (embed
 * registry unavailable, or a late failure) jumps to the definition
 * instead — and there a popup that failed AFTER its DOM existed is still
 * settling its teardown save, so an immediate lint would no-op behind the
 * busy gate; the settle-deferred lint registered here fires instead (E32).
 */
function openPopupForNewDefinition(
    plugin: FootnotePlugin,
    doc: Editor,
    cursorPosition: EditorPosition,
    footnoteId: string,
    definitionCursor: EditorPosition,
) {
    const cancelCreationLint = scheduleCreationLintAfterPopup(plugin);
    void openFootnotePopup(plugin, footnoteId, () => {
        moveCursorAndSetJumpPoint(doc, cursorPosition, definitionCursor, plugin, undefined, true);
        if (footnotePopupBusy()) return;
        cancelCreationLint();
        lintAfterFootnoteCreation(plugin, true);
    });
}

/** The auto-numbered command ("Insert / navigate auto-numbered footnote"): runs the decision cascade, creating "[^N]" + definition when nothing to navigate to. */
export async function insertAutonumFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, (doc) => {
        // an actively edited table cell owns the real caret; getCursor() is
        // stale there, and editing the row via the main editor corrupts the
        // table — reads use the resolved position, writes go through the cell
        const cell = activeTableCellEditor(doc);
        const run = (cursorPosition: EditorPosition) => {
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

/** Cascade step 4 (autonum): insert the next-numbered reference at the caret (through `cell` when in a table) and append its definition, then popup or jump per settings. */
export function createAutonumFootnote(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null = null,
    ctx: DocContext = docContext(doc),
): boolean {
    // creation in code/math/comment/frontmatter is blocked outright
    if (warnProtectedCaretIfInside(doc, cell, cursorPosition, ctx)) return true;

    // create new footnote with the next numerical index — namespaced by the
    // note's footnote-prefix property when set (#31) — reading the editor
    // document (the view's data buffer lags editor edits by a tick, so it
    // can't be trusted here)
    const markdownText = ctx.lines.join("\n");
    const prefix = activeFootnotePrefix(plugin, footnotePrefix(markdownText));
    // an invalid prefix blocks the insert outright (the Notice already
    // explained why) — no unprefixed fallback footnote to clean up; the
    // press was still consumed
    if (prefix === null) return true;
    const currentMax = computeNextFootnoteNumber(
        markdownText,
        prefix,
        ctx.maskedLines().join("\n"),
    );

    const footnoteId = `${prefix}${currentMax}`;
    const footnoteReference = `[^${footnoteId}]`;

    // "first footnote" = first DEFINITION, matching the named command and
    // move-to-bottom's fixed point — the old "&& currentMax === 1" skipped
    // the section heading when the note's only artifact was an orphan
    // reference (2026-08-11 review bug #8)
    const isFirstFootnote = listExistingFootnoteDefinitions(doc, ctx).length === 0;

    if (cell) {
        // the reference goes through the cell's own editor (never the main
        // editor — that races the cell's sync-back and corrupts the table);
        // the definition append is outside the table, so the main editor is safe
        insertInTableCell(cell, plugin, footnoteReference, footnoteReference.length);
        const definition = buildDefinitionAppend(doc, footnoteId, isFirstFootnote, plugin, ctx);
        // the phantom-frontmatter prepend (see buildDefinitionAppend) rides
        // the same transaction; it edits above the table, which is outside
        // the cell sub-editor's region and therefore safe (issue #28 policy)
        const definitionChanges = definition.prepend
            ? [definition.prepend, definition.change]
            : [definition.change];
        if (popupEditingAvailable(plugin)) {
            doc.transaction({ changes: definitionChanges });
            void openFootnotePopup(plugin, footnoteId, () => {
                moveCursorAndSetJumpPoint(doc, cursorPosition, definition.cursor, plugin, undefined, true);
            });
        } else {
            moveCursorAndSetJumpPoint(doc, cursorPosition, definition.cursor, plugin, definitionChanges, true);
        }
        return true;
    }

    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
    const definition = buildDefinitionAppend(doc, footnoteId, isFirstFootnote, plugin, ctx);
    const changes: EditorChange[] = [
        { from: cursorPosition, text: footnoteReference },
        definition.change,
    ];
    // the phantom-frontmatter prepend (see buildDefinitionAppend) rides the
    // same transaction; it shifts every post-transaction line down by one
    if (definition.prepend) changes.push(definition.prepend);
    const lineShift = definition.prepend ? 1 : 0;

    if (popupEditingAvailable(plugin)) {
        // type the definition in a popup instead of jumping to the bottom;
        // the cursor only moves past the new reference
        const afterReference = { line: cursorPosition.line + lineShift, ch: cursorPosition.ch + footnoteReference.length };
        doc.transaction({ changes, selection: { from: afterReference } });
        openPopupForNewDefinition(plugin, doc, cursorPosition, footnoteId, definition.cursor);
    } else {
        moveCursorAndSetJumpPoint(doc, cursorPosition, definition.cursor, plugin, changes, true);
        lintAfterFootnoteCreation(plugin, true);
    }
    return true;
}

//FUNCTIONS FOR INLINE FOOTNOTES (^[...])

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
        const newCursorPos = { line: at.line, ch: at.ch + caretOffsetInText };
        moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
            { from: at, text },
        ]);
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
        if (caretGuardsHandled(plugin, doc, cell)) return;
        // inside a real reference, navigate instead of nesting "^[]"
        if (navigateReferenceIfInside(plugin, doc, cell)) return;
        // creation in code/math/comment/frontmatter is blocked outright
        const cursorPosition =
            (cell ? resolveTableCellCursor(doc) : null) ?? doc.getCursor();
        if (warnProtectedCaretIfInside(doc, cell, cursorPosition, docContext(doc)))
            return;

        insertInlineText(plugin, "^[]", 2);
    });
}

/** Inline-footnote paste command: inserts `^[<clipboard>]` with the caret after it. Inside a "[^x]" reference it navigates like the named command instead (the clipboard stays untouched). */
export async function pasteInlineFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, async (doc) => {
        const pasteCell = activeTableCellEditor(doc);
        // the same guards every other insert command runs (missed here until
        // the 2026-08-07 QOL sweep; pinned by test/paste-inline-in-inline.test.ts)
        if (caretGuardsHandled(plugin, doc, pasteCell)) return;
        if (navigateReferenceIfInside(plugin, doc, pasteCell)) return;
        // creation in code/math/comment/frontmatter is blocked outright —
        // before the clipboard await, so a blocked press never reads it
        const pastePosition =
            (pasteCell ? resolveTableCellCursor(doc) : null) ?? doc.getCursor();
        if (
            warnProtectedCaretIfInside(doc, pasteCell, pastePosition, docContext(doc))
        ) {
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

//FUNCTIONS FOR NAMED FOOTNOTES

/** The named command ("Insert / navigate named footnote"): same cascade, but creation is two-step — first press inserts "[^]" for name entry, next press (caret on the named reference) creates its definition. */
export async function insertNamedFootnote(plugin: FootnotePlugin) {
    await withEditableEditor(plugin, (doc) => {
        // an actively edited table cell owns the real caret; getCursor() is
        // stale there, and editing the row via the main editor corrupts the
        // table — reads use the resolved position, writes go through the cell
        const cell = activeTableCellEditor(doc);
        const run = (cursorPosition: EditorPosition) => {
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

/** Cascade step 3 (numbered, named, and the inline keys via navigateReferenceIfInside): caret on a reference with no definition → append the matching definition (or warn on an invalid name). Returns true when it handled the press. The note's footnote-prefix is NOT applied here — it goes in at bracket creation (createFootnoteReference), where the user can see it. */
export function createMatchingFootnoteDefinition(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx?: DocContext,
): boolean {
    // Create matching footnote definition for footnote reference

    // is the cursor inside a footnote reference on this line?
    // does that reference have a definition line?
    // if not, create it and place cursor there
    // (raw-line gate first, masked re-check after — same rationale and #41
    // semantics as navigation's shouldJumpFromReferenceToDefinition)
    const rawReferences = footnoteReferenceMatches(lineText).map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (referenceAtCursor(rawReferences, cursorPosition.ch) === null) {
        return false;
    }

    // built only past the raw gate (perf F1). referenceOccurrences
    // re-slices each raw name — a code span inside the name masks to NULs,
    // and creating a definition from the masked name wrote literal NUL
    // bytes into the note (bug-masked-name-identity)
    ctx ??= docContext(doc);
    const target = occurrenceAtCursor(
        referenceOccurrences(lineText, ctx.maskedLine(cursorPosition.line)),
        cursorPosition.ch,
    );

    if (target !== null) {
        const footnoteId = target.name;

        // a spaced or backticked name is an authoring mistake Obsidian
        // won't render; warn instead of creating a definition that can't work
        if (!isValidFootnoteName(footnoteId)) {
            const offender = footnoteId.includes("`")
                ? "backticks"
                : "spaces";
            new Notice(
                `Footnote name "${footnoteId}" contains ${offender}, so Obsidian won't render it as a footnote. Remove the ${offender}.`,
                8000,
            );
            return true;
        }

        const list = listExistingFootnoteDefinitions(doc, ctx);

        // ids are case-insensitive — a "[^note]:" definition already covers
        // a "[^Note]" reference, so this must navigate, not create a duplicate
        if (!idListIncludes(list, footnoteId)) {
            const definition = buildDefinitionAppend(doc, footnoteId, list.length === 0, plugin, ctx);
            // the phantom-frontmatter prepend rides the same
            // transaction (see buildDefinitionAppend)
            const definitionChanges = definition.prepend
                ? [definition.prepend, definition.change]
                : [definition.change];

            if (popupEditingAvailable(plugin)) {
                // type the definition in a popup instead of jumping to the
                // bottom; the cursor stays on the reference
                doc.transaction({ changes: definitionChanges });
                openPopupForNewDefinition(plugin, doc, cursorPosition, footnoteId, definition.cursor);
            } else {
                moveCursorAndSetJumpPoint(doc, cursorPosition, definition.cursor, plugin, definitionChanges, true);
                lintAfterFootnoteCreation(plugin, true);
            }

            return true;
        }
        // the reference already has a definition — not this step's
        // press to handle; the cascade continues
        return false;
    }
    return false;
}

/**
 * When the caret sits inside an untouched prefilled reference — "[^7-]",
 * exactly the note's footnote-prefix with no name typed yet — leave the
 * caret where it is, ask for a suffix via a Notice, and report true. The
 * prefilled reference is the prefix-era twin of the empty "[^]" placeholder;
 * a press inside it must never create a footnote named after the bare
 * prefix. It used to hop the caret out instead (like "[^]"), but staying
 * put with an explanation is easier to understand (2026-08-05).
 */
export function warnPrefilledReferenceIfInside(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null,
    cursorPosition?: EditorPosition,
): boolean {
    if (!plugin.settings.enableFootnotePrefix) return false;
    // cheap gate before any document work: no "[^" near the caret means no
    // placeholder to warn about, and this guard runs on EVERY command press
    const rawText = cell
        ? cell.state.doc.toString()
        : doc.getLine((cursorPosition ?? doc.getCursor()).line);
    if (!rawText.includes("[^")) return false;
    const prefix = footnotePrefixFromEditor(doc);
    // silent validity check — the invalid-prefix Notice belongs to the
    // insert path, not to every caret movement guard
    if (!prefix || footnotePrefixProblem(prefix) !== null) return false;
    const placeholder = `[^${prefix}]`;
    if (!caretInsidePlaceholder(doc, cell, placeholder, cursorPosition)) {
        return false;
    }
    new Notice("Please add a footnote suffix after the prefix.");
    return true;
}

/**
 * Whether the caret sits strictly inside a live occurrence of `placeholder`
 * ("[^]" or the prefilled "[^7-]"), in the cell's text or the caret's line.
 * A raw hit is confirmed against the code-masked text — a placeholder-shaped
 * fragment inside inline code or a fence is plain text (#41 semantics), and
 * warning there would block a legitimate insert. The raw gate keeps the
 * whole-document masking off the hot path (this runs on every press).
 */
function caretInsidePlaceholder(
    doc: Editor,
    cell: TableCellEditor | null,
    placeholder: string,
    cursorPosition?: EditorPosition,
): boolean {
    if (cell) {
        const head = cell.state.selection.main.head;
        const cellText = cell.state.doc.toString();
        if (emptyReferenceStart(cellText, head, placeholder) === null) return false;
        // cell text is a single line, so line-local masking suffices
        return emptyReferenceStart(maskInlineRegions(cellText), head, placeholder) !== null;
    }
    const pos = cursorPosition ?? doc.getCursor();
    const lineText = doc.getLine(pos.line);
    if (emptyReferenceStart(lineText, pos.ch, placeholder) === null) {
        return false;
    }
    const maskedLine = maskedLineAt(docLines(doc), pos.line);
    return emptyReferenceStart(maskedLine, pos.ch, placeholder) !== null;
}

/**
 * When the caret sits inside an abandoned empty reference "[^]", leave it
 * where it is, ask for a name via a Notice, and report true. Shared by
 * every footnote command (QOL sweep, 2026-08-07): "[^]" is invisible to
 * the reference regexes (they require a non-empty name), so without this
 * guard the numbered/inline commands nested their insertion INTO the
 * brackets ("[^[^1]]") and the named command silently hopped the caret
 * out — a warning is the one response that tells the user what the
 * fragment is and how to fix it.
 */
function warnEmptyReferenceIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
    cursorPosition?: EditorPosition,
): boolean {
    if (!caretInsidePlaceholder(doc, cell, "[^]", cursorPosition)) return false;
    new Notice(
        "This footnote reference is empty. Type a name between the brackets.",
        8000,
    );
    return true;
}

/** Cascade step 4 (named): insert an empty reference (through `cell` when in a table) ready for name entry — "[^]" with the caret between the brackets, or "[^7-]" with the caret after the prefix when the note's footnote-prefix is active, so the namespace is visible while the name is typed (requested 2026-07-20). A press with the caret still inside an empty "[^]" never reaches this step — warnEmptyReferenceIfInside claims it at the command entry — but the hop-out branches below stay as a last line of defense against nesting "[^[^]]". */
export function createFootnoteReference(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null = null,
    ctx: DocContext = docContext(doc),
): boolean {
    //create empty footnote reference for name input, cursor after [^ and any
    //prefix. The prefix gate runs AFTER the second-press hop checks: an
    //invalid prefix blocks reference CREATION (toast only, nothing to clean
    //up — reported 2026-08-07), but never plain caret navigation.
    // footnotePrefixFromEditor stops at the closing frontmatter fence —
    // the old doc.getValue() materialized the whole document per press
    // (the half of F1 this path had missed)
    const resolvePrefix = () =>
        plugin.settings.enableFootnotePrefix
            ? activeFootnotePrefix(plugin, footnotePrefixFromEditor(doc))
            : "";

    if (cell) {
        const cellText = cell.state.doc.toString();
        // masked confirm like caretInsidePlaceholder: a "[^]"-shaped
        // fragment inside inline code is plain text (#41 semantics)
        const inEmpty = emptyReferenceStart(cellText, cell.state.selection.main.head);
        if (
            inEmpty !== null &&
            emptyReferenceStart(
                maskInlineRegions(cellText),
                cell.state.selection.main.head,
            ) !== null
        ) {
            cell.dispatch({ selection: { anchor: inEmpty + "[^]".length } });
            return true;
        }
        // creation inside a cell's inline code/math span is blocked
        if (warnProtectedCaretIfInside(doc, cell, cursorPosition, ctx)) {
            return true;
        }
        const prefix = resolvePrefix();
        if (prefix === null) return true;
        // through the cell's own editor (never the main editor — that races
        // the cell's sync-back and corrupts the table); the caret lands
        // inside the brackets and focus stays in the cell for name entry
        insertInTableCell(cell, plugin, `[^${prefix}]`, 2 + prefix.length);
        return true;
    }

    // DOCUMENT-aware masking, exactly like the warnEmptyReferenceIfInside
    // guard: line-local masking can't see a surrounding fence, so guard and
    // hop disagreed there and the caret hopped inside protected text
    // (2026-08-11 review bug #6)
    const inEmpty = emptyReferenceStart(lineText, cursorPosition.ch);
    if (
        inEmpty !== null &&
        emptyReferenceStart(
            maskedLineAt(docLines(doc), cursorPosition.line),
            cursorPosition.ch,
        ) !== null
    ) {
        doc.setCursor({ line: cursorPosition.line, ch: inEmpty + "[^]".length });
        return true;
    }

    // creation in code/math/comment/frontmatter is blocked outright — but
    // AFTER the hop check above, so plain caret navigation out of a live
    // "[^]" never gets a bogus toast
    if (warnProtectedCaretIfInside(doc, null, cursorPosition, ctx)) return true;

    const prefix = resolvePrefix();
    if (prefix === null) return true;
    const emptyReference = `[^${prefix}]`;
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
    const newCursorPos = {
        line: cursorPosition.line,
        ch: cursorPosition.ch + 2 + prefix.length,
    };
    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
        { from: cursorPosition, text: emptyReference },
    ]);
    return true;
}
