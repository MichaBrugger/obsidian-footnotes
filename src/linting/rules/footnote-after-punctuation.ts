import {
    DefinitionStart,
    maskInlineCode,
    normalizeEol,
    protectedLines,
    restoreEol,
} from "../../markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";

// Linter's "footnote after punctuation" as a pure transform. Policy pinned
// in test/footnote-after-punctuation.test.ts.

// a run of markers directly followed by a run of punctuation; matching both
// as runs makes a single pass idempotent ("[^1][^2]?!" swaps as one unit)
const MarkersBeforePunctuation = /((?:\[\^[^[\]]+\])+)([.,;:!?]+)/g;

// Swap every marker-run/punctuation-run pair in one segment of a line. The
// scan runs on the code-masked text but the output is assembled from the
// original (a marker name could otherwise pick up mask characters).
function swapInSegment(original: string, masked: string): string {
    let out = "";
    let copied = 0;
    for (const match of masked.matchAll(MarkersBeforePunctuation)) {
        const start = match.index ?? 0;
        // a marker run already sitting AFTER punctuation is settled — the
        // punctuation following it belongs to the next clause, and swapping
        // again would drift it away from its text (idempotence)
        if (start > 0 && /[.,;:!?]/.test(masked[start - 1])) continue;
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
 * Move every footnote marker that sits before punctuation to sit after it
 * ("word[^1]." → "word.[^1]"). Definition prefixes are never touched;
 * definition content, like all other prose, is corrected. Code blocks,
 * inline code, and frontmatter are left alone.
 */
export function footnoteAfterPunctuation(markdown: string): string {
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const isProtected = protectedLines(lines);

    const result = lines.map((line, i) => {
        if (isProtected[i]) return line;
        const masked = maskInlineCode(line);
        // a definition's own "[^x]:" prefix must not be treated as a
        // marker-before-colon — skip past it
        const prefixLength = line.match(DefinitionStart)?.[0].length ?? 0;
        return (
            line.slice(0, prefixLength) +
            swapInSegment(line.slice(prefixLength), masked.slice(prefixLength))
        );
    });
    return restoreEol(result.join("\n"), eol);
}

/** Linter-shaped wrapper: id matches Linter's rule filename. */
export const footnoteAfterPunctuationRule: FootnoteRule = {
    id: "footnote-after-punctuation",
    name: "Footnote after punctuation",
    description:
        'Move footnote markers that sit before punctuation to sit after it ("word[^1]." → "word.[^1]").',
    ignoreTypes: [
        IgnoreType.Code,
        IgnoreType.InlineCode,
        IgnoreType.Math,
        IgnoreType.Yaml,
    ],
    examples: [
        {
            description: "Marker before a period moves after it",
            before: "word[^1].",
            after: "word.[^1]",
        },
        {
            description: "A run of markers crosses a run of punctuation as one unit",
            before: "wait[^1]?!",
            after: "wait?![^1]",
        },
        {
            description: "Markers inside inline code are left alone",
            before: "use `x[^1].` as-is",
            after: "use `x[^1].` as-is",
        },
    ],
    apply: (text) => footnoteAfterPunctuation(text),
};
