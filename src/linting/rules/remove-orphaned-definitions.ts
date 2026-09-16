import {
    definitionLabelWithName,
    referenceOccurrences,
} from "../../parsing/footnote-grammar";
import {
    DefinitionBlock,
    DocumentScan,
    definitionStartLines,
    findDefinitionBlocks,
    maskProtectedLines,
    normalizeEol,
    quotedDefinitionEnd,
    removeLineRanges,
    restoreEol,
    scanDocument,
} from "../../parsing/markdown-scan";
import { FootnoteRule } from "../rule";

// Deleting orphaned definitions, as a rule of its own (2026-08-10).
//
// This used to live inside reindex, as its keepOrphanedDefinitions option,
// which reindexFootnotes still honours for code that calls it directly. The
// lint runs this rule instead, for two reasons: the "Delete orphaned
// definitions" toggle then works even with reindexing switched off, and the
// two orphan settings behave the same as each other.
//
// Deletion follows the chain. A definition kept alive only by a reference in
// another definition's body dies when that one dies, however long the chain
// gets, and it all happens in ONE call, so the repeat limit in reindex never
// comes into it. Definitions that reference each other in a ring count as
// referenced and survive, exactly as they do under reindex.

interface ReferenceScan {
    blocks: DefinitionBlock[];
    /**
     * For each name, lower-cased, how many references to it there are on
     * lines OUTSIDE every definition block.
     */
    liveRefs: Map<string, number>;
    /**
     * One entry per definition block: the names, lower-cased, that its own
     * lines reference.
     */
    blockRefs: string[][];
}

function scanReferences(
    lines: string[],
    scan: DocumentScan,
    // The alerts pass in the masked twin and the definition starts they
    // have already worked out
    precomputedMasked?: string[],
    precomputedStarts?: boolean[],
): ReferenceScan {
    // The masked twin is built with the whole note in view: a protected
    // line is nothing but NUL characters, so it matches nothing, and on a
    // line where a comment opens or closes, only the part inside the
    // comment is blanked.
    const maskedLines = precomputedMasked ?? maskProtectedLines(lines, scan);
    const starts = precomputedStarts ?? definitionStartLines(lines, scan, (i) => maskedLines[i]);
    const blocks = findDefinitionBlocks(lines, scan, maskedLines, starts);

    // Following through on C22 (parallel-review probe, 2026-08-10). A label
    // inside a blockquote or a callout, "> [^x]: ...", is a REAL
    // definition. It becomes a block here too, running to the end of its
    // continuation inside the quote (quotedDefinitionEnd). It used to be a
    // block one line long, on the belief that a quote has no continuation
    // lines; Obsidian disagrees, and cutting the label alone left its body
    // behind as quoted code, whose references died with it, so the next
    // lint deleted a definition only that body had been citing (Claude
    // sweep 2026-09-13). Now the body goes with its label, and a
    // definition only that body cited dies in the same call, exactly as
    // under a column-0 orphan.
    //
    // And no definition label, of either shape, ever counts as a reference.
    // A label defines a footnote; it does not point at one. Counting labels
    // as references kept orphaned definitions alive.
    const labelStartAt = new Array<number>(lines.length).fill(-1);
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] || !starts[i]) continue;
        const hit = definitionLabelWithName(lines[i], maskedLines[i]);
        if (!hit) continue;
        // The "[^x]" at the head of a real label is not a reference. A LAZY
        // label's "[^x]" is one, because that is how it renders, and it
        // does keep the definition it points at alive. So only real
        // definition starts are recorded here.
        labelStartAt[i] = hit.label.nameStart - 2;
        // A label after a "%%" closer defines its footnote, but its line
        // holds the closer, so it is never a block this rule may cut out:
        // deleting the line would leave the comment open over the rest of
        // the note. It is still a block for the ALERT: an orphan the rule
        // will not delete is named, never passed over in silence (ADR 2;
        // Kimi hunt cycle 1, 2026-09-16).
        if (hit.label.quoted) {
            blocks.push({
                name: hit.name,
                start: i,
                end: hit.label.afterCloser ? i : quotedDefinitionEnd(lines, scan, starts, i),
                ...(hit.label.afterCloser ? { holdsCloser: true as const } : {}),
            });
        }
    }
    blocks.sort((a, b) => a.start - b.start);

    const blockAtLine = new Array<number>(lines.length).fill(-1);
    blocks.forEach((block, i) => {
        for (let line = block.start; line <= block.end; line++) {
            blockAtLine[line] = i;
        }
    });

    const liveRefs = new Map<string, number>();
    const blockRefs: string[][] = blocks.map(() => []);
    for (let i = 0; i < lines.length; i++) {
        for (const { name: raw, start } of referenceOccurrences(
            lines[i],
            maskedLines[i],
            starts[i],
        )) {
            // A label at the left margin is already left out by
            // footnoteReferenceMatches. One inside a blockquote looks like
            // an ordinary mid-line reference, so it is skipped here.
            if (start === labelStartAt[i]) continue;
            const name = raw.toLowerCase();
            if (blockAtLine[i] === -1) {
                liveRefs.set(name, (liveRefs.get(name) ?? 0) + 1);
            } else {
                blockRefs[blockAtLine[i]].push(name);
            }
        }
    }
    return { blocks, liveRefs, blockRefs };
}

