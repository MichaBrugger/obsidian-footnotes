import { Editor, EditorPosition, Notice } from "obsidian";

import type FootnotePlugin from "./main";
import { moveCursorAndSetJumpPoint } from "./cursor-motion";
import { DocContext, docContext, listExistingFootnoteDefinitions } from "./doc-context";
import {
    footnoteReferenceMatches,
    idListIncludes,
    referenceAtCursor,
    referenceOccurrences,
} from "./footnote-grammar";
import { openFootnotePopup, popupEditingAvailable } from "./footnote-popup";
import { definitionLabelIn, findDefinitionBlocks } from "./markdown-scan";

// The jump half of the decision cascade: definition → first reference,
// reference → its definition (popup-edit when enabled). Imports the popup
// but never the linter, so the linter can depend on jumps without a cycle.
// Split out of the all-in-one commands file 2026-08-11.

/** Cascade step 1: caret on a definition line → jump to the first use of its reference. Returns whether it handled the press. */
export function shouldJumpFromDefinitionToReference(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx?: DocContext,
): boolean {
    // check if we're in a footnote definition line ("[^1]: footnote") or one of
    // its continuation lines; if so, jump back to the footnote in the text

    // cheap pre-check on the raw line; the whole-document scanning below
    // only runs when the caret sits on something definition-shaped — the
    // "[^x]:" line itself, or an indented line that MIGHT be a continuation
    // (jump-to-definition deliberately parks the caret on the LAST continuation
    // line, and the hotkey there used to insert a new footnote instead of
    // jumping back — bug reported 2026-07-17)
    if (definitionLabelIn(lineText) === null && !/^\s+\S/.test(lineText)) return false;

    // #41: a "[^x]:" inside a code block is not a definition, and a reference
    // inside code is not a jump target — resolve against protected-aware
    // definition blocks and scan the masked twin
    // built only past the raw-line gate above (the gate exists because
    // this runs on every press — perf F1/F8)
    ctx ??= docContext(doc);
    const lines = ctx.lines;
    // the press's one protection scan feeds the block lookup and masking
    const block = findDefinitionBlocks(lines, ctx.scan.isProtected, ctx.scan).find(
        (candidate) =>
            cursorPosition.line >= candidate.start &&
            cursorPosition.line <= candidate.end,
    );
    let definitionName: string | null = null;
    if (block) {
        definitionName = block.name;
    } else {
        // a blockquoted/callout label ("> [^x]: …", C22) is a definition
        // too, but never part of a column-0 definition BLOCK — match the
        // caret's masked line and re-slice the raw name
        const label = definitionLabelIn(ctx.maskedLine(cursorPosition.line));
        if (label && label.nameStart > 2) {
            definitionName = lineText.slice(label.nameStart, label.nameEnd);
        }
    }
    if (definitionName !== null) {
        // ids are case-insensitive, so the reference may differ in casing from
        // the definition's label ("[^Note]" ↔ "[^note]:") — fold both to compare
        const name = definitionName.toLowerCase();
        const masked = ctx.maskedLines();

        // find the FIRST reference use of this footnote. footnoteReferenceMatches
        // skips a definition's own column-0 label; blockquoted labels read
        // as mid-line references, so they are skipped here — a label
        // ANYWHERE defines, it doesn't reference, and jumping to a
        // blockquoted duplicate's label was a phantom target
        // (parallel-review probe, 2026-08-10)
        for (let i = 0; i < masked.length; i++) {
            const lineLabel = definitionLabelIn(masked[i]);
            for (const use of referenceOccurrences(lines[i], masked[i])) {
                if (lineLabel && use.start === lineLabel.nameStart - 2) {
                    continue;
                }
                if (use.name.toLowerCase() !== name) continue;
                const newCursorPos = { line: i, ch: use.end };
                moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, undefined, true);
                return true;
            }
        }
        // an ORPHANED definition — no reference anywhere. Falling through used
        // to insert a brand-new footnote INTO the definitions area, when the
        // user almost certainly pressed the key to jump to the reference they
        // have since deleted; explain and stand still instead (QOL sweep,
        // 2026-08-07)
        new Notice(
            `Nothing references this footnote. Add a [^${definitionName}] reference in the text, or delete the definition.`,
            8000,
        );
        return true;
    }
    return false;
}

