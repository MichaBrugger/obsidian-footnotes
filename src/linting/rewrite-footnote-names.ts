import { definitionLabel, referenceOccurrences, referenceText } from "../parsing/footnote-grammar";
import { definitionLabelWithName } from "../parsing/markdown-scan";

/**
 * Return `line` with every live reference renamed, and, when the line is a
 * definition, its label renamed too. `resolve` picks the new name for each
 * old one; returning null means leave that name alone.
 *
 * This is the single renaming walk that the apply-prefix and reindex rules
 * each used to carry their own copy of (duplicated-logic audit,
 * 2026-09-05).
 *
 * How it works. References are found against the masked twin (the copy of
 * the line with protected text blanked out) and cut into the line by their
 * positions, so a reference-shaped string inside a code span is left alone.
 * A real label is not one of those occurrences, because referenceOccurrences
 * leaves it out when `labelIsDefinition` is true, so the label is matched
 * and rewritten separately below. A LAZY label is different: its "[^x]" is
 * genuinely a reference, so it is renamed in the first pass with the rest.
 *
 * `masked` is this line's masked twin, worked out with the whole note in
 * view.
 */
export function rewriteFootnoteNames(
    line: string,
    masked: string,
    resolve: (name: string) => string | null,
    // false when the line only looks like it starts with a label but is
    // really lazy text: its "[^x]" is then renamed as the reference it
    // actually is, and the label pass below is skipped
    labelIsDefinition = true,
): string {
    let result = "";
    let copied = 0;
    for (const { name, start, end } of referenceOccurrences(line, masked, labelIsDefinition)) {
        // a name holding whitespace is prose to Obsidian, not a footnote,
        // so it is never renamed into one (Claude sweep 2026-09-13)
        if (/\s/.test(name)) continue;
        const newName = resolve(name);
        if (newName === null) continue;
        result += line.slice(copied, start) + referenceText(newName);
        copied = end;
    }
    result += line.slice(copied);
    // The line's own label, at the left margin or inside a blockquote, was
    // not one of the occurrences above, so it is renamed here. The only
    // thing that can sit in front of a label is its blockquote marker or
    // its indent, and the reference pass never touches either, so the
    // label's positions in the original line still point at the right
    // characters in `result`.
    const hit = labelIsDefinition ? definitionLabelWithName(line, masked) : null;
    if (hit) {
        const newName = resolve(hit.name);
        if (newName !== null) {
            result =
                result.slice(0, hit.label.nameStart - 2) +
                definitionLabel(newName) +
                result.slice(hit.label.labelEnd);
        }
    }
    return result;
}
