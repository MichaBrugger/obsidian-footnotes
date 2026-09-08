import { Notice } from "obsidian";

// Every toast the plugin shows goes through showNotice. Obsidian's notice
// wraps with `overflow-wrap: anywhere`, which is allowed to break a line
// between ANY two characters once the line is full - so a quoted footnote
// name could render as `Add a"` on one line and `[^bob]" reference` on the
// next (Jason's report 2026-09-04, right after every toast gained the
// quotes for consistency). A quoted reference is one visual token; it is
// wrapped in a no-wrap span so the quotes, the brackets, and the name
// always land on the same line. Messages without one stay plain strings.

/** A quoted footnote reference exactly as the toasts spell it: `"[^name]"`, the empty `"[^]"` and bare-prefix `"[^2.]"` placeholders included. */
const QuotedReference = /"\[\^[^"\]]*\]"/g;

/** The message split into runs: `nowrap` runs are quoted references that must not break across lines. */
export function noticeSegments(message: string): { text: string; nowrap: boolean }[] {
    const segments: { text: string; nowrap: boolean }[] = [];
    let last = 0;
    for (const match of message.matchAll(QuotedReference)) {
        if (match.index > last) {
            segments.push({ text: message.slice(last, match.index), nowrap: false });
        }
        segments.push({ text: match[0], nowrap: true });
        last = match.index + match[0].length;
    }
    if (last < message.length) {
        segments.push({ text: message.slice(last), nowrap: false });
    }
    return segments;
}

/**
 * Show a toast. Quoted footnote references in `message` are kept on one
 * line (a no-wrap span each); a message without any, or a host without
 * Obsidian's DOM helpers (units), goes to Obsidian's Notice as the plain
 * string.
 */
export function showNotice(message: string, duration?: number): Notice {
    const segments = noticeSegments(message);
    if (typeof createFragment !== "function" || !segments.some((segment) => segment.nowrap)) {
        return new Notice(message, duration);
    }
    const fragment = createFragment();
    for (const segment of segments) {
        if (segment.nowrap) {
            fragment.createSpan({ cls: "footnote-shortcut-nowrap", text: segment.text });
        } else {
            fragment.appendText(segment.text);
        }
    }
    return new Notice(fragment, duration);
}
