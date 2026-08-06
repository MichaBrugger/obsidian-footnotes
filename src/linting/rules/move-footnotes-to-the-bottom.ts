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
 * Gather every footnote definition block at the note's footnote section,
 * keeping the blocks' relative order (reordering is reindexFootnotes' job).
 * When `sectionHeading` is given (the raw setting value) and an exact
 * unprotected copy exists in the note, its FIRST occurrence anchors the
 * section: definitions gather directly under it, WHEREVER it is — linting
 * must obey the user's chosen section location instead of dragging the
 * section to the bottom (issue #55 follow-up, reported 2026-08-05).
 * Without an anchor, definitions move to the end of the note and the
 * heading (when configured) is inserted above them, always separated from
 * content by blank lines. A note whose end sits inside an unclosed fence
 * or comment is returned unchanged: appending there would turn the
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

    const definitions = blocks
        .map((block) => lines.slice(block.start, block.end + 1).join("\n"))
        .join("\n");

    // everything that isn't moving, in place (removeLineRanges collapses
    // the blank lines a cut leaves meeting each other)
    const body = removeLineRanges(lines, blocks);
    while (body.length > 0 && body[body.length - 1] === "") body.pop();

    // the setting is markdown that can span MULTIPLE lines
    // ("---\n## Footnotes"), so matching compares line runs — single-line
    // comparison kept re-adding multi-line headings on every lint (bug
    // reported 2026-07-17). The scan runs on the post-cut body: cutting
    // whole definition blocks can't change fence pairing, so protection is
    // re-derived safely.
    let anchorEnd = -1;
    if (sectionHeading) {
        const headingLines = sectionHeading.split("\n");
        const bodyProtected = protectedLines(body);
        for (let i = 0; i + headingLines.length <= body.length; i++) {
            const matches = headingLines.every(
                (headingLine, k) =>
                    !bodyProtected[i + k] && body[i + k] === headingLine,
            );
            if (matches) {
                anchorEnd = i + headingLines.length - 1;
                break;
            }
        }
    }

    if (anchorEnd !== -1) {
        const out: string[] = [];
        for (let i = 0; i <= anchorEnd; i++) {
            // normalize the blank line above the heading run's start —
            // same markdown block convention as everywhere else
            const headingStart = anchorEnd - sectionHeading.split("\n").length + 1;
            if (
                i === headingStart &&
                out.length > 0 &&
                out[out.length - 1] !== ""
            ) {
                out.push("");
            }
            out.push(body[i]);
        }
        out.push("", ...definitions.split("\n"));
        // the rest of the note follows below the gathered definitions,
        // separated by a blank line so it can't lazily continue the last
        // definition (same rule as buildDetailAppend)
        const rest = body.slice(anchorEnd + 1);
        while (rest.length > 0 && rest[0] === "") rest.shift();
        if (rest.length > 0) out.push("", ...rest);
        return restoreEol(
            out.join("\n") + "\n".repeat(trailingNewlines),
            eol,
        );
    }

    const base = body.join("\n");
    let headingPart = "";
    if (sectionHeading !== "" && base !== "") {
        // same layout rule as addFootnoteSectionHeader: a blank line always
        // separates the heading from the body above it (markdown block
        // convention; it also keeps a divider heading from turning the last
        // body line into a setext heading)
        headingPart = "\n\n" + sectionHeading;
    }

    const result =
        base === ""
            ? (sectionHeading !== "" ? sectionHeading + "\n\n" : "") +
              definitions
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
        "Gather every footnote definition block under the note's existing section heading, or at the end of the note when there is none, keeping the blocks' relative order.",
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
