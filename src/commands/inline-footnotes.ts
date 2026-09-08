import { Editor, EditorPosition, MarkdownView } from "obsidian";

import type FootnotePlugin from "../main";

import { docLines } from "../editor/doc-context";
import { maskInlineRegions, maskedLineAt } from "../parsing/markdown-scan";
import { TableCellEditor } from "../editor/table-cursor";

import { showNotice } from "../editor/notice";
import { readingViewActive } from "../editor/obsidian-internals";
// Inline footnotes ("^[...]"): content sanitizing, the escape-aware span
// scanner, and the two caret guards every command shares. Split out of the
// all-in-one commands file 2026-08-11.

/**
 * Clipboard text made safe as the body of an inline footnote. Inline
 * footnotes are single-line, so whitespace runs (including newlines)
 * collapse to one space and the result is trimmed. Balanced brackets pass
 * through (pasted markdown links keep working); if any bracket is
 * unbalanced - which would end the ^[...] early and corrupt the note -
 * every bare bracket is escaped instead (pre-escaped \[ and \] keep their
 * meaning). A dangling trailing backslash would escape the wrapper's own
 * closing "]", so it is doubled into a literal one. Empty/whitespace
 * input becomes "".
 */
/**
 * The paste keys' clipboard tail, shared by the single-caret and the
 * multi-caret paste (it was copied between them, and this is the one
 * duplicate where drift is dangerous): read the clipboard - the only
 * await in either command - then re-check the view mode, because the
 * user (or a script) can flip to Reading view while the clipboard prompt
 * is up and the editor API would then edit the hidden buffer (2026-08-11
 * review); then refuse an empty body. Returns the ready "^[…]" text, or
 * null when the press is settled (the failure or emptiness already
 * toasted, or the view is no longer editable). Callers must run every
 * guard BEFORE this so a refused press never touches the clipboard.
 */
export async function readInlineFootnoteFromClipboard(
    plugin: FootnotePlugin,
): Promise<string | null> {
    let raw: string;
    try {
        raw = await navigator.clipboard.readText();
    } catch {
        showNotice("Couldn't read the clipboard.");
        return null;
    }
    const viewAfterAwait = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!viewAfterAwait || readingViewActive(viewAfterAwait)) return null;
    const content = sanitizeInlineFootnoteContent(raw);
    if (!content) {
        showNotice("The clipboard is empty, so there is nothing to put in an inline footnote.");
        return null;
    }
    return `^[${content}]`;
}

export function sanitizeInlineFootnoteContent(raw: string): string {
    let text = raw.replace(/\s+/g, " ").trim();
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "\\") {
            i++; // an escaped character can't open or close anything
        } else if (c === "[") {
            depth++;
        } else if (c === "]") {
            depth--;
            if (depth < 0) break;
        }
    }
    if (depth !== 0) {
        // keep \[ and \] pairs as the balance scan understood them; escape
        // only the bare brackets
        text = text.replace(/\\[\s\S]|[[\]]/g, (m) =>
            m.length === 2 ? m : `\\${m}`,
        );
    }
    // an odd trailing backslash run leaves one backslash escaping the
    // wrapper's closing "]" - double it so it renders literally instead
    const trailing = /\\*$/.exec(text);
    if (trailing && trailing[0].length % 2 === 1) {
        text += "\\";
    }
    return text;
}

/**
 * Whether a freshly inserted inline-footnote wrapper at `at` survives
 * INTACT on the masked simulated line: the span must open exactly at the
 * wrapper's "^" AND close on the wrapper's own "]". The close check
 * exists because an open-only check accepted a wrap whose closing
 * bracket an emergent "$…$" pair swallowed - the bracket walk then
 * latched onto an unrelated later "]" and the rendered line was math
 * eating prose (hunt 2026-08-25, bug-inline-wrap-close-swallowed). The
 * ONE landing predicate for every inline-wrap writer: caret insert,
 * paste, multi-caret skeletons, cell writes, selection conversion.
 */
/**
 * The born-dead rule in one place (duplicated-logic audit, 2026-09-05):
 * does `text`, written at `at` on the MASKED simulated line, still read
 * as what it is? An inline footnote must survive as an intact span
 * (pasted content may carry its own code, masked INSIDE the brackets);
 * anything else - a reference, a placeholder - must come back byte for
 * byte, or the insertion completed a construct around itself and would
 * be born masked.
 */
export function insertionLandsIntact(masked: string, at: number, text: string): boolean {
    return text.startsWith("^[")
        ? inlineWrapLandsIntact(masked, at, text.length)
        : masked.slice(at, at + text.length) === text;
}

export function inlineWrapLandsIntact(
    masked: string,
    at: number,
    wrapLength: number,
): boolean {
    const span = inlineFootnoteSpanAt(masked, at + 2);
    return (
        span !== null && span.open === at && span.close === at + wrapLength - 1
    );
}

