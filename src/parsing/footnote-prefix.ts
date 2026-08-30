import { Editor, Notice } from "obsidian";

import type FootnotePlugin from "../main";
import { isValidFootnoteName } from "./footnote-grammar";

// The note's `footnote-prefix` frontmatter property: parsing (a hand-rolled
// YAML subset matching what Obsidian shows as a property), validity rules,
// and the settings-aware resolver the insert commands share. Depends only
// on footnote-grammar (+ the FootnotePlugin TYPE, erased at runtime) -
// split out of the all-in-one commands file 2026-08-11.

// strip a trailing "\r" so CRLF notes match the exact "---" fence and the
// "$"-anchored property regex (a "\r" defeats both otherwise) - the ONE
// copy both readers share (2026-08-11 review cleanliness)
const stripCrLine = (line: string): string =>
    line.endsWith("\r") ? line.slice(0, -1) : line;

/** The parsed value of one "footnote-prefix:" property line. */
function parsePrefixValue(captured: string | undefined): string {
    let value = (captured ?? "").trim();
    // a value that IS a comment is an empty value
    if (value.startsWith("#")) return "";
    // quotes end the value - anything after the closing quote
    // (typically a comment) is not part of it
    const quoted = value.match(/^(["'])(.*?)\1/);
    if (quoted) return quoted[2];
    // an unquoted value ends at a whitespace-preceded "#" (YAML
    // comments); a "#" glued to text is value content
    const commentAt = value.search(/(?:^|\s)#/);
    if (commentAt !== -1) value = value.slice(0, commentAt).trim();
    return value;
}

/**
 * The note's `footnote-prefix` frontmatter value, or "" when absent. Chapter
 * notes of a combined document set this (e.g. "2.") so the autonumbered
 * command creates "[^2.1]", "[^2.2]", … - unique across the merged export
 * (issue #31). Walks the head line-by-line WITHOUT splitting the whole
 * document - this runs several times per lint on the full note text
 * (2026-08-11 review perf item).
 */
export function footnotePrefix(markdownText: string): string {
    let lineStart = 0;
    let first = true;
    // the FIRST property line wins; its value only becomes real once the
    // block CLOSES - Obsidian surfaces NO properties from an unclosed
    // "---" block (2026-08-11 review bug #11, ground-truthed via
    // metadataCache), and a prefix there would namespace footnotes from a
    // setting the user cannot see
    let value: string | null = null;
    for (;;) {
        let lineEnd = markdownText.indexOf("\n", lineStart);
        if (lineEnd === -1) lineEnd = markdownText.length;
        const line = stripCrLine(markdownText.slice(lineStart, lineEnd));
        if (first) {
            if (line !== "---") return "";
            first = false;
        } else if (/^(---|\.\.\.)\s*$/.test(line)) {
            return value ?? "";
        } else if (value === null) {
            // YAML needs whitespace after the colon - "footnote-prefix:2."
            // is a plain scalar Obsidian doesn't show as a property, not a
            // mapping (bug-prefix-yaml-comment)
            const match = line.match(/^footnote-prefix:(?:\s+(.*))?$/);
            // the "(?:\s+(.*))?" group is genuinely optional - undefined
            // when the property has no value at all
            if (match) value = parsePrefixValue(match[1]);
        }
        if (lineEnd === markdownText.length) return ""; // unclosed block
        lineStart = lineEnd + 1;
    }
}

/**
 * footnotePrefix, reading only the note's frontmatter block through the
 * editor line API. The per-press guards used to call doc.getValue(), which
 * materializes the whole document on every command press while the prefix
 * feature is on (perf, 2026-08-07); this stops at the closing fence
 * instead. Parsing is delegated to footnotePrefix so the two can't drift.
 */
export function footnotePrefixFromEditor(doc: Editor): string {
    if (stripCrLine(doc.getLine(0)) !== "---") return "";
    const lines = ["---"];
    for (let i = 1; i < doc.lineCount(); i++) {
        const line = stripCrLine(doc.getLine(i));
        lines.push(line);
        if (/^(---|\.\.\.)\s*$/.test(line)) break;
    }
    return footnotePrefix(lines.join("\n"));
}

/**
 * Why `prefix` can't be used as a footnote prefix, or null when it can.
 * Shared by the Set-footnote-prefix modal, the insert path, and the lint
 * guard. Digit-ending prefixes are the dangerous case: with prefix "10"
 * the first footnote is [^101] - indistinguishable from a plain numbered
 * footnote, which reindexing then renumbers, collapsing the namespace the
 * prefix exists to preserve.
 */
export function footnotePrefixProblem(prefix: string): string | null {
    if (!prefix) return null;
    if (!isValidFootnoteName(prefix) || /[[\]]/.test(prefix)) {
        return "The footnote prefix can't contain spaces, backticks, or brackets.";
    }
    if (/\d$/.test(prefix)) {
        return "The footnote prefix can't end in a number. Its footnotes would be indistinguishable from plain numbered ones.";
    }
    return null;
}

// the feature is enabled in settings, and a prefix that can't work BLOCKS
// the insert (null) with an explanation - falling back to an unprefixed
// footnote just left the user something to delete (reported 2026-08-07).
// Takes the already-extracted prefix so callers pick the cheap read:
// footnotePrefixFromEditor per press, footnotePrefix when the full text is
// already in hand (F1 - no whole-document materialization per keypress)
export function activeFootnotePrefix(
    plugin: FootnotePlugin,
    prefix: string,
): string | null {
    if (!plugin.settings.enableFootnotePrefix) return "";
    if (!prefix) return "";
    const problem = footnotePrefixProblem(prefix);
    if (problem) {
        new Notice(
            `No footnote was created: this note's footnote-prefix ("${prefix}") is invalid. ${problem}`,
            8000,
        );
        return null;
    }
    return prefix;
}
