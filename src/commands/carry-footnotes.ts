import { EditorPosition } from "obsidian";

import { definitionLabelWithName, referenceOccurrences } from "../parsing/footnote-grammar";
import {
    DefinitionBlock,
    definitionStartLines,
    findDefinitionBlocks,
    maskProtectedLines,
    normalizeEol,
    quotedDefinitionEnd,
    scanDocument,
} from "../parsing/markdown-scan";

// Carrying footnote definitions along on copy, cut and paste (issue #59;
// Jason's rulings 2026-09-21 and 2026-09-22).
//
// Copy a paragraph holding "[^3]" into another note and the reference
// travels while the "[^3]: ..." definition stays behind. People have asked
// for this for years, and the one plugin that does it (Copy with
// Footnotes) reads its definitions from Obsidian's metadata cache, which
// lags the editor by a couple of seconds, and only through commands of its
// own. This plugin reads the live note, on the keys people already press.
//
// This file holds the pure pieces: which definitions a selection needs,
// how carried definitions merge into a destination note, and how a
// clipboard text that carries definition lines is split back apart. The
// editor-side hooks live in carry-footnotes-hooks.ts.

/** One definition block to carry: its name as written, and its lines exactly as they stand in the source note, continuation lines included. */
export interface CarriedDefinition {
    name: string;
    lines: string[];
}

export interface CarriedDefinitions {
    /** the blocks the selection needs, in the order their references are first met */
    carried: CarriedDefinition[];
    /** the names referenced inside the selection (or inside a carried body) that have no definition to carry: an orphan, a lazy label, or a definition inside a list item, which the plugin does not model; spelled as first seen, each once */
    missing: string[];
}

/**
 * The definition blocks the text between `from` and `to` needs when it
 * leaves this note: the definition of every live reference inside the
 * selection whose block lies outside it, plus, all the way down, the
 * definitions of the references inside those blocks' own bodies. A block
 * whose first line the selection contains travels with the text and is
 * not carried again. A reference the selection cuts through (only part of
 * its brackets selected) is not a reference in the copy, so it needs
 * nothing. Of duplicate definitions the LAST is carried, the one Obsidian
 * renders. Names match without regard to case.
 */
export function carriedDefinitions(markdown: string, from: EditorPosition, to: EditorPosition): CarriedDefinitions {
    const lines = normalizeEol(markdown).text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);

    // every definition block the note has, by lower-cased name, in
    // document order: column-0 blocks, and quoted ones with the quoted
    // continuation Obsidian gives them. An in-item definition is
    // recognised but has no modelled extent, so it is a name with nothing
    // to carry.
    const blocksOf = new Map<string, DefinitionBlock[]>();
    const remember = (block: DefinitionBlock) => {
        const folded = block.name.toLowerCase();
        blocksOf.set(folded, [...(blocksOf.get(folded) ?? []), block]);
    };
    for (const block of findDefinitionBlocks(lines, scan, masked, starts)) remember(block);
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] || !starts[i]) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (!hit?.label.quoted) continue;
        remember({
            name: hit.name,
            start: i,
            end: hit.label.afterCloser ? i : quotedDefinitionEnd(lines, scan, starts, i),
        });
    }

    // the references the selection holds whole, in order, skipping the
    // reference-shaped head of a quoted label (a label defines, it does
    // not point)
    const inside = (line: number, start: number, end: number): boolean => {
        if (line < from.line || line > to.line) return false;
        if (line === from.line && start < from.ch) return false;
        if (line === to.line && end > to.ch) return false;
        return true;
    };
    const referencesOn = (line: number): string[] => {
        if (scan.isProtected[line] || !lines[line].includes("[^")) return [];
        const label = starts[line] ? definitionLabelWithName(lines[line], masked[line]) : null;
        const labelStart = label ? label.label.nameStart - 2 : -1;
        return referenceOccurrences(lines[line], masked[line], starts[line])
            .filter((occurrence) => occurrence.start !== labelStart)
            .map((occurrence) => occurrence.name);
    };
    const queue: string[] = [];
    for (let line = from.line; line <= to.line && line < lines.length; line++) {
        if (scan.isProtected[line] || !lines[line].includes("[^")) continue;
        const label = starts[line] ? definitionLabelWithName(lines[line], masked[line]) : null;
        const labelStart = label ? label.label.nameStart - 2 : -1;
        for (const occurrence of referenceOccurrences(lines[line], masked[line], starts[line])) {
            if (occurrence.start === labelStart) continue;
            if (inside(line, occurrence.start, occurrence.end)) queue.push(occurrence.name);
        }
    }

    const carried: CarriedDefinition[] = [];
    const missing: string[] = [];
    const seen = new Set<string>();
    while (queue.length > 0) {
        const name = queue.shift() as string;
        const folded = name.toLowerCase();
        if (seen.has(folded)) continue;
        seen.add(folded);
        const blocks = blocksOf.get(folded);
        if (!blocks) {
            missing.push(name);
            continue;
        }
        // the last definition is the one Obsidian renders
        const block = blocks[blocks.length - 1];
        // a block the selection contains travels with the text
        if (block.start >= from.line && block.start <= to.line) continue;
        carried.push({ name: block.name, lines: lines.slice(block.start, block.end + 1) });
        // and the references inside its body need their own definitions,
        // met right after it, as a reader meets them (preorder), before
        // the selection's later references
        const inner: string[] = [];
        for (let line = block.start; line <= block.end; line++) inner.push(...referencesOn(line));
        queue.unshift(...inner);
    }
    return { carried, missing };
}
