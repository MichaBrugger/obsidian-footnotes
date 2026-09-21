import { inItemDefinitionLabels } from "../../parsing/list-item-definitions";
import { referenceOccurrences } from "../../parsing/footnote-grammar";
import { ClosingMarkChars, definitionLabelIn, referenceLandingAfter, TrailingPunctuationChars } from "../../parsing/markdown-scan";
import { rewriteDocument } from "../rewrite-document";
import { FootnoteRule } from "../rule";

// The obsidian-linter plugin's "footnote after punctuation" rule, rewritten
// here as a pure function: text in, text out. What it should and should not
// do is pinned by test/footnote-after-punctuation.test.ts.

// The ONE set of punctuation characters used across the plugin. The insert
// commands' end-of-word adjustment uses the same list
// (TrailingPunctuationChars: the ASCII punctuation plus the CJK fullwidth
// forms). It is escaped here so it can go inside a regular expression's
// square brackets.
const PunctuationClass = TrailingPunctuationChars.replace(
    /[.*+?^${}()|[\]\\-]/g,
    "\\$&",
);
// A reference that already sits after punctuation OR after a closing mark
// (a quote, a bracket, an emphasis marker) is where the convention puts it.
const AlreadyPlacedAfter = new RegExp(
    `[${PunctuationClass}${ClosingMarkChars.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}]`,
);

// Swap each run of references with the run of punctuation after it, within
// one stretch of a line.
//
// The references come from referenceOccurrences, so everything the shared
// grammar refuses to count as a reference is refused here too: an escaped
// "\[^1]" is literal prose, and the brackets of an "^[...]" inline footnote
// belong to that footnote. This file used to find them with a regular
// expression of its own, which swapped those shapes as well and so turned
// text the user had typed on purpose into a live reference (2026-08-11
// review, bug #1).
//
// The searching is done on the masked twin, but the text handed back is
// built from the original line. Otherwise a footnote name could come out
// with the blanking characters in it.
function swapInSegment(original: string, masked: string, insideBody = false, mayBeLabel = true): string {
    // a name holding whitespace is prose to Obsidian, not a reference to
    // move (Claude sweep 2026-09-13)
    const occurrences = referenceOccurrences(original, masked).filter(
        (occurrence) => !/\s/.test(occurrence.name),
    );
    let out = "";
    let copied = 0;
    let k = 0;
    while (k < occurrences.length) {
        // References written back to back move as one unit. Anything the
        // grammar refuses to count, sitting between two of them, ends the
        // run.
        let last = k;
        while (
            last + 1 < occurrences.length &&
            occurrences[last + 1].start === occurrences[last].end
        ) {
            last++;
        }
        const start = occurrences[k].start;
        const end = occurrences[last].end;
        k = last + 1;
        // The run of punctuation AND closing marks immediately after it,
        // the same walk the insert commands use (referenceLandingAfter:
        // "bravo[^1]". becomes "bravo".[^1], **bold[^1]** becomes
        // **bold**[^1], and a link's "(url)" tail is stepped over whole).
        // Taking both sides as whole runs is what lets one pass finish the
        // job, so running the lint again changes nothing: "[^1][^2]?!"
        // moves in one go.
        const punctuationEnd = referenceLandingAfter(masked, end);
        if (punctuationEnd === end) continue;
        // A SINGLE reference followed by ":" with nothing but whitespace,
        // quote markers, or dead text before it is a label the label reader
        // did not claim: one indented past three spaces inside a list item
        // ("    [^113]: def", a definition to Obsidian that the plugin does
        // not model yet), or one after a "%%" that is not a block's
        // closer. Swapping its colon would turn it into ":[^113]" for
        // good (Claude sweep 2026-09-13). Such a label can only sit after a
        // blank line or at the top of the note; the same shape directly
        // under prose is lazy paragraph text, a live reference before a
        // colon, and crosses it. A RUN of two or more references
        // is never a label, and neither is a reference at the start of a
        // definition's BODY: "[^1][^2]: x" is two live references and a
        // literal colon to Obsidian, and "[^1]: [^2]: x" a definition whose
        // body starts with a reference (Kimi hunt cycle 4, probed
        // 2026-09-16); both cross the colon like any punctuation.
        if (
            occurrences[last].start === start &&
            !insideBody &&
            mayBeLabel &&
            masked[end] === ":" &&
            masked.slice(0, start).replace(/[>%\0\s]/g, "") === ""
        ) {
            continue;
        }
        // A run of references that already comes AFTER punctuation or a
        // closing mark is where it should be. Any punctuation after it
        // belongs to the next clause, and moving the references again
        // would walk them further and further from the words they belong
        // to.
        if (start > 0 && AlreadyPlacedAfter.test(masked[start - 1])) continue;
        out +=
            original.slice(copied, start) +
            original.slice(end, punctuationEnd) +
            original.slice(start, end);
        copied = punctuationEnd;
    }
    return out + original.slice(copied);
}

