import { definitionLabel, referenceOccurrences, referenceText } from "../parsing/footnote-grammar";
import { definitionLabelWithName } from "../parsing/markdown-scan";

/**
 * `line` with every live reference, and its definition label when the
 * line is one, renamed through `resolve` (null = keep this name). The
 * one walk the apply-prefix and reindex rules used to carry separately
 * (duplicated-logic audit, 2026-09-05): references are spliced by their
 * masked-aware occurrences, so copies inside code spans stay; a real
 * label is not among them (referenceOccurrences excludes it when
 * `labelIsDefinition`), so it is re-matched and rewritten on its own;
 * a LAZY label's "[^x]" is a reference and renames in the first pass.
 * `masked` is the line's document-aware masked twin.
 */
export function rewriteFootnoteNames(
    line: string,
    masked: string,
    resolve: (name: string) => string | null,
    // false when the line's label-shaped start is lazy text: its "[^x]" is
    // then renamed as the reference it is, and the label pass stays out
    labelIsDefinition = true,
): string {
    let result = "";
    let copied = 0;
    for (const { name, start, end } of referenceOccurrences(line, masked, labelIsDefinition)) {
        const newName = resolve(name);
        if (newName === null) continue;
        result += line.slice(copied, start) + referenceText(newName);
        copied = end;
    }
    result += line.slice(copied);
    // the line's own label (column 0 or blockquoted) is not among the
    // occurrences above - it renames here. Nothing precedes a label but
    // its marker/indent, which the reference pass never touches, so the
    // label's raw offsets still hold in `result`
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
