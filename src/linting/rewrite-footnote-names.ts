import { referenceOccurrences } from "../parsing/footnote-grammar";
import { DefinitionStart } from "../parsing/markdown-scan";

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
        result += line.slice(copied, start) + `[^${newName}]`;
        copied = end;
    }
    result += line.slice(copied);
    const definition = line.match(DefinitionStart);
    if (definition) {
        const newName = resolve(definition[1]);
        if (newName !== null) {
            result = `[^${newName}]:` + result.slice(definition[0].length);
        }
    }
    return result;
}