/**
 * The inline footnote whose brackets contain `ch` on `lineText`, as its
 * `open` ("^" index) and `close` ("]" index), or null. Bracket matching is
 * escape-aware and steps over nested balanced pairs (markdown links).
 * "Inside" spans from just after the `^` through the closing `]` itself.
 */
export function inlineFootnoteSpanAt(
    lineText: string,
    ch: number,
): { open: number; close: number } | null {
    for (let i = 0; i < lineText.length - 1; i++) {
        const c = lineText[i];
        if (c === "\\") {
            i++;
            continue;
        }
        if (c !== "^" || lineText[i + 1] !== "[") continue;

        let depth = 0;
        let close = -1;
        for (let j = i + 1; j < lineText.length; j++) {
            const cj = lineText[j];
            if (cj === "\\") {
                j++;
            } else if (cj === "[") {
                depth++;
            } else if (cj === "]") {
                depth--;
                if (depth === 0) {
                    close = j;
                    break;
                }
            }
        }
        // this candidate never closes, so it isn't an inline footnote - a
        // LATER "^[" on the line may still close (its opening "[" was
        // counted as nesting above), so keep scanning instead of bailing
        if (close === -1) continue;
        if (ch > i && ch <= close) return { open: i, close };
        i = close; // cursor isn't in this one - keep scanning after it
    }
    return null;
}

/** The position just past an inline footnote's closing bracket when `ch` sits inside one, or null. */
export function inlineFootnoteExitCh(lineText: string, ch: number): number | null {
    const span = inlineFootnoteSpanAt(lineText, ch);
    return span === null ? null : span.close + 1;
}

/**
 * When the caret sits inside an EMPTY inline footnote ("^[]", or only
 * whitespace between the brackets), leave it where it is, ask for the text
 * via a Notice, and report true. Shared by every footnote command, exactly
 * like the empty "[^]" reference guard (manual combo-test feedback,
 * 2026-08-08): a second press used to silently hop the caret out,
 * stranding an inline footnote with nothing in it. A FILLED inline
 * footnote is not this guard's business - there the press falls through
 * to exitInlineFootnoteIfInside, the deliberate "done typing" hop.
 */
export function warnEmptyInlineFootnoteIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
    // the table sub-editor fallback resolves the real caret before running
    // the command; guards must honor that position instead of re-reading a
    // possibly-stale getCursor() (2026-08-11 review bug #9)
    cursorPosition?: EditorPosition,
): boolean {
    const span = maskedInlineFootnoteSpan(doc, cell, cursorPosition);
    if (span === null) return false;
    if (span.text.slice(span.open + 2, span.close).trim() !== "") return false;
    showNotice(
        "This inline footnote is empty. Type its text between the brackets.",
        8000,
    );
    return true;
}

/**
 * The inline-footnote span at the caret, resolved against MASKED text: a
 * "^[…]"-shaped fragment inside a fence, inline code, or a comment is
 * plain text, and treating it as an inline footnote made every command
 * inert there with a wrong toast (2026-08-11 review bug #7). A cheap raw
 * scan gates the whole-document masking off the every-press hot path -
 * masked indices match raw indices, so the span positions stay valid.
 */
function maskedInlineFootnoteSpan(
    doc: Editor,
    cell: TableCellEditor | null,
    cursorPosition?: EditorPosition,
): { text: string; open: number; close: number } | null {
    if (cell) {
        const raw = cell.state.doc.toString();
        const ch = cell.state.selection.main.head;
        if (inlineFootnoteSpanAt(raw, ch) === null) return null;
        // cell text is a single line, so line-local masking suffices
        const masked = maskInlineRegions(raw);
        const span = inlineFootnoteSpanAt(masked, ch);
        return span === null ? null : { text: masked, ...span };
    }
    const pos = cursorPosition ?? doc.getCursor();
    const raw = doc.getLine(pos.line);
    if (inlineFootnoteSpanAt(raw, pos.ch) === null) return null;
    const masked = maskedLineAt(docLines(doc), pos.line);
    const span = inlineFootnoteSpanAt(masked, pos.ch);
    return span === null ? null : { text: masked, ...span };
}

/**
 * When the caret sits inside an inline footnote ("^[...]"), hop it just
 * past the closing bracket and report true. Shared by every insert
 * command: for the numbered/named ones this prevents nesting a "[^x]"
 * reference inside the inline footnote's brackets, which would end the inline
 * footnote early and corrupt it ("^[in [^named]line]").
 */
export function exitInlineFootnoteIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
    cursorPosition?: EditorPosition,
): boolean {
    const span = maskedInlineFootnoteSpan(doc, cell, cursorPosition);
    if (span === null) return false;
    const exit = span.close + 1;
    if (cell) {
        cell.dispatch({ selection: { anchor: exit } });
        return true;
    }
    const pos = cursorPosition ?? doc.getCursor();
    doc.setCursor({ line: pos.line, ch: exit });
    return true;
}
