import { Editor, Notice } from "obsidian";

import { TableCellEditor } from "./table-cursor";

// Inline footnotes ("^[...]"): content sanitizing, the escape-aware span
// scanner, and the two caret guards every command shares. Split out of the
// all-in-one commands file 2026-08-11.

/**
 * Clipboard text made safe as the body of an inline footnote. Inline
 * footnotes are single-line, so whitespace runs (including newlines)
 * collapse to one space and the result is trimmed. Balanced brackets pass
 * through (pasted markdown links keep working); if any bracket is
 * unbalanced — which would end the ^[...] early and corrupt the note —
 * every bare bracket is escaped instead (pre-escaped \[ and \] keep their
 * meaning). A dangling trailing backslash would escape the wrapper's own
 * closing "]", so it is doubled into a literal one. Empty/whitespace
 * input becomes "".
 */
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
    // wrapper's closing "]" — double it so it renders literally instead
    const trailing = /\\*$/.exec(text);
    if (trailing && trailing[0].length % 2 === 1) {
        text += "\\";
    }
    return text;
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
        // this candidate never closes, so it isn't an inline footnote — a
        // LATER "^[" on the line may still close (its opening "[" was
        // counted as nesting above), so keep scanning instead of bailing
        if (close === -1) continue;
        if (ch > i && ch <= close) return { open: i, close };
        i = close; // cursor isn't in this one — keep scanning after it
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
 * footnote is not this guard's business — there the press falls through
 * to exitInlineFootnoteIfInside, the deliberate "done typing" hop.
 */
export function warnEmptyInlineFootnoteIfInside(
    doc: Editor,
    cell: TableCellEditor | null,
): boolean {
    const text = cell
        ? cell.state.doc.toString()
        : doc.getLine(doc.getCursor().line);
    const ch = cell ? cell.state.selection.main.head : doc.getCursor().ch;
    const span = inlineFootnoteSpanAt(text, ch);
    if (span === null) return false;
    if (text.slice(span.open + 2, span.close).trim() !== "") return false;
    new Notice(
        "This inline footnote is empty. Type its text between the brackets.",
        8000,
    );
    return true;
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
): boolean {
    if (cell) {
        const exit = inlineFootnoteExitCh(
            cell.state.doc.toString(),
            cell.state.selection.main.head,
        );
        if (exit === null) return false;
        cell.dispatch({ selection: { anchor: exit } });
        return true;
    }
    const cursorPosition = doc.getCursor();
    const exit = inlineFootnoteExitCh(
        doc.getLine(cursorPosition.line),
        cursorPosition.ch,
    );
    if (exit === null) return false;
    doc.setCursor({ line: cursorPosition.line, ch: exit });
    return true;
}
