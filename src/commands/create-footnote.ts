import {
    Editor,
    EditorChange,
    EditorPosition,
    Notice,
} from "obsidian";

import type FootnotePlugin from "../main";
import {
    computeNextFootnoteNumber,
    emptyReferenceStart,
    idListIncludes,
    isValidFootnoteName,
} from "../parsing/footnote-grammar";
import { openFootnotePopup, popupEditingAvailable } from "./footnote-popup";
import { jumpToFootnoteDefinition } from "./navigation";
import { activeFootnotePrefix, footnotePrefixFromEditor } from "../parsing/footnote-prefix";
import { adjustFootnotePosition, endOfWordOffset, moveCursorAndSetJumpPoint } from "../editor/cursor-motion";
import { buildDefinitionAppend } from "./definition-append";
import {
    DocContext,
    docContext,
    listExistingFootnoteDefinitions,
    referenceOccurrenceAtCursor,
} from "../editor/doc-context";
import { inlineWrapLandsIntact } from "./inline-footnotes";
import {
    ProtectedCreationNotice,
    safeInsertionCh,
    simulatedMaskedLine,
    verifyLiveFootnoteInsertion,
} from "../editor/insertion-liveness";
import { lintAfterFootnoteCreation } from "../linting/linter";
import { maskInlineRegions, maskedLineAt } from "../parsing/markdown-scan";
import { warnDefinitionCaretIfInside, warnProtectedCaretIfInside } from "./press-guards";
import { TableCellEditor } from "../editor/table-cursor";

// The creation steps of the command cascade: mint a reference, append its
// definition, and hand off to the popup (or jump) — each step verified
// against the insertion-liveness kit before any edit is dispatched. This
// module is the linter's SOLE importer besides main.ts wiring: creation is
// where lint-on-footnote-creation triggers. Split out of the all-in-one
// commands file 2026-08-12.

// Insert `text` at the caret of an actively edited table cell, through the
// cell's own editor so the widget handles the markdown write-back. Respects
// the end-of-word setting and leaves the cell caret `caretOffsetInText`
// characters into the inserted text (focus stays in the cell). False =
// the insertion was refused (it would be born dead — see the liveness
// check) and NOTHING was dispatched: a caller pairing it with a definition
// append must skip that too.
export function insertInTableCell(
    cell: TableCellEditor,
    plugin: FootnotePlugin,
    text: string,
    caretOffsetInText: number,
): boolean {
    const cellText = cell.state.doc.toString();
    const head = cell.state.selection.main.head;
    // safeInsertionCh, same as adjustFootnotePosition: an insertion after
    // an escaping backslash or an unescaped "^" would be swallowed
    // (bug-insert-after-backslash)
    const at = safeInsertionCh(
        cellText,
        plugin.settings.insertAtEndOfWord
            ? endOfWordOffset(cellText, head)
            : head,
    );
    return dispatchCellEditIfLive(cell, text, at, at, caretOffsetInText);
}

/** Replace `[from, to)` of an actively edited table cell with `text` — the selection-to-footnote conversion's cell writer (issue #35). Same liveness refusal contract as insertInTableCell; the replaced range is the cell's own selection, so no end-of-word adjustment applies. */
export function replaceInTableCell(
    cell: TableCellEditor,
    text: string,
    from: number,
    to: number,
    caretOffsetInText: number,
): boolean {
    return dispatchCellEditIfLive(cell, text, from, to, caretOffsetInText);
}

