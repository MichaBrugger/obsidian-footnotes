import { definitionLabel, referenceOccurrences, referenceText } from "../parsing/footnote-grammar";
import { definitionLabelWithName } from "../parsing/markdown-scan";

/**
 * `line` with every live reference, and its definition label when the
 * line is one, renamed through `resolve` (null = keep this name). The
 * one walk the apply-prefix and reindex rules used to carry separately
 * (duplicated-logic audit, 2026-09-05): references are spliced by their
 * masked-aware occurrences, so copies inside code spans stay; the label
 * sits at column 0, where referenceOccurrences never looks, so it is
 * re-matched and rewritten on its own. `masked` is the line's
 * document-aware masked twin.
 */
export function rewriteFootnoteNames(
    line: string,
    masked: string,
    resolve: (name: string) => string | null,
): string {
    let result = "";
    let copied = 0;
    for (const { name, start, end } of referenceOccurrences(line, masked)) {
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
    const hit = definitionLabelWithName(line, masked);
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
