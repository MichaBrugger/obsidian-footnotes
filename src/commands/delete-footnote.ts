import {
    definitionLabelWithName,
    quotedDefinitionLabel,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import {
    DefinitionBlock,
    definitionStartLines,
    findDefinitionBlocks,
    maskProtectedLines,
    normalizeEol,
    quotedDefinitionEnd,
    removeLineRanges,
    restoreEol,
    scanDocument,
} from "../parsing/markdown-scan";
import { cutOne } from "../linting/rules/remove-orphaned-references";

// Deleting a footnote everywhere (T4 of the 2026-09 feature round; Jason's
// rulings 2026-09-19 to 2026-09-21).
//
// Obsidian's own right-click "Delete footnote and reference" removes the
// one reference that was clicked and the definition. A footnote cited in
// two places keeps its other reference, now pointing at nothing (Jason's
// report, 2026-09-19). This command deletes the definition AND every
// reference to it, from whichever end the caret sits on, in one step and
// one undo.
//
// The work is a pure markdown-to-markdown transform, the way the lint
// rules are written, so the command can write it back as one transaction
// that keeps folds and the caret (replaceMinimal), and so the transform can
// be property-tested with the same generator the rules use.

export type DeleteFootnotePlan =
    | {
          kind: "deleted";
          markdown: string;
          /** how many references were cut out of the text (a reference inside a deleted definition's own body is not counted: it went with the block) */
          references: number;
          /** how many definition blocks were removed */
          definitions: number;
      }
    /** the note holds no live reference or definition with this name */
    | { kind: "nothing" }
    /** the deletion would change how Obsidian reads text it was not asked to touch, or the definition is one the plugin never cuts; nothing was changed and `reason` says why, in the toast's words */
    | { kind: "refused"; reason: string };

/**
 * `markdown` with the footnote called `name` gone: every live reference to
 * it cut out of the text with the gap closed, and every definition block
 * of that name removed. Names match without regard to case, as Obsidian
 * matches them. Copies inside code, math, comments or frontmatter are
 * plain text and stay.
 */
export function deleteFootnoteEverywhere(markdown: string, name: string): DeleteFootnotePlan {
    const folded = name.toLowerCase();
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);

    const blocks: DefinitionBlock[] = findDefinitionBlocks(lines, scan, masked, starts).filter(
        (block) => block.name.toLowerCase() === folded,
    );
    // A label inside a blockquote or callout ("> [^x]: ...") is a real
    // definition everywhere else in the plugin but never forms a block, so
    // it is collected here with the quoted continuation Obsidian gives it
    // (the same reading the orphan-definition rule uses). A label that
    // shares its line with the "%%" closing a comment is never cut, since
    // the line would take the closer with it and leave the comment open
    // over the rest of the note; the command refuses and says so.
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] || !starts[i]) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (!hit || hit.name.toLowerCase() !== folded) continue;
        if (hit.label.afterCloser) {
            return {
                kind: "refused",
                reason: `Nothing was deleted: the ${quotedDefinitionLabel(hit.name)} definition shares its line with the "%%" that closes a comment, so cutting it would leave the comment open. Delete it by hand.`,
            };
        }
        if (hit.label.quoted) {
            blocks.push({ name: hit.name, start: i, end: quotedDefinitionEnd(lines, scan, starts, i) });
        }
    }
    blocks.sort((a, b) => a.start - b.start);
    // the lines a block cut takes with it: a reference on one of them
    // goes with the block and is not cut, or counted, on its own
    const cut = new Set<number>();
    for (const block of blocks) {
        for (let i = block.start; i <= block.end; i++) cut.add(i);
    }

    let references = 0;
    const cutLines = lines.map((line, i) => {
        if (scan.isProtected[i] || cut.has(i)) return line;
        // rightmost first, so that cutting one keeps the offsets of the
        // ones before it
        const hits = referenceOccurrences(line, masked[i], starts[i])
            .filter((occurrence) => occurrence.name.toLowerCase() === folded)
            .reverse();
        references += hits.length;
        return hits.reduce((kept, { start, end }) => cutOne(kept, start, end), line);
    });
    if (references === 0 && blocks.length === 0) return { kind: "nothing" };

    const out = removeLineRanges(cutLines, blocks);
    return {
        kind: "deleted",
        markdown: restoreEol(out.join("\n"), eol),
        references,
        definitions: blocks.length,
    };
}