/**
 * The definition blocks nothing keeps alive.
 *
 * The method: go round removing every definition whose name has no
 * references left, and each time one goes, take away the references its own
 * body was making. Repeat until a round removes nothing. Two definitions
 * sharing a name live or die together, since a reference to that name is a
 * reference to both.
 *
 * This always finishes, because every round but the last removes at least
 * one block.
 */
function orphanedBlocks(referenceScan: ReferenceScan): DefinitionBlock[] {
    const { blocks, liveRefs, blockRefs } = referenceScan;
    const refCount = new Map(liveRefs);
    for (const refs of blockRefs) {
        for (const name of refs) {
            refCount.set(name, (refCount.get(name) ?? 0) + 1);
        }
    }
    const alive = new Set(blocks.map((_, i) => i));
    let changed = true;
    while (changed) {
        changed = false;
        for (const i of [...alive]) {
            if ((refCount.get(blocks[i].name.toLowerCase()) ?? 0) > 0) continue;
            alive.delete(i);
            for (const name of blockRefs[i]) {
                refCount.set(name, (refCount.get(name) ?? 0) - 1);
            }
            changed = true;
        }
    }
    return blocks.filter((_, i) => !alive.has(i));
}

/**
 * The list the alert reads out: the names of definitions nothing
 * references, each once, spelled as they were written, in the order the
 * definitions appear.
 *
 * This deliberately does not follow chains. A definition referenced only
 * from an orphan's body still counts as referenced, which is what the
 * alert's wording says. Once the user fixes the orphan that was listed, the
 * next lint reports that one.
 */
export function orphanedFootnoteDefinitionNames(
    markdown: string,
    // The alerts all share ONE pass of normalizing the line endings and
    // scanning the note, done once and handed round (2026-08-11 review, a
    // speed fix). Anything calling this on its own leaves it out.
    precomputed?: { lines: string[]; scan: DocumentScan; masked?: string[]; starts?: boolean[] },
): string[] {
    // No "[^" anywhere in the note means no definitions, and so no
    // orphaned ones. Worth checking first, because this runs on every
    // single lint (speed fix F4).
    if (!markdown.includes("[^")) return [];
    const lines = precomputed?.lines ?? normalizeEol(markdown).text.split("\n");
    const referenceScan = scanReferences(
        lines,
        precomputed?.scan ?? scanDocument(lines),
        precomputed?.masked,
        precomputed?.starts,
    );
    const referenced = new Set(referenceScan.liveRefs.keys());
    for (const refs of referenceScan.blockRefs) {
        for (const name of refs) referenced.add(name);
    }
    const names: string[] = [];
    const seen = new Set<string>();
    for (const block of referenceScan.blocks) {
        const folded = block.name.toLowerCase();
        if (referenced.has(folded) || seen.has(folded)) continue;
        seen.add(folded);
        names.push(block.name);
    }
    return names;
}