// The shared cell write: refuse born-dead text, else dispatch through the
// cell's own editor (never the main editor — that races the cell's
// sync-back and corrupts the table) with the caret left inside the edit.
function dispatchCellEditIfLive(
    cell: TableCellEditor,
    text: string,
    from: number,
    to: number,
    caretOffsetInText: number,
): boolean {
    const cellText = cell.state.doc.toString();
    // the edit can COMPLETE a construct around it and be masked into it at
    // birth — "$…$" pairing is the found case (command-press property
    // suite, 2026-08-12); cell text is a single line, so line-local
    // masking decides
    const simulatedCell = cellText.slice(0, from) + text + cellText.slice(to);
    const maskedCell = maskInlineRegions(simulatedCell);
    const live = text.startsWith("^[")
        ? // pasted content may carry its own inline code (masked inside the
          // brackets) — the inline SPAN surviving INTACT is what matters
          inlineWrapLandsIntact(maskedCell, from, text.length)
        : maskedCell.slice(from, from + text.length) === text;
    if (!live) {
        new Notice(ProtectedCreationNotice, 8000);
        return false;
    }
    cell.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + caretOffsetInText },
    });
    return true;
}

/**
 * The shared creation tail of the popup path: lint FIRST, then open the
 * popup editor bound to the new definition. The lint used to be deferred
 * to the popup's teardown settle, which left the note visibly unlinted
 * the whole time the popup was up (Jason's ask 2026-08-27); linting
 * before the popup BINDS also retires the hazard the deferral existed
 * for — a mid-popup rename of the bound id — because the popup opens on
 * the POST-lint id (lintAfterFootnoteCreation returns the relocated
 * name; see its contract). The fallback (embed registry unavailable, or
 * a late failure) jumps to the definition instead — by NAME, since the
 * pre-lint `definitionCursor` coordinates may be stale after the lint
 * moved or renumbered the definition; the raw coordinates remain as the
 * last resort when even the name lookup fails. Every definition-backed
 * insertion reaches here through landDefinitionBackedInsertion below
 * (2026-08-25 unification).
 */
// Stryker disable all: popup handoff against the live workspace — smoke-test
// territory, unreachable from units (coverage-verified by the 2026-08-12
// re-baseline: every mutant in this function was no-coverage)
function openPopupForNewDefinition(
    plugin: FootnotePlugin,
    doc: Editor,
    cursorPosition: EditorPosition,
    footnoteId: string,
    definitionCursor: EditorPosition,
    seededBody?: string,
) {
    const relocated = lintAfterFootnoteCreation(plugin, false, seededBody);
    const effectiveId = relocated ?? footnoteId;
    void openFootnotePopup(plugin, effectiveId, () => {
        if (!jumpToFootnoteDefinition(effectiveId, cursorPosition, plugin, doc)) {
            moveCursorAndSetJumpPoint(doc, cursorPosition, definitionCursor, plugin, undefined, true);
        }
    });
}
// Stryker restore all

/**
 * The main-editor landing shared by every definition-backed insertion —
 * single caret, multi-caret, and selection conversion each cloned this
 * branch before 2026-08-25: apply `changes` and hand the new definition
 * to the user, in the popup (the caret parks just past the primary new
 * reference; openPopupForNewDefinition lints first and binds the popup
 * to the post-lint id) or by jumping to `definitionCursor` and linting
 * with the caret reland. The landing owns the creation lint on BOTH
 * arms since Jason's parity ruling (2026-08-25, made pre-popup
 * 2026-08-27): anything that creates a footnote lints when the setting
 * says so. `seededBody` is the conversions' exact definition body — how
 * the lint re-finds the new footnote after renumbering or moving it
 * (a plain insert's definition is the unique EMPTY one instead).
 * Cell creations stay out (see landCellDefinitionAppend).
 */
