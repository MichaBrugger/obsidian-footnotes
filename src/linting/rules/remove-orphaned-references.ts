import {
    definitionLabelWithName,
    isValidFootnoteName,
    referenceOccurrences,
} from "../../parsing/footnote-grammar";
import {
    definitionStartLines,
    DocumentScan,
    lazyDefinitionLabelLines,
    maskProtectedLines,
    normalizeEol,
    restoreEol,
    scanDocument,
} from "../../parsing/markdown-scan";
import { IgnoreType } from "../ignore-types";
import { FootnoteRule } from "../rule";

// Orphaned REFERENCES: the other side of reindex's orphaned definitions
// (requested 2026-08-10).
//
// A "[^5]" with no "[^5]:" line anywhere in the note renders as plain text
// in Obsidian, not as a footnote. So the lint either reports them, which is
// what it does by default, or, with the "Orphaned references" setting on
// Delete, takes them out of the text.
//
// Three kinds of reference are left alone either way:
//
//  - Names are compared without regard to case, so a definition written
//    with different capitals still counts as that reference's definition.
//  - A name Obsidian will not accept, one with a space or a backtick in it,
//    is not a footnote there either. Deleting "[^my note]" would destroy
//    ordinary prose, so those stay. The creation path already warns about
//    such names.
//  - The note's own bare-prefix placeholder, "[^2.]" in a note whose prefix
//    is "2.", is a footnote the user is in the middle of naming. The
//    unnamed-reference alert speaks for it. Deleting it from under the
//    user's caret would be losing their work.

/**
 * Every name the note defines, lower-cased. That covers labels at the left
 * margin and labels inside a blockquote or callout (C22).
 *
 * definitionLabelWithName is the piece that finds a label against the masked
 * twin but cuts its name out of the raw line, so names never come back with
 * blanking characters in them.
 */
function definitionNamesFolded(lines: string[], masked: string[], starts: boolean[]): Set<string> {
    const names = new Set<string>();
    for (let i = 0; i < masked.length; i++) {
        if (!starts[i]) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (hit) names.add(hit.name.toLowerCase());
    }
    return names;
}

/**
 * The names on lines that look like labels but are NOT definitions. A
 * "[^x]:" line directly under a line of prose is more paragraph text to
 * Obsidian, as definitionStartLines decides; it is one blank line short of
 * the definition the user meant. The project calls it a lazy label.
 *
 * The names come back in the order they first appear, spelled as first
 * seen, with protected lines skipped.
 *
 * This is exported for the lint alert that lists them. Here it matters for a
 * different reason: a reference pointing at a lazy label is not an orphan to
 * delete. The fix is a blank line, and deleting the reference would throw
 * the user's work away (2026-09-09).
 */
export function lazyDefinitionLabelNames(
    lines: string[],
    scan: DocumentScan,
    masked: string[],
    starts: boolean[],
): string[] {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const i of lazyDefinitionLabelLines(lines, scan, masked, starts)) {
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (!hit) continue;
        const folded = hit.name.toLowerCase();
        if (seen.has(folded)) continue;
        seen.add(folded);
        names.push(hit.name);
    }
    return names;
}

/**
 * True when this reference is an orphaned reference the setting should act
 * on.
 */
function isOrphan(
    name: string,
    definitions: Set<string>,
    lazyLabels: Set<string>,
    orphanSafeFolded: string,
): boolean {
    const folded = name.toLowerCase();
    if (definitions.has(folded)) return false;
    if (lazyLabels.has(folded)) return false;
    if (!isValidFootnoteName(name)) return false;
    if (orphanSafeFolded !== "" && folded === orphanSafeFolded) return false;
    return true;
}

/**
 * The list the alert reads out: the names of orphaned references, each once,
 * in the order they first appear, spelled as first seen.
 *
 * `orphanSafePrefix` is the note's own footnote-prefix, when the prefix
 * feature is on and the prefix is valid. It is "" otherwise.
 */
export function orphanedFootnoteReferenceNames(
    markdown: string,
    orphanSafePrefix = "",
    // The alerts all share ONE pass of normalizing the line endings,
    // scanning the note and building the masked twin, done once and handed
    // round (2026-08-11 review, a speed fix). Anything calling this on its
    // own leaves it out.
    precomputed?: { lines: string[]; masked: string[]; scan?: DocumentScan; starts?: boolean[] },
): string[] {
    // No "[^" anywhere in the note means no references, and so no orphaned
    // ones. Worth checking first, because this runs on every single lint
    // (speed fix F4).
    if (!markdown.includes("[^")) return [];
    const lines = precomputed?.lines ?? normalizeEol(markdown).text.split("\n");
    const scan = precomputed?.scan ?? scanDocument(lines);
    const masked = precomputed?.masked ?? maskProtectedLines(lines, scan);
    const starts = precomputed?.starts ?? definitionStartLines(lines, scan, (i) => masked[i]);
    const definitions = definitionNamesFolded(lines, masked, starts);
    const lazyLabels = new Set(
        lazyDefinitionLabelNames(lines, scan, masked, starts).map((n) => n.toLowerCase()),
    );
    const orphanSafeFolded = orphanSafePrefix.toLowerCase();

    const names: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < masked.length; i++) {
        for (const { name } of referenceOccurrences(lines[i], masked[i], starts[i])) {
            if (!isOrphan(name, definitions, lazyLabels, orphanSafeFolded)) continue;
            const folded = name.toLowerCase();
            if (!seen.has(folded)) {
                seen.add(folded);
                names.push(name);
            }
        }
    }
    return names;
}