/**
 * The definition blocks nothing keeps alive, following chains all the way
 * down; see the note at the top of this file.
 *
 * Reindex's own keepOrphanedDefinitions:false path calls this too, so both
 * routes to deleting orphaned definitions always agree, however long the
 * chain.
 */
export function orphanedDefinitionBlocks(
    lines: string[],
    scan: DocumentScan,
): DefinitionBlock[] {
    // a definition whose line holds a comment closer is reported by the
    // alert but never cut (see scanReferences)
    return orphanedBlocks(scanReferences(lines, scan)).filter((block) => !block.holdsCloser);
}

/**
 * `markdown` with every unreferenced definition block removed, following
 * chains all the way down; see the note at the top of this file. Protected
 * text, and everything that is referenced, stays exactly where it is.
 */
export function removeOrphanedFootnoteDefinitions(markdown: string): string {
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const scan = scanDocument(lines);
    const dead = orphanedDefinitionBlocks(lines, scan);
    if (dead.length === 0) return markdown;
    const out = removeLineRanges(lines, dead);
    // The same promise the orphan-reference rule makes: a deletion that
    // changes how Obsidian reads a line it did not touch is refused
    // outright, and the orphans stay for the user to sort out (the alert
    // names them). Cutting a block can put the line below it under a
    // setext underline or a blank line, which turns a lazy label there
    // into a real definition that the NEXT lint then deletes as an orphan,
    // so lint twice was not lint once (Kimi hunt cycle 2, 2026-09-16).
    if (linesReadDifferently(lines, scan, dead, out)) return markdown;
    return restoreEol(out.join("\n"), eol);
}

/**
 * Whether any line the cut kept is read differently afterwards: protected
 * where it was live, or a definition start where it was not (or the other
 * way round). The kept lines are walked in step with the result; a blank
 * line the cut collapsed is skipped over.
 */
function linesReadDifferently(
    lines: string[],
    scan: DocumentScan,
    dead: DefinitionBlock[],
    out: string[],
): boolean {
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);
    const scanAfter = scanDocument(out);
    const maskedAfter = maskProtectedLines(out, scanAfter);
    const startsAfter = definitionStartLines(out, scanAfter, (i) => maskedAfter[i]);
    const cut = new Set<number>();
    for (const block of dead) for (let i = block.start; i <= block.end; i++) cut.add(i);
    let j = 0;
    for (let i = 0; i < lines.length; i++) {
        if (cut.has(i)) continue;
        if (out[j] !== lines[i]) {
            // a blank line the cut merged away, or dropped from the end of
            // the note (removeLineRanges takes the separator blank with a
            // block cut from the end)
            if (lines[i].trim() === "") continue;
            return true;
        }
        if (scan.isProtected[i] !== scanAfter.isProtected[j] || starts[i] !== startsAfter[j]) return true;
        j++;
    }
    return false;
}

/** This rule's catalogue entry. */
export const removeOrphanedDefinitionsRule: FootnoteRule = {
    id: "remove-orphaned-definitions",
    name: "Remove orphaned definitions",
    description:
        "Delete footnote definitions that nothing references, including chains only kept alive by each other's bodies.",
    examples: [
        {
            description: "An unreferenced definition is removed",
            before: "text[^1]\n\n[^1]: used\n[^9]: stray",
            after: "text[^1]\n\n[^1]: used",
        },
        {
            description: "A definition only an orphan's body references dies with it",
            before: "text\n\n[^a]: uses[^b]\n[^b]: chained",
            after: "text",
        },
    ],
    apply: (text) => removeOrphanedFootnoteDefinitions(text),
};
