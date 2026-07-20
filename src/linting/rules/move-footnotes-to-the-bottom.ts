import {
    findDefinitionBlocks,
    normalizeEol,
    protectedLines,
    removeLineRanges,
    restoreEol,
} from "../../markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";

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
 * above the moved definitions, always separated from the body by a blank
 * line. A note whose end sits inside an unclosed
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
    // appending another would duplicate it. The setting is markdown that
    // can span MULTIPLE lines ("---\n## Footnotes"), so matching compares
    // line runs — single-line comparison kept re-adding multi-line
    // headings on every lint (bug reported 2026-07-17)
    const ranges: { start: number; end: number }[] = [...blocks];
    let headingMoved = false;
    let headingPresent = false;
    if (sectionHeading) {
        const headingLines = sectionHeading.split("\n");
        const headingRunAt = (start: number): boolean =>
            headingLines.every(
                (headingLine, k) =>
                    start + k < lines.length &&
                    !isProtected[start + k] &&
                    lines[start + k] === headingLine,
            );
        for (let i = 0; i + headingLines.length <= lines.length; i++) {
            if (!headingRunAt(i)) continue;
            const runEnd = i + headingLines.length - 1;
            let j = runEnd + 1;
            while (j < blocks[0].start && lines[j] === "") j++;
            if (
                !headingMoved &&
                runEnd < blocks[0].start &&
                j === blocks[0].start
            ) {
                ranges.unshift({ start: i, end: runEnd });
                headingMoved = true;
            } else {
                headingPresent = true;
            }
            i = runEnd; // never re-match inside this run
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
        // same layout rule as addFootnoteSectionHeader: a blank line always
        // separates the heading from the body above it (markdown block
        // convention; it also keeps a divider heading from turning the last
        // body line into a setext heading)
        headingPart = "\n\n" + sectionHeading;
    }

    const result =
        base === ""
            ? (includeHeading ? sectionHeading + "\n\n" : "") + definitions
            : base + headingPart + "\n\n" + definitions;
    return restoreEol(result + "\n".repeat(trailingNewlines), eol);
}

/**
 * Linter-shaped wrapper: id matches Linter's rule filename. The option is the
 * raw section-heading setting value (empty = no heading).
 */
export const moveFootnotesToTheBottomRule: FootnoteRule<string> = {
    id: "move-footnotes-to-the-bottom",
    name: "Move footnotes to the bottom",
    description:
        "Relocate every footnote definition block to the end of the note, keeping the blocks' relative order.",
    ignoreTypes: [
        IgnoreType.Code,
        IgnoreType.InlineCode,
        IgnoreType.Math,
        IgnoreType.Yaml,
    ],
    examples: [
        {
            description: "A mid-document definition moves to the bottom",
            before: "para one[^1].\n\n[^1]: def\n\npara two",
            after: "para one[^1].\n\npara two\n\n[^1]: def",
        },
        {
            description: "Definitions keep their relative order",
            before: "a[^2].\n\n[^2]: two\n\nb[^1].\n\n[^1]: one",
            after: "a[^2].\n\nb[^1].\n\n[^2]: two\n[^1]: one",
        },
    ],
    apply: (text, sectionHeading = "") =>
        moveFootnoteDefinitionsToBottom(text, sectionHeading),
};