/**
 * `markdown` with every orphaned reference taken out of the text.
 * Definitions, protected text and the three exceptions listed at the top of
 * this file are left alone.
 *
 * The spacing closes up neatly: "a [^1] b" becomes "a b", and a reference
 * that was the last thing on its line takes the space in front of it with
 * it. Spaces the line already ended with stay, because two of them at the
 * end of a line are a markdown line break the user typed on purpose.
 */
export function removeOrphanedFootnoteReferences(
    markdown: string,
    orphanSafePrefix = "",
): string {
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);
    const definitions = definitionNamesFolded(lines, masked, starts);
    const lazyLabels = new Set(
        lazyDefinitionLabelNames(lines, scan, masked, starts).map((n) => n.toLowerCase()),
    );
    const orphanSafeFolded = orphanSafePrefix.toLowerCase();

    const out = lines.map((line, i) => {
        if (scan.isProtected[i]) return line;
        let result = "";
        let copied = 0;
        let changed = false;
        for (const { name, start, end } of referenceOccurrences(
            line,
            masked[i],
            starts[i],
        )) {
            if (!isOrphan(name, definitions, lazyLabels, orphanSafeFolded)) continue;
            result += line.slice(copied, start);
            copied = end;
            // Closing the gap: a space just after the cut is dropped when
            // the text before the cut already ends in a space, or when the
            // cut was at the very start of the line.
            if (
                line[copied] === " " &&
                (result === "" || result.endsWith(" "))
            ) {
                copied++;
            }
            changed = true;
        }
        if (!changed) return line;
        const tail = line.slice(copied);
        // A reference that ended the line leaves the space in front of it
        // hanging, so trim it. If there is any text left after the cut,
        // then whatever spaces the line ends with were already the user's.
        return tail === "" ? result.replace(/[ \t]+$/, "") : result + tail;
    });
    if (out.every((line, i) => line === lines[i])) return markdown;

    // Deleting reference text can change how Obsidian reads a line far
    // away. Emptying the paragraph between a definition and an indented
    // block turns that block from indented CODE into a continuation line of
    // the definition, because Obsidian carries a definition on across any
    // number of blank lines. (Verified against metadataCache, 2026-08-10;
    // found by the idempotence property.) The next lint would then edit
    // text this one promised to leave alone.
    //
    // So a deletion that changes whether ANY other line counts as protected
    // is refused outright. The orphaned references stay, for the user to
    // sort out.
    const scanAfter = scanDocument(out);
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] !== scanAfter.isProtected[i]) return markdown;
    }
    // The same promise again, this time about the prose-label rule.
    // Emptying the line above a lazy label would turn that label into a
    // real definition (second review, 2026-09-09). That is another change
    // of meaning this deletion is not allowed to make.
    const maskedAfter = maskProtectedLines(out, scanAfter);
    const startsAfter = definitionStartLines(out, scanAfter, (i) => maskedAfter[i]);
    for (let i = 0; i < lines.length; i++) {
        if (starts[i] !== startsAfter[i]) return markdown;
    }
    return restoreEol(out.join("\n"), eol);
}

/**
 * This rule's catalogue entry. The option is the note's own prefix, whose
 * bare placeholder must not be deleted.
 */
export const removeOrphanedReferencesRule: FootnoteRule<{ orphanSafePrefix?: string }> =
    {
        id: "remove-orphaned-references",
        name: "Remove orphaned references",
        description:
            "Delete footnote references that have no definition anywhere in the note.",
        ignoreTypes: [
            IgnoreType.Code,
            IgnoreType.InlineCode,
            IgnoreType.Math,
            IgnoreType.Yaml,
            IgnoreType.HtmlComment,
        ],
        examples: [
            {
                description: "A reference with no definition is removed",
                before: "keep[^1] drop[^9] end\n\n[^1]: one",
                after: "keep[^1] drop end\n\n[^1]: one",
                options: {},
            },
            {
                description: "A definition in any casing keeps its references",
                before: "see[^Note]\n\n[^note]: n",
                after: "see[^Note]\n\n[^note]: n",
                options: {},
            },
        ],
        apply: (text, options) =>
            removeOrphanedFootnoteReferences(text, options.orphanSafePrefix ?? ""),
    };
