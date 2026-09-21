import { definitionLabelWithName } from "./footnote-grammar";
import type { DocumentScan } from "./markdown-scan";

// Footnote definitions written INSIDE a list item.
//
// Reading view renders "- [^la]: text" (the label right after the list
// marker) and a label indented to the item's margin under "- item", after
// a blank line, as real footnote definitions (Jason's rulings note, probed
// 2026-09-16; the margin spellings and the lazy one probed 2026-09-21 on
// the Opus hunt's claims). The rest of the plugin reads labels from the
// left margin only: such a definition never forms a block, is never moved,
// and is never renamed. Jason's ruling 1 (2026-09-20, option b) has it
// recognized in just the places where ignoring it misfired: the
// orphan-reference alert and its deletion, the hotkey's decision between
// navigating and creating, the two renamers, which leave the name alone
// (reindex) or refuse (the rename command), and the punctuation rule, which
// leaves its label alone. The label pass and the lazy-label reader skip
// these lines, so a margin-indented one is neither a block nor "lazy".
// Modelling these definitions everywhere (option a) waits until more such
// cases turn up.

/** A footnote label found inside a list item: the line it sits on, its name as written, and where the label (through its colon) ends on that line. */
export interface InItemLabel {
    line: number;
    name: string;
    labelEnd: number;
}

// a list marker with content after it: up to three spaces of indent, the
// marker, and the gap (CommonMark counts a gap of five or more as one)
const ListMarker = /^( {0,3})([-+*]|\d{1,9}[.)])( +)(?=\S)/;
// a list marker with nothing after it: an empty item
const EmptyListMarker = /^( {0,3})([-+*]|\d{1,9}[.)])\s*$/;

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
 * on a marker line ("- [^la]: text"), or on a line indented at least to
 * the innermost open item's content column that follows a blank line, an
 * empty item line, or another in-item label. A label directly under the
 * item's own prose is that paragraph's lazy text, exactly as a column-0
 * label under a prose line is (Obsidian renders it as plain characters;
 * probed 2026-09-21), so it is not included; nor is a protected line. A
 * non-blank line indented less than an item's content column closes that
 * item, so a label under a column-0 definition (that definition's own
 * continuation) is never inside an item.
 *
 * `masked` is the document's masked twin, as an array or a line accessor,
 * so a label inside a code span or a comment never counts. The fourth
 * argument is accepted for the callers written when the reader still
 * needed the label pass's answer; it is no longer read.
 */
export function inItemDefinitionLabels(
    lines: string[],
    scan: Pick<DocumentScan, "isProtected">,
    masked: string[] | ((i: number) => string),
    _starts?: boolean[],
): InItemLabel[] {
    const maskedAt = typeof masked === "function" ? masked : (i: number) => masked[i];
    const out: InItemLabel[] = [];
    // the content columns of the list items open at the current line,
    // innermost last
    const open: number[] = [];
    // whether the line before was a blank line, an empty item line, or an
    // in-item label, so that a label here starts a block of its own rather
    // than continuing a paragraph
    let boundaryAbove = true;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].endsWith("\r") ? lines[i].slice(0, -1) : lines[i];
        if (line.trim() === "") {
            boundaryAbove = true;
            continue;
        }
        if (scan.isProtected[i]) {
            boundaryAbove = false;
            continue;
        }
        const width = indentWidth(line);
        while (open.length > 0 && width < open[open.length - 1]) open.pop();
        const marker = line.match(ListMarker);
        if (marker) {
            const gap = marker[3].length > 4 ? 1 : marker[3].length;
            const column = marker[1].length + marker[2].length + gap;
            // a label right after the marker: the label reader wants the
            // label at the start of what it is given, so the marker is
            // cut off the raw line and its masked twin alike
            const hit = definitionLabelWithName(line.slice(marker[0].length), maskedAt(i).slice(marker[0].length));
            if (hit) out.push({ line: i, name: hit.name, labelEnd: marker[0].length + hit.label.labelEnd });
            open.push(column);
            boundaryAbove = hit !== null;
            continue;
        }
        const empty = line.match(EmptyListMarker);
        if (empty) {
            open.push(empty[1].length + empty[2].length + 1);
            boundaryAbove = true;
            continue;
        }
        if (open.length === 0 || width < open[open.length - 1] || !boundaryAbove) {
            boundaryAbove = false;
            continue;
        }
        const lead = line.length - line.trimStart().length;
        const hit = definitionLabelWithName(line.slice(lead), maskedAt(i).slice(lead));
        if (hit) {
            out.push({ line: i, name: hit.name, labelEnd: lead + hit.label.labelEnd });
            boundaryAbove = true;
        } else {
            boundaryAbove = false;
        }
    }
    return out;
}

/** The line numbers of every definition inside a list item, for the readers that must step over them. */
export function inItemDefinitionLineSet(
    lines: string[],
    scan: Pick<DocumentScan, "isProtected">,
    masked: string[] | ((i: number) => string),
): Set<number> {
    return new Set(inItemDefinitionLabels(lines, scan, masked).map((hit) => hit.line));
}

/** The names of every definition inside a list item, lower-cased for comparing. */
export function inItemDefinitionNamesFolded(
    lines: string[],
    scan: Pick<DocumentScan, "isProtected">,
    masked: string[] | ((i: number) => string),
    _starts?: boolean[],
): Set<string> {
    return new Set(inItemDefinitionLabels(lines, scan, masked).map((hit) => hit.name.toLowerCase()));
}