/**
 * Move every footnote reference that sits before punctuation so it sits
 * after it instead: "word[^1]." becomes "word.[^1]".
 *
 * A definition's own label is never touched. The body of a definition is
 * prose like any other, so references in it are moved too. Code blocks,
 * inline code and frontmatter are left alone.
 */
export function footnoteAfterPunctuation(markdown: string): string {
    // The masked twin is built with the whole note in view. On a line where
    // a comment opens or closes, the part inside the comment is blanked
    // while the part outside it still gets the swap
    // (bug-comment-boundary-lines).
    return rewriteDocument(markdown, (_text, { lines, scan, maskedLines, definitionStarts }) => {
        // a definition inside a list item ("- [^la]: text") has a label the
        // margin reader does not see; the swap used to hop that label's
        // reference over its own colon and destroy the definition (found
        // by the sheet 23 tests, 2026-09-20; Jason's ruling 1 keeps such
        // definitions as they are)
        const inItemLabelEnds = new Map(
            inItemDefinitionLabels(lines, scan, maskedLines, definitionStarts).map((hit) => [hit.line, hit.labelEnd]),
        );

        const result = lines.map((line, i) => {
            if (scan.isProtected[i]) return line;
            const masked = maskedLines[i];
            // A definition's own "[^x]:" label is not a reference sitting
            // in front of a colon, so start after it. Labels inside a
            // blockquote or a callout ("> [^1]: def.") are labels just the
            // same (C22); the swap used to mangle those into
            // "> :[^1] def."
            // a byte order mark in front of a line-0 label is not text
            // the label reader sees, so it is stepped over first (the old
            // colon guard happened to cover it; spec-bom-before-line-zero-label)
            const bom = line.startsWith("\ufeff") ? 1 : 0;
            const prefixLength = inItemLabelEnds.get(i) ?? bom + (definitionLabelIn(line.slice(bom))?.labelEnd ?? 0);
            return (
                line.slice(0, prefixLength) +
                swapInSegment(
                    line.slice(prefixLength),
                    masked.slice(prefixLength),
                    prefixLength > bom,
                    i === 0 || lines[i - 1].trim() === "",
                )
            );
        });
        return result.join("\n");
    });
}

/** This rule's catalogue entry. The id matches obsidian-linter's file name. */
export const footnoteAfterPunctuationRule: FootnoteRule = {
    id: "footnote-after-punctuation",
    name: "Footnote after punctuation",
    description:
        'Move footnote references that sit before punctuation to sit after it ("word[^1]." → "word.[^1]").',
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
        {
            description:
                "An escaped literal \\[^1] is prose, not a reference - never moved",
            before: "prose \\[^1]. tail",
            after: "prose \\[^1]. tail",
        },
    ],
    apply: (text) => footnoteAfterPunctuation(text),
};
