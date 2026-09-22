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

/** How carried definitions land in a destination note: the pasted body and the blocks to append, both with the collision renames made, and the counts for the toast. */
export interface CarriedPastePlan {
    body: string;
    /** the blocks to append, renamed, in carried order; a merged one is not among them */
    definitions: CarriedDefinition[];
    added: number;
    /** incoming definitions whose body an existing definition already holds, so the existing one serves */
    reused: number;
    /** incoming names the destination already used for a different body, given a new name */
    renamed: number;
}

/**
 * Decide how `carried` definitions and the pasted `body` fit into the
 * `destination` note (T6's merge rule applied on paste; Jason,
 * 2026-09-21). In carried order: a definition whose body, whitespace
 * collapsed, equals an existing definition's is merged into it whatever
 * its label, and the references to it are pointed at the existing name; a
 * name the destination does not use (as a definition or a reference) is
 * kept; a name the destination uses for a different body is renamed, a
 * number to the smallest free number, a name to name-2, name-3 and so on.
 * The renames are made in the body and inside the carried blocks (labels
 * and references alike), so a carried definition that cites another keeps
 * citing it. Protected text in the body is left as it is.
 */
export function planCarriedPaste(destination: string, body: string, carried: CarriedDefinition[]): CarriedPastePlan {
    const lines = normalizeEol(destination).text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);

    // what the destination holds: every name in use (definitions and
    // references, folded), and every definition body by its normalised
    // text, the last block of a name winning as it does in Obsidian
    const taken = new Set<string>();
    const bodies = new Map<string, string>();
    const blocks: DefinitionBlock[] = findDefinitionBlocks(lines, scan, masked, starts);
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] || !starts[i]) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (hit?.label.quoted) {
            blocks.push({ name: hit.name, start: i, end: hit.label.afterCloser ? i : quotedDefinitionEnd(lines, scan, starts, i) });
        }
    }
    blocks.sort((a, b) => a.start - b.start);
    for (const block of blocks) {
        taken.add(block.name.toLowerCase());
        bodies.set(normalisedBody(lines.slice(block.start, block.end + 1)), block.name);
    }
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] || !lines[i].includes("[^")) continue;
        for (const occurrence of referenceOccurrences(lines[i], masked[i], starts[i])) taken.add(occurrence.name.toLowerCase());
    }

    // the final name of every incoming name, folded
    const finalName = new Map<string, string>();
    const assigned = new Set<string>();
    const reusedNames = new Set<string>();
    let added = 0;
    let reused = 0;
    let renamed = 0;
    const occupied = (folded: string) => taken.has(folded) || assigned.has(folded);
    for (const definition of carried) {
        const folded = definition.name.toLowerCase();
        const existing = bodies.get(normalisedBody(definition.lines));
        if (existing !== undefined) {
            finalName.set(folded, existing);
            reusedNames.add(folded);
            reused++;
            continue;
        }
        if (!occupied(folded)) {
            finalName.set(folded, definition.name);
            assigned.add(folded);
            added++;
            continue;
        }
        let name: string;
        if (/^\d+$/.test(definition.name)) {
            let n = 1;
            while (occupied(String(n))) n++;
            name = String(n);
        } else {
            let k = 2;
            while (occupied(`${folded}-${k}`)) k++;
            name = `${definition.name}-${k}`;
        }
        finalName.set(folded, name);
        assigned.add(name.toLowerCase());
        added++;
        renamed++;
    }

    // the renames, made right to left on each line so that one keeps the
    // offsets of the ones before it; a line's own label is renamed too
    const rename = (text: string[]): string[] => {
        const textScan = scanDocument(text);
        const textMasked = maskProtectedLines(text, textScan);
        const textStarts = definitionStartLines(text, textScan, (i) => textMasked[i]);
        return text.map((line, i) => {
            if (textScan.isProtected[i] || !line.includes("[^")) return line;
            const edits: { start: number; end: number; name: string }[] = [];
            const label = textStarts[i] ? definitionLabelWithName(line, textMasked[i]) : null;
            const labelStart = label ? label.label.nameStart - 2 : -1;
            if (label) edits.push({ start: label.label.nameStart, end: label.label.nameEnd, name: label.name });
            for (const occurrence of referenceOccurrences(line, textMasked[i], textStarts[i])) {
                if (occurrence.start === labelStart) continue;
                edits.push({ start: occurrence.start + 2, end: occurrence.end - 1, name: occurrence.name });
            }
            return edits
                .filter((edit) => {
                    const target = finalName.get(edit.name.toLowerCase());
                    return target !== undefined && target !== edit.name;
                })
                .sort((a, b) => b.start - a.start)
                .reduce(
                    (kept, edit) => kept.slice(0, edit.start) + (finalName.get(edit.name.toLowerCase()) as string) + kept.slice(edit.end),
                    line,
                );
        });
    };
    const definitions = carried
        .filter((definition) => !reusedNames.has(definition.name.toLowerCase()))
        .map((definition) => ({
            name: finalName.get(definition.name.toLowerCase()) as string,
            lines: rename(definition.lines),
        }));
    return { body: rename(normalizeEol(body).text.split("\n")).join("\n"), definitions, added, reused, renamed };
}

/** A definition block's body with the label stripped and whitespace collapsed, the key two definitions are compared by. */
function normalisedBody(blockLines: string[]): string {
    const scan = scanDocument(blockLines);
    const masked = maskProtectedLines(blockLines, scan);
    const label = definitionLabelWithName(blockLines[0], masked[0]);
    const first = label ? blockLines[0].slice(label.label.labelEnd) : blockLines[0];
    return [first, ...blockLines.slice(1)].join("\n").replace(/\s+/g, " ").trim();
}
