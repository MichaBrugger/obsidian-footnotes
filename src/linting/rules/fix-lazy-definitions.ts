import {
    definitionStartLines,
    lazyDefinitionLabelLines,
    maskProtectedLines,
    scanDocument,
} from "../../parsing/markdown-scan";
import { IgnoreType } from "../ignore-types";
import { rewriteDocument } from "../rewrite-document";
import { FootnoteRule } from "../rule";

// "Fix definitions hidden by a missing blank line" (Jason, 2026-09-09). A
// "[^x]:" line directly under a prose line - paragraph text, a list item,
// a quote or callout body line, a table row - is lazy paragraph text to
// Obsidian (the prose-label rule, definitionStartLines), one blank line
// short of the definition the user typed. This rule inserts that blank
// line; it runs FIRST in the lint pipeline, so every rule after it sees
// the definition it was meant to be (move-to-bottom gathers it, the orphan
// and duplicate rules judge it, reindex numbers it). While the toggle is
// off, the lazy-definition alert speaks instead.

// the blockquote markers a label line sits behind: the inserted line
// carries the same markers, bare, because a bare ">" line is the blank
// line inside a quote (ground truth 2026-09-09)
const QuoteMarkers = /^ {0,3}((?:>[ \t]?)*)/;

/** `markdown` with one blank line (or bare quote line) inserted above each hidden definition; a note with none comes back byte-identical. */
export function fixLazyDefinitions(markdown: string): string {
    return rewriteDocument(markdown, (text, view) => {
        let lines = view.lines;
        let lazy = lazyDefinitionLabelLines(lines, view.scan, view.maskedLines, view.definitionStarts);
        if (lazy.length === 0) return text;
        // one line above the TOPMOST lazy label, then re-read: that blank
        // often promotes the labels under it as well (a label directly under
        // a definition is a definition), so inserting above every lazy label
        // at once would over-insert. Each pass promotes at least the label it
        // targets; the bound is a guard, never the stop condition
        for (let guard = lazy.length; guard > 0 && lazy.length > 0; guard--) {
            const at = lazy[0];
            const markers = (QuoteMarkers.exec(lines[at])?.[1] ?? "").trimEnd();
            lines = [...lines.slice(0, at), markers, ...lines.slice(at)];
            const scan = scanDocument(lines);
            const masked = maskProtectedLines(lines, scan);
            lazy = lazyDefinitionLabelLines(lines, scan, masked, definitionStartLines(lines, scan, (i) => masked[i]));
            // the targeted label did not become a definition: stop rather than
            // stack blank lines above it (no known shape does this; the
            // property in test/fix-lazy-definitions.test.ts watches for one)
            if (lazy.length > 0 && lazy[0] === at + 1) break;
        }
        return lines.join("\n");
    });
}

export const fixLazyDefinitionsRule: FootnoteRule = {
    id: "fix-lazy-definitions",
    name: "Fix definitions hidden by a missing blank line",
    description:
        "Insert the blank line a footnote definition needs when its label line sits directly under a paragraph, list item, quote line, or table - Obsidian reads such a line as plain text.",
    ignoreTypes: [
        IgnoreType.Code,
        IgnoreType.InlineCode,
        IgnoreType.Math,
        IgnoreType.Yaml,
    ],
    examples: [
        {
            description: "A definition typed directly under its paragraph gets its blank line",
            before: "Some prose[^1] here.\n[^1]: the definition",
            after: "Some prose[^1] here.\n\n[^1]: the definition",
        },
        {
            description: "Inside a callout the blank line is a bare quote line",
            before: "> [!note]\n> body[^1]\n> [^1]: the definition",
            after: "> [!note]\n> body[^1]\n>\n> [^1]: the definition",
        },
    ],
    apply: (text) => fixLazyDefinitions(text),
};