export function landDefinitionBackedInsertion(opts: {
    plugin: FootnotePlugin;
    doc: Editor;
    changes: EditorChange[];
    /** where the press began — popup close and jump both return relative to it */
    origin: EditorPosition;
    footnoteId: string;
    /** where the definition text awaits the caret (post-transaction coordinates) */
    definitionCursor: EditorPosition;
    /** the popup arm's caret landing just past the primary new reference — omitted by the definition-only append (createMatchingFootnoteDefinition), whose caret already sits on the existing reference */
    afterReference?: EditorPosition;
    /** the seeded definition body a selection conversion wrote (label line onward, continuation indent included); omitted by every empty-definition press */
    seededBody?: string;
}): void {
    // Stryker disable next-line ConditionalExpression, BlockStatement: units run popup-off, so which arm fires is smoke territory — the full smoke suite drives both
    if (popupEditingAvailable(opts.plugin)) {
        // Stryker disable all: popup arm — units run popup-off, so mutants
        // here are no-coverage noise; smoke territory (verified 2026-08-12)
        opts.doc.transaction(
            opts.afterReference
                ? {
                      changes: opts.changes,
                      selection: { from: opts.afterReference },
                  }
                : { changes: opts.changes },
        );
        openPopupForNewDefinition(
            opts.plugin,
            opts.doc,
            opts.origin,
            opts.footnoteId,
            opts.definitionCursor,
            opts.seededBody,
        );
        // Stryker restore all
    } else {
        moveCursorAndSetJumpPoint(
            opts.doc,
            opts.origin,
            opts.definitionCursor,
            opts.plugin,
            opts.changes,
            true,
        );
        lintAfterFootnoteCreation(opts.plugin, true, opts.seededBody);
    }
}

/**
 * The cell-flavor landing shared by the autonum cell insert and the cell
 * selection conversion: the reference is already written through the
 * cell's OWN editor (never the main editor — that races the cell's
 * sync-back, issue #28), so only the definition changes touch the main
 * editor here. No creation lint on either arm: table-cell creations
 * skip the trigger entirely (see lintAfterFootnoteCreation's contract).
 */
