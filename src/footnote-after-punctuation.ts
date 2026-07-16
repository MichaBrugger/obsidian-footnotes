import {
    DefinitionStart,
    maskInlineCode,
    protectedLines,
} from "./markdown-scan";

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
    const lines = markdown.split("\n");
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
    return result.join("\n");
}