/** Move the caret to the end of the named footnote's definition (including its indented continuation lines). */
export function jumpToFootnoteDefinition(
    footnoteName: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx: DocContext = docContext(doc),
): boolean {
    // find the first line with this definition reference name in it — matching
    // the masked twin so definition-shaped lines inside code don't count
    // (#41); blockquote/callout labels count too (C22)
    const lines = ctx.lines;
    const masked = ctx.maskedLines();
    for (let i = 0; i < masked.length; i++) {
        const label = definitionLabelIn(masked[i]);
        // ids are case-insensitive: the definition label may differ in casing
        // from the reference name that sent us here. Re-slice the ORIGINAL
        // line for the name — a code span inside it masks to NULs
        // (bug-masked-name-identity)
        if (
            label &&
            lines[i].slice(label.nameStart, label.nameEnd).toLowerCase() ===
                footnoteName.toLowerCase()
        ) {
            // land at the END of the definition (indented lines belong to
            // it) so the user can backspace/type without arrow keys. The
            // block's reach comes from findDefinitionBlocks itself — a
            // hand-rolled walk here stopped at blank runs and at region
            // interiors the block walk absorbs, landing the caret
            // mid-definition (2026-08-11 review bug #12). A blockquoted
            // label is never part of a column-0 block; its own line is the
            // landing spot.
            const block = findDefinitionBlocks(
                lines,
                ctx.scan.isProtected,
                ctx.scan,
            ).find((candidate) => candidate.start === i);
            const endLine = block ? block.end : i;
            const newCursorPos = { line: endLine, ch: doc.getLine(endLine).length };
            moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, undefined, true);
            return true;
        }
    }
    return false;
}

/** Cascade step 2: caret on a reference that HAS a definition → popup-edit it (when enabled) or jump to it. References without a definition return false so creation runs. */
export function shouldJumpFromReferenceToDefinition(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    ctx?: DocContext,
): boolean {
    // Jump cursor TO definition reference:
    // find the reference whose brackets contain the cursor on this line,
    // then place the cursor at that footnote's definition line. This runs on
    // every keypress of both commands and a whole-document scan here is
    // measurable on large notes, so the raw line gates first — masking
    // (which needs the whole document for fence state) only runs when
    // the caret actually sits on something reference-shaped.
    const rawReferences = footnoteReferenceMatches(lineText).map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (referenceAtCursor(rawReferences, cursorPosition.ch) === null) return false;

    // #41: re-check against the masked twin — a reference inside a fence or
    // inline code is plain text, so the press falls through to insertion.
    // The reference TEXT is re-sliced from the raw line: a code span inside
    // the name masks to NULs, and the masked name would break the definition
    // lookup and jump below (bug-masked-name-identity).
    // The context is built only past the raw gate — this step runs on
    // every press, most of which sit on plain text (perf F1)
    ctx ??= docContext(doc);
    const maskedLine = ctx.maskedLine(cursorPosition.line);
    const referencesOnLine = footnoteReferenceMatches(maskedLine).map((match) => {
        const start = match.index ?? 0;
        return {
            footnote: lineText.slice(start, start + match[0].length),
            startIndex: start,
        };
    });
    const referenceTarget = referenceAtCursor(referencesOnLine, cursorPosition.ch);

    if (referenceTarget !== null) {
        // the reference is exactly "[^name]", so the name is a positional
        // slice — regex re-extraction would stop at brackets the mask hid
        {
            const footnoteName = referenceTarget.slice(2, -1);

            // references without a definition line fall through to the
            // definition-creation paths (ids compared case-insensitively)
            if (!idListIncludes(listExistingFootnoteDefinitions(doc, ctx), footnoteName)) {
                return false;
            }

            if (popupEditingAvailable(plugin)) {
                // the popup's close callback runs LATER, after its save may
                // have edited the document — it must build a FRESH context
                void openFootnotePopup(plugin, footnoteName, () => {
                    jumpToFootnoteDefinition(footnoteName, cursorPosition, plugin, doc);
                });
                return true;
            }
            return jumpToFootnoteDefinition(footnoteName, cursorPosition, plugin, doc, ctx);
        }
    }
    return false;
}
