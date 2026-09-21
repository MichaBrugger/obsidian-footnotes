import { definitionLabelWithName } from "./footnote-grammar";
import type { DocumentScan } from "./markdown-scan";

// Footnote definitions written INSIDE a list item.
//
// Reading view renders "- [^la]: text" (the label right after the list
// marker) and "    [^lb]: text" under "- item" (the label indented to the
// item's margin) as real footnote definitions (Jason's rulings note,
// probed 2026-09-16). The rest of the plugin reads labels from the left
// margin only: such a definition never forms a block, is never moved, and
// is never renamed. Jason's ruling 1 (2026-09-20, option b) has it
// recognized in just the places where ignoring it misfired: the
// orphan-reference alert and its deletion, the hotkey's decision between
// navigating and creating, and the two renamers, which leave the name
// alone (reindex) or refuse (the rename command). Modelling these
// definitions everywhere (option a) waits until more such cases turn up.

/** A footnote label found inside a list item: the line it sits on and its name as written. */
export interface InItemLabel {
    line: number;
    name: string;
}

// a list marker with its content after it: up to three spaces of indent,
// the marker, and the gap (CommonMark counts a gap of five or more as one)
const ListMarker = /^( {0,3})([-+*]|\d{1,9}[.)])( +)(?=\S)/;

/** How wide the line's leading whitespace is, a tab running to the next four-column stop. */
function indentWidth(line: string): number {
    let width = 0;
    for (const ch of line) {
        if (ch === " ") width++;
        else if (ch === "\t") width += 4 - (width % 4);
        else break;
    }
    return width;
}

/**
 * Every footnote label that sits inside a list item, in document order:
 * on a marker line ("- [^la]: text"), or on a line indented four columns
 * or more into an open item. A label the margin readers already count
 * (`starts`), a protected line, and a label under a column-0 definition
 * (the definition's own continuation) are not included.
 *
 * `masked` is the document's masked twin, so a label inside a code span
 * or a comment never counts; `starts` is definitionStartLines' answer.
 */
export function inItemDefinitionLabels(
    lines: string[],
    scan: Pick<DocumentScan, "isProtected">,
    masked: string[],
    starts: boolean[],
): InItemLabel[] {
    const out: InItemLabel[] = [];
    // the content columns of the list items open at the current line,
    // innermost last; a non-blank line indented less than an item's
    // content column closes that item
    const open: number[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].endsWith("\r") ? lines[i].slice(0, -1) : lines[i];
        if (line.trim() === "") continue;
        if (scan.isProtected[i]) continue;
        const width = indentWidth(line);
        while (open.length > 0 && width < open[open.length - 1]) open.pop();
        const marker = line.match(ListMarker);
        if (marker) {
            const gap = marker[3].length > 4 ? 1 : marker[3].length;
            const column = marker[1].length + marker[2].length + gap;
            // a label right after the marker: the label reader wants the
            // label at the start of what it is given, so the marker is
            // cut off the raw line and its masked twin alike
            const hit = definitionLabelWithName(line.slice(marker[0].length), masked[i].slice(marker[0].length));
            if (hit && !starts[i]) out.push({ line: i, name: hit.name });
            open.push(column);
            continue;
        }
        if (open.length === 0 || starts[i] || width < 4) continue;
        const lead = line.length - line.trimStart().length;
        const hit = definitionLabelWithName(line.slice(lead), masked[i].slice(lead));
        if (hit) out.push({ line: i, name: hit.name });
    }
    return out;
}

/** The names of every definition inside a list item, lower-cased for comparing. */
export function inItemDefinitionNamesFolded(
    lines: string[],
    scan: Pick<DocumentScan, "isProtected">,
    masked: string[],
    starts: boolean[],
): Set<string> {
    return new Set(inItemDefinitionLabels(lines, scan, masked, starts).map((hit) => hit.name.toLowerCase()));
}
