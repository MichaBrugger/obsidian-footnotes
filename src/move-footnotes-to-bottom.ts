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
 * `sectionHeading` is given (the raw setting value), a copy sitting directly
 * above the first definition block moves along with the definitions; if no
 * unprotected line in the note already equals the heading, one is inserted
 * above the moved definitions — dividers get a separating blank line so they
 * can't form a setext heading. A note whose end sits inside an unclosed
 * fence or comment is returned unchanged: appending there would turn the
 * definitions into inert code.
 */
export function moveFootnoteDefinitionsToBottom(
    markdown: string,
    sectionHeading = "",
): string {
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");

    // remember the document's trailing newlines; they go back on at the end
    let trailingNewlines = 0;
    while (lines.length > 1 && lines[lines.length - 1] === "") {
        lines.pop();
        trailingNewlines++;
    }

    const isProtected = protectedLines(lines);
    const blocks = findDefinitionBlocks(lines, isProtected);
    if (blocks.length === 0) return markdown;

    // probe whether a line appended at EOF would itself be protected (an
    // unclosed fence or comment runs to EOF) — relocating definitions into
    // such a region would sever them from their markers
    const probe = protectedLines([...lines, "", "probe"]);
    if (probe[probe.length - 1]) return markdown;

    // a heading directly above the first definition block (blanks only in
    // between) owns the definitions and moves with them; any other exact
    // unprotected occurrence means the note already has the heading and
    // appending another would duplicate it
    const ranges: { start: number; end: number }[] = [...blocks];
    let headingMoved = false;
    let headingPresent = false;
    if (sectionHeading) {
        for (let i = 0; i < lines.length; i++) {
            if (isProtected[i] || lines[i] !== sectionHeading) continue;
            let j = i + 1;
            while (j < blocks[0].start && lines[j] === "") j++;
            if (!headingMoved && i < blocks[0].start && j === blocks[0].start) {
                ranges.unshift({ start: i, end: i });
                headingMoved = true;
            } else {
                headingPresent = true;
            }
        }
    }

    // everything that isn't moving, in place (removeLineRanges collapses
    // the blank lines a cut leaves meeting each other)
    const body = removeLineRanges(lines, ranges);
    while (body.length > 0 && body[body.length - 1] === "") body.pop();

    const definitions = blocks
        .map((block) => lines.slice(block.start, block.end + 1).join("\n"))
        .join("\n");

    const base = body.join("\n");
    const includeHeading = sectionHeading !== "" && !headingPresent;
    let headingPart = "";
    if (includeHeading && base !== "") {
        // same layout rule as addFootnoteSectionHeader: a divider needs a
        // blank line above it, a text heading sits right under the body
        const divider = /^(---|\*\*\*|___)/.test(sectionHeading);
        headingPart = (divider ? "\n\n" : "\n") + sectionHeading;
    }

    const result =
        base === ""
            ? (includeHeading ? sectionHeading + "\n\n" : "") + definitions
            : base + headingPart + "\n\n" + definitions;
    return restoreEol(result + "\n".repeat(trailingNewlines), eol);
}
