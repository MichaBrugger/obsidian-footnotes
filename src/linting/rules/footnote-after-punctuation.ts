import {
    DefinitionStart,
    maskProtectedLines,
    normalizeEol,
    scanDocument,
    restoreEol,
    TrailingPunctuationChars,
} from "../../markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";

// Linter's "footnote after punctuation" as a pure transform. Policy pinned
// in test/footnote-after-punctuation.test.ts.

// the ONE punctuation class shared with the insert commands' end-of-word
// hop (TrailingPunctuationChars: ASCII + CJK fullwidth), escaped for use
// inside a regex character class
const PunctuationClass = TrailingPunctuationChars.replace(
    /[.*+?^${}()|[\]\\-]/g,
    "\\$&",
);

// a run of references directly followed by a run of punctuation; matching both
// as runs makes a single pass idempotent ("[^1][^2]?!" swaps as one unit)
const ReferencesBeforePunctuation = new RegExp(
    `((?:\\[\\^[^[\\]]+\\])+)([${PunctuationClass}]+)`,
    "g",
);
const SinglePunctuation = new RegExp(`[${PunctuationClass}]`);

// Swap every reference-run/punctuation-run pair in one segment of a line. The
// scan runs on the code-masked text but the output is assembled from the
// original (a reference name could otherwise pick up mask characters).
function swapInSegment(original: string, masked: string): string {
    let out = "";
    let copied = 0;
    for (const match of masked.matchAll(ReferencesBeforePunctuation)) {
        const start = match.index ?? 0;
        // a reference run already sitting AFTER punctuation is settled — the
        // punctuation following it belongs to the next clause, and swapping
        // again would drift it away from its text (idempotence)
        if (start > 0 && SinglePunctuation.test(masked[start - 1])) continue;
        const punctuationStart = start + match[1].length;
        const end = start + match[0].length;
        out +=
            original.slice(copied, start) +
            original.slice(punctuationStart, end) +
            original.slice(start, punctuationStart);
        copied = end;
    }
    return out + original.slice(copied);
}

/**
 * Move every footnote reference that sits before punctuation to sit after it
 * ("word[^1]." → "word.[^1]"). Definition prefixes are never touched;
 * definition content, like all other prose, is corrected. Code blocks,
 * inline code, and frontmatter are left alone.
 */
export function footnoteAfterPunctuation(markdown: string): string {
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    // document-aware masking: the comment portions of multi-line boundary
    // lines are masked while their live portions still get the swap
    // (bug-comment-boundary-lines)
    const scan = scanDocument(lines);
    const maskedLines = maskProtectedLines(lines, scan);

    const result = lines.map((line, i) => {
        if (scan.isProtected[i]) return line;
        const masked = maskedLines[i];
        // a definition's own "[^x]:" prefix must not be treated as a
        // reference-before-colon — skip past it
        const prefixLength = line.match(DefinitionStart)?.[0].length ?? 0;
        return (
            line.slice(0, prefixLength) +
            swapInSegment(line.slice(prefixLength), masked.slice(prefixLength))
        );
    });
    const joined = result.join("\n");
    // byte-identical no-op on mixed-EOL notes (spec-mixed-eol-noop-rewrite)
    return joined === text ? markdown : restoreEol(joined, eol);
}

/** Linter-shaped wrapper: id matches Linter's rule filename. */
export const footnoteAfterPunctuationRule: FootnoteRule = {
    id: "footnote-after-punctuation",
    name: "Footnote after punctuation",
    description:
        'Move footnote references that sit before punctuation to sit after it ("word[^1]." → "word.[^1]").',
    ignoreTypes: [
        IgnoreType.Code,
        IgnoreType.InlineCode,
        IgnoreType.Math,
        IgnoreType.Yaml,
    ],
    examples: [
        {
            description: "Reference before a period moves after it",
            before: "word[^1].",
            after: "word.[^1]",
        },
        {
            description: "A run of references crosses a run of punctuation as one unit",
            before: "wait[^1]?!",
            after: "wait?![^1]",
        },
        {
            description: "References inside inline code are left alone",
            before: "use `x[^1].` as-is",
            after: "use `x[^1].` as-is",
        },
    ],
    apply: (text) => footnoteAfterPunctuation(text),
};
