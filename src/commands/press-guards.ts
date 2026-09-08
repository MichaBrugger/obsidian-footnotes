import { Editor, EditorPosition } from "obsidian";

import type FootnotePlugin from "../main";
import { emptyReferenceStart, referenceText } from "../parsing/footnote-grammar";
import { footnotePrefixFromEditor, footnotePrefixProblem } from "../parsing/footnote-prefix";
import {
    exitInlineFootnoteIfInside,
    warnEmptyInlineFootnoteIfInside,
} from "./inline-footnotes";
import {
    caretInsideMaskedSpan,
    ProtectedCreationNotice,
} from "../editor/insertion-liveness";
import { DocContext, docLines } from "../editor/doc-context";
import {
    findDefinitionBlocks,
    maskInlineRegions,
    maskedLineAt,
} from "../parsing/markdown-scan";
import { TableCellEditor } from "../editor/table-cursor";

import { NestedFootnoteNotice, showNotice } from "../editor/notice";
// The press guards: a footnote key was pressed - does something OTHER than
// creation own it? Empty placeholders warn, filled inline footnotes hop,
// and protected text (definition interiors included) refuses outright.
// Split out of the all-in-one commands file 2026-08-12: one subject, one
// abstraction level below the command cascade that calls it.

/**
 * The caret guards every footnote command runs before acting, IN THIS
 * ORDER (load-bearing): an EMPTY inline footnote asks for its text before
 * the filled-inline "done typing" hop can trigger; the hop beats the
 * reference guards (an inline body can contain reference-shaped text); an
 * abandoned "[^]" asks for a name instead of nesting; an untouched
 * "[^7-]" prefix placeholder asks for a suffix. True = the press was
 * consumed (toast or hop) and the command stops. The inline/paste
 * commands additionally navigate from inside a real reference
 * (navigateReferenceIfInside) at their call sites - the autonum/named
 * commands run their own jump cascade instead.
 *
 * `cursorPosition` is the RESOLVED caret: the autonum/named commands call
 * this inside runOutsideTableCell's callback, whose sub-editor fallback
 * resolves the real position - the guards used to run before it with a
 * stale getCursor() (2026-08-11 review bug #9).
 */
export function caretGuardsHandled(
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
 * comment, or frontmatter (Jason's rule 2026-08-12 - always on, inline
 * spans included): a reference minted there is dead text Obsidian never
 * renders, which the next lint's orphan handling then deletes. Runs at
 * the CREATION steps only - navigation never reaches protected text (its
 * masked gates fall through). True = warned, press consumed.
 */
export function warnProtectedCaretIfInside(
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
    showNotice(ProtectedCreationNotice, 8000);
    return true;
}

/** The untouched "[^7-]" placeholder: the prefix is there, the name is not. */
export const PrefixOnlyNotice =
    "This footnote reference has only the prefix. Type a name after it.";

/**
 * Footnote CREATION is blocked anywhere inside a definition block - the
 * body after the label, and continuation lines (Jason's ruling
 * 2026-08-13: Obsidian technically renders footnotes nested inside
 * definitions, but that's wildly nonstandard markdown and the plugin
 * won't create it; the popup embed also mis-renders such definitions).
 * Label-line presses before the label's end never reach this - the
 * navigation guards own them. Cells never hold real definitions. True =
 * warned, press consumed.
 */
export function warnDefinitionCaretIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
    cursorPosition: EditorPosition,
    ctx: DocContext,
): boolean {
    if (cell) return false;
    const inside = findDefinitionBlocks(
        ctx.lines,
        ctx.scan.isProtected,
        ctx.scan,
    ).some(
        (block) =>
            cursorPosition.line >= block.start && cursorPosition.line <= block.end,
    );
    if (!inside) return false;
    showNotice(NestedFootnoteNotice, 8000);
    return true;
}

// (navigateDefinitionLabelIfInside lived here 2026-08-12/13: the inline
// pair's label-only navigation. Superseded by Jason's ruling - the inline
// commands now run the SAME whole-block jump step as the numbered/named
// keys, shouldJumpFromDefinitionToReference, wired at their entries.)

/**
 * When the caret sits inside an untouched prefilled reference - "[^7-]",
 * exactly the note's footnote-prefix with no name typed yet - leave the
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
    // silent validity check - the invalid-prefix Notice belongs to the
    // insert path, not to every caret movement guard
    if (!prefix || footnotePrefixProblem(prefix) !== null) return false;
    const placeholder = referenceText(prefix);
    if (!caretInsidePlaceholder(doc, cell, placeholder, cursorPosition)) {
        return false;
    }
    showNotice(PrefixOnlyNotice);
    return true;
}

/**
 * Whether the caret sits strictly inside a live occurrence of `placeholder`
 * ("[^]" or the prefilled "[^7-]"), in the cell's text or the caret's line.
 * A raw hit is confirmed against the code-masked text - a placeholder-shaped
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
 * out - a warning is the one response that tells the user what the
 * fragment is and how to fix it.
 */
function warnEmptyReferenceIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
    cursorPosition?: EditorPosition,
): boolean {
    if (!caretInsidePlaceholder(doc, cell, "[^]", cursorPosition)) return false;
    showNotice(
        "This footnote reference is empty. Type a name between the brackets.",
        8000,
    );
    return true;
}
