import {
    definitionStartLines,
    lazyDefinitionLabelLines,
    maskProtectedLines,
    scanDocument,
} from "../../parsing/markdown-scan";
import { rewriteDocument } from "../rewrite-document";
import { FootnoteRule } from "../rule";

// The "Fix definitions hidden by a missing blank line" rule.
//
// The problem it fixes: when you type a "[^x]:" line directly under a line
// of prose (a paragraph, a list item, a quote or callout line, a table row)
// with no blank line between them, Obsidian does not see a definition. It
// sees more of the paragraph. The project calls such a line a "lazy label";
// definitionStartLines in the scanner is what decides it. You meant a
// definition and are one blank line short of it.
//
// What this rule does: inserts that blank line.
//
// Why it runs first in the lint pipeline: every rule after it should judge
// the definition you meant, not the prose line Obsidian saw. Once the blank
// line exists, move-to-bottom gathers the definition, the orphan and
// duplicate rules judge it, and reindex numbers it.
//
// When the setting is off, nothing is inserted and the lazy-definition lint
// alert reports the line instead. (Ruling: Jason, 2026-09-09.)

// The blockquote markers in front of a label line. Inside a quote, a line
// holding nothing but those same ">" markers is what counts as a blank
// line, so the inserted line copies them (checked against the real app,
// ground truth 2026-09-09).
const QuoteMarkers = /^ {0,3}((?:>[ \t]?)*)/;

/**
 * `markdown` with one blank line inserted above each hidden definition, or a
 * bare quote line where the definition is inside a quote. A note that has no
 * hidden definitions comes back byte for byte as it went in.
 */
export function fixLazyDefinitions(markdown: string): string {
    return rewriteDocument(markdown, (text, view) => {
        let lines = view.lines;
        let lazy = lazyDefinitionLabelLines(lines, view.scan, view.maskedLines, view.definitionStarts);
        if (lazy.length === 0) return text;
        // Insert one line above the TOPMOST lazy label, then look at the
        // note again. That single blank line often turns the labels below it
        // into definitions too, because a label sitting directly under a
        // definition is itself a definition. Inserting above every lazy
        // label in one go would therefore add lines that are not needed.
        //
        // Each time round, at least the label being aimed at becomes a
        // definition, so this always finishes. The loop count is only a
        // safety net, not what actually stops it.
        for (let guard = lazy.length; guard > 0 && lazy.length > 0; guard--) {
            const at = lazy[0];
            const markers = (QuoteMarkers.exec(lines[at])?.[1] ?? "").trimEnd();
            lines = [...lines.slice(0, at), markers, ...lines.slice(at)];
            const scan = scanDocument(lines);
            const masked = maskProtectedLines(lines, scan);
            lazy = lazyDefinitionLabelLines(lines, scan, masked, definitionStartLines(lines, scan, (i) => masked[i]));
            // The label being aimed at did not become a definition. Stop,
            // rather than pile blank line on blank line above it. No known
            // piece of markdown behaves this way; the property test in
            // test/fix-lazy-definitions.test.ts is watching in case one
            // turns up.
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
