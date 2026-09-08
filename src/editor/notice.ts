import { Notice } from "obsidian";

// Every toast the plugin shows goes through showNotice. Obsidian's notice
// wraps with `overflow-wrap: anywhere`, which is allowed to break a line
// between ANY two characters once the line is full - so a quoted footnote
// name could render as `Add a"` on one line and `[^bob]" reference` on the
// next (Jason's report 2026-09-04, right after every toast gained the
// quotes for consistency). A quoted reference is one visual token; it is
// wrapped in a no-wrap span so the quotes, the brackets, and the name
// always land on the same line. Messages without one stay plain strings.

// ---- Shared toast text ------------------------------------------------
// One string per rule, built from shared parts (Jason, 2026-09-05): a
// refusal that means the same thing says the same thing wherever it
// fires, so there are fewer unique strings to maintain and, later, to
// translate.

/** The refusal opener every "nothing was created" toast starts with. */
export const NoFootnoteCreated = "No footnote was created: ";
/** Its plural, for the multi-caret press. */
const NoFootnotesCreated = "No footnotes were created: ";
/** The lint's opener when a note can't be linted at all. */
export const LintingCanceled = "Linting canceled: ";

/** The one nesting rule: a caret in a definition body, a selection holding a footnote, a caret inside a footnote among plain-text carets. */
const NestingRule = "footnotes can't be nested inside other footnotes.";
export const NestedFootnoteNotice = NoFootnoteCreated + NestingRule;
export const MultiCaretNestedNotice = NoFootnotesCreated + NestingRule;

/** The advice for a definition nothing references - the navigation press and the lint alert give the same one. */
export function addReferenceOrDeleteDefinition(name: string): string {
    return `Add a "[^${name}]" reference in the text, or delete the definition.`;
}

/** A name another footnote already carries - the named-selection and Rename modals say the same thing. */
export function nameAlreadyUsed(name: string): string {
    return `"[^${name}]" is already used by another footnote.`;
}

/** An invalid footnote-prefix property, as the insert refusal and the lint cancel both report it. */
export function invalidPrefixMessage(opener: string, prefix: string, problem: string): string {
    return `${opener}this note's footnote-prefix ("${prefix}") is invalid. ${problem}`;
}

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
