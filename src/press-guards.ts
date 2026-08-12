import { Editor, EditorPosition, Notice } from "obsidian";

import type FootnotePlugin from "./main";
import { emptyReferenceStart } from "./footnote-grammar";
import { footnotePrefixFromEditor, footnotePrefixProblem } from "./footnote-prefix";
import {
    exitInlineFootnoteIfInside,
    warnEmptyInlineFootnoteIfInside,
} from "./inline-footnotes";
import {
    caretInsideMaskedSpan,
    ProtectedCreationNotice,
} from "./insertion-liveness";
import { DocContext, docContext, docLines } from "./doc-context";
import { definitionLabelIn, maskInlineRegions, maskedLineAt } from "./markdown-scan";
import { shouldJumpFromDefinitionToReference } from "./navigation";
import { TableCellEditor } from "./table-cursor";

// The press guards: a footnote key was pressed — does something OTHER than
// creation own it? Empty placeholders warn, filled inline footnotes hop,
// definition labels navigate back, and protected text refuses outright.
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
 * (navigateReferenceIfInside) at their call sites — the autonum/named
 * commands run their own jump cascade instead.
 *
 * `cursorPosition` is the RESOLVED caret: the autonum/named commands call
 * this inside runOutsideTableCell's callback, whose sub-editor fallback
 * resolves the real position — the guards used to run before it with a
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
 * comment, or frontmatter (Jason's rule 2026-08-12 — always on, inline
 * spans included): a reference minted there is dead text Obsidian never
 * renders, which the next lint's orphan handling then deletes. Runs at
 * the CREATION steps only — navigation never reaches protected text (its
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
    new Notice(ProtectedCreationNotice, 8000);
    return true;
}

/**
 * When the caret sits INSIDE a definition label ("[^x]:" — before the end
 * of its colon), handle the press like the numbered/named cascade's step 1:
 * jump back to the first reference (or explain an orphan). Inserting inline
 * text there would shove the label off column 0, DESTROYING the definition
 * and orphaning its references (found by the command-press property suite,
 * 2026-08-12 — the inline pair never had the jump-from-definition step the
 * other keys start with). Definition CONTENT, at or past the label end, is
 * ordinary prose and stays insertable. Table cells never hold real
 * definitions, so a cell press skips this.
 */
export function navigateDefinitionLabelIfInside(
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null,
): boolean {
    if (cell) return false;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    // raw-line gate first — this runs on every inline/paste press
    const label = definitionLabelIn(lineText);
    if (!label || cursorPosition.ch >= label.labelEnd) return false;
    // a label-shaped line inside code is plain text (#41): no jump — the
    // protected-caret guard downstream owns that caret
    const ctx = docContext(doc);
    const maskedLabel = definitionLabelIn(ctx.maskedLine(cursorPosition.line));
    if (!maskedLabel || cursorPosition.ch >= maskedLabel.labelEnd) return false;
    // however the jump resolves (first reference, or the orphan toast),
    // the press is handled — "^[…]" must never land inside the label
    shouldJumpFromDefinitionToReference(lineText, cursorPosition, plugin, doc, ctx);
    return true;
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