export function landCellDefinitionAppend(opts: {
    plugin: FootnotePlugin;
    doc: Editor;
    definitionChanges: EditorChange[];
    origin: EditorPosition;
    footnoteId: string;
    definitionCursor: EditorPosition;
}): void {
    // Stryker disable next-line ConditionalExpression, BlockStatement: units run popup-off, so which arm fires is smoke territory — the full smoke suite drives both
    if (popupEditingAvailable(opts.plugin)) {
        // Stryker disable all: popup arm — units run popup-off, so mutants
        // here are no-coverage noise; smoke territory (verified 2026-08-12)
        opts.doc.transaction({ changes: opts.definitionChanges });
        void openFootnotePopup(opts.plugin, opts.footnoteId, () => {
            moveCursorAndSetJumpPoint(
                opts.doc,
                opts.origin,
                opts.definitionCursor,
                opts.plugin,
                undefined,
                true,
            );
        });
        // Stryker restore all
    } else {
        moveCursorAndSetJumpPoint(
            opts.doc,
            opts.origin,
            opts.definitionCursor,
            opts.plugin,
            opts.definitionChanges,
            true,
        );
    }
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
    // ... and inside another footnote's definition (continuation lines —
    // the label line's presses were claimed by the jump steps above)
    if (warnDefinitionCaretIfInside(doc, cell, cursorPosition, ctx)) return true;

    // create new footnote with the next numerical index — namespaced by the
    // note's footnote-prefix property when set (#31) — reading the editor
    // document (the view's data buffer lags editor edits by a tick, so it
    // can't be trusted here). The prefix comes from the frontmatter-only
    // read: joining ctx.lines materialized the whole document per creation
    // press just to parse its head (2026-08-11 review perf item)
    const prefix = activeFootnotePrefix(plugin, footnotePrefixFromEditor(doc));
    // an invalid prefix blocks the insert outright (the Notice already
    // explained why) — no unprefixed fallback footnote to clean up; the
    // press was still consumed
    if (prefix === null) return true;
    // the numbering scan only ever reads the MASKED text (the first
    // argument exists to derive a default mask), so the masked twin is
    // passed as both
    const masked = ctx.maskedLines().join("\n");
    const currentMax = computeNextFootnoteNumber(masked, prefix, masked);

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
        // the definition append is outside the table, so the main editor is
        // safe. A refused cell insertion (born-dead check) must not leave
        // an orphaned definition behind.
        if (
            !insertInTableCell(cell, plugin, footnoteReference, footnoteReference.length)
        ) {
            return true;
        }
        const definition = buildDefinitionAppend(doc, footnoteId, isFirstFootnote, plugin, ctx);
        // the phantom-frontmatter prepend (see buildDefinitionAppend) rides
        // the same transaction; it edits above the table, which is outside
        // the cell sub-editor's region and therefore safe (issue #28 policy)
        landCellDefinitionAppend({
            plugin,
            doc,
            definitionChanges: definition.prepend
                ? [definition.prepend, definition.change]
                : [definition.change],
            origin: cursorPosition,
            footnoteId,
            definitionCursor: definition.cursor,
        });
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

    // the insertion itself can RECLASSIFY the document — "[^N]" at a
    // quote's column 0 demotes the quote and a region opener riding that
    // line swallows everything below, including the definition this very
    // transaction appends; between two loose dollars it can COMPLETE an
    // inline-math pair that swallows the reference (both found by the
    // command-press property suite, 2026-08-12). verifyLiveFootnoteInsertion
    // owns the simulate-and-verify (and the simulatedAnchor re-find that a
    // definition appended ABOVE the caret makes necessary); refuse like
    // the protected-caret guard when anything died.
    const verified = verifyLiveFootnoteInsertion({
        lines: ctx.lines,
        changes,
        referenceChangeIndices: [0],
        footnoteId,
        definitionLabelLine: definition.cursor.line,
    });
    if (!verified) {
        new Notice(ProtectedCreationNotice, 8000);
        return true;
    }

    const referenceAnchor = verified.anchors[0];
    landDefinitionBackedInsertion({
        plugin,
        doc,
        changes,
        origin: cursorPosition,
        footnoteId,
        definitionCursor: definition.cursor,
        afterReference: {
            line: referenceAnchor.line,
            ch: referenceAnchor.ch + footnoteReference.length,
        },
    });
    return true;
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
    // (the shared lookup raw-gates before masking — perf F1, #41 masked
    // re-check, NUL-safe name re-slice; creating a definition from a
    // masked name once wrote literal NUL bytes into the note,
    // bug-masked-name-identity. See referenceOccurrenceAtCursor.)
    const hit = referenceOccurrenceAtCursor(lineText, cursorPosition, doc, ctx);
    if (hit === null) {
        return false;
    }
    ctx = hit.ctx;
    const footnoteId = hit.target.name;

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
        landDefinitionBackedInsertion({
            plugin,
            doc,
            changes: definition.prepend
                ? [definition.prepend, definition.change]
                : [definition.change],
            origin: cursorPosition,
            footnoteId,
            definitionCursor: definition.cursor,
            // no afterReference: this press appends a definition for an
            // EXISTING reference the caret already sits on — nothing to
            // park past
        });
        return true;
    }
    // the reference already has a definition — not this step's
    // press to handle; the cascade continues
    return false;
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
            maskedLineAt(ctx.lines, cursorPosition.line),
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
    // ... and inside another footnote's definition (Jason's ruling
    // 2026-08-13)
    if (warnDefinitionCaretIfInside(doc, null, cursorPosition, ctx)) return true;

    const prefix = resolvePrefix();
    if (prefix === null) return true;
    const emptyReference = `[^${prefix}]`;
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
    // born-dead check (see simulatedMaskedLine): a placeholder that lands
    // masked would silently strand the name-entry flow
    const masked = simulatedMaskedLine(doc, cursorPosition, emptyReference);
    if (
        masked.slice(
            cursorPosition.ch,
            cursorPosition.ch + emptyReference.length,
        ) !== emptyReference
    ) {
        new Notice(ProtectedCreationNotice, 8000);
        return true;
    }
    const newCursorPos = {
        line: cursorPosition.line,
        ch: cursorPosition.ch + 2 + prefix.length,
    };
    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
        { from: cursorPosition, text: emptyReference },
    ]);
    return true;
}
