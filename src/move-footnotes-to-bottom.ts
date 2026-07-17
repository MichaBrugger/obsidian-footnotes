import {
    findDefinitionBlocks,
    normalizeEol,
    protectedLines,
    removeLineRanges,
    restoreEol,
} from "./markdown-scan";

// Linter's "move footnotes to the bottom" as a pure transform, integrated
// with the plugin's section-heading setting. Policy pinned in
// test/move-footnotes-to-bottom.test.ts. The output layout deliberately
// matches buildDetailAppend's insert flow, so a note the plugin built is a
// fixed point of this transform.

/**
 * Relocate every footnote definition block to the end of the note, keeping
 * the blocks' relative order (reordering is reindexFootnotes' job). When
 * `sectionHeading` is given (the raw setting value) and not already sitting
 * at the end of the body, it is inserted above the definitions — dividers
 * get a separating blank line so they can't form a setext heading.
 */
export function moveFootnoteDefinitionsToBottom(
    markdown: string,
    sectionHeading = "",
): string {
    const { text, eol } = normalizeEol(markdown);
    let lines = text.split("\n");

    // remember the document's trailing newlines; they go back on at the end
    let trailingNewlines = 0;
    while (lines.length > 1 && lines[lines.length - 1] === "") {
        lines.pop();
        trailingNewlines++;
    }

    const isProtected = protectedLines(lines);
    const blocks = findDefinitionBlocks(lines, isProtected);
    if (blocks.length === 0) return markdown;

    // everything that isn't a definition block, in place (removeLineRanges
    // collapses the blank lines a cut leaves meeting each other)
    const body = removeLineRanges(lines, blocks);
    while (body.length > 0 && body[body.length - 1] === "") body.pop();

    const definitions = blocks
        .map((block) => lines.slice(block.start, block.end + 1).join("\n"))
        .join("\n");

    const base = body.join("\n");
    let headingPart = "";
    if (sectionHeading && !base.endsWith(sectionHeading)) {
        // same layout rule as addFootnoteSectionHeader: a divider needs a
        // blank line above it, a text heading sits right under the body
        const divider = /^(---|\*\*\*|___)/.test(sectionHeading);
        headingPart = (divider ? "\n\n" : "\n") + sectionHeading;
    }

    const result =
        base === ""
            ? (sectionHeading ? sectionHeading + "\n\n" : "") + definitions
            : base + headingPart + "\n\n" + definitions;
    return restoreEol(result + "\n".repeat(trailingNewlines), eol);
}
