import {
    definitionLabelWithName,
    inlineFootnoteSpans,
    referenceOccurrences,
} from "../parsing/footnote-grammar";
import { inItemDefinitionLabels } from "../parsing/list-item-definitions";
import {
    DefinitionBlock,
    definitionStartLines,
    findDefinitionBlocks,
    maskProtectedLines,
    normalizeEol,
    quotedDefinitionEnd,
    removeLineRanges,
    restoreEol,
    scanDocument,
    tableRowLinesOf,
} from "../parsing/markdown-scan";
import { linesReadDifferently } from "../linting/rules/remove-orphaned-definitions";
import { readsDifferently } from "../linting/rules/remove-orphaned-references";
import { sanitizeInlineFootnoteContent } from "./inline-footnotes";

// Converting a note's footnotes between the two styles (T6 of the 2026-09
// feature round; Jason's rulings 2026-09-19 to 2026-09-21).
//
// Why: Obsidian's embed renderer drops footnote definitions, so a
// transcluded section loses its normal footnotes and keeps its inline
// ones; some publishing targets (Hatena Blog) read only the normal form;
// and footnotes often start life inline and outgrow it. People did both
// conversions by hand, and permanently. These commands do a whole note
// at once, and the round trip restores the sharing: inline to normal
// merges identical bodies, so three copies come back as one definition
// with three references.
//
// Normal to inline is a pure transform (this file's first half). Inline
// to normal is built editor-side so it can reuse the definition-append
// decision tree (this file's second half).

/** What converting a note's normal footnotes to inline did, or would do. */
export interface ConversionToInline {
    markdown: string;
    /** definitions turned into inline footnotes */
    converted: number;
    /** references replaced (more than `converted` when a definition was used several times) */
    references: number;
    /** definitions used more than once, which became that many identical copies: the inline form has nowhere to put a shared body */
    duplicated: number;
    /** the definitions left alone, each with the reason the toast gives */
    skipped: { name: string; reason: string }[];
    /** set when the whole conversion was refused because it would change how Obsidian reads a line it was not asked to touch; `markdown` is then the input */
    refused?: string;
}

/**
 * `markdown` with every single-line footnote definition turned into an
 * "^[body]" inline footnote at each of its references, and its block cut
 * out. The rest are skipped and named (see ConversionToInline.skipped):
 * a definition of more than one line has no inline form and is never
 * flattened (Jason's ruling 2026-08-20 on the analogous selection case);
 * an empty body would make an empty inline footnote; a body holding a
 * footnote, or a reference sitting inside another definition's body or an
 * inline footnote, would nest footnotes (ADR 1); a quoted, in-item or
 * closer-line definition is one the plugin does not cut; an orphan has
 * nowhere to go; a name defined twice is ambiguous. Protected text is
 * untouched, and a bracket or pipe that would break the inline footnote or
 * a table row is escaped.
 */
export function convertNormalFootnotesToInline(markdown: string): ConversionToInline {
    const { text, eol } = normalizeEol(markdown);
    const lines = text.split("\n");
    const scan = scanDocument(lines);
    const masked = maskProtectedLines(lines, scan);
    const starts = definitionStartLines(lines, scan, (i) => masked[i]);
    const unchanged = (skipped: ConversionToInline["skipped"], refused?: string): ConversionToInline => ({
        markdown,
        converted: 0,
        references: 0,
        duplicated: 0,
        skipped,
        ...(refused ? { refused } : {}),
    });

    // Every definition the note has, by lower-cased name: the column-0
    // blocks (the ones this transform can cut), and the quoted, in-item
    // and closer-line ones, which it recognises so their names are skipped
    // with a reason rather than passed over in silence (ADR 2).
    type Found = { name: string; line: number; block?: DefinitionBlock; reason?: string };
    const found = new Map<string, Found[]>();
    const add = (entry: Found) => {
        const folded = entry.name.toLowerCase();
        found.set(folded, [...(found.get(folded) ?? []), entry]);
    };
    for (const block of findDefinitionBlocks(lines, scan, masked, starts)) {
        add({ name: block.name, line: block.start, block });
    }
    // lines that belong to SOME definition's body, quoted ones included:
    // a reference on one of them is inside another footnote
    const insideDefinition = new Array<boolean>(lines.length).fill(false);
    for (const block of findDefinitionBlocks(lines, scan, masked, starts)) {
        for (let i = block.start; i <= block.end; i++) insideDefinition[i] = true;
    }
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] || !starts[i]) continue;
        const hit = definitionLabelWithName(lines[i], masked[i]);
        if (!hit || !hit.label.quoted) continue;
        add({
            name: hit.name,
            line: i,
            reason: hit.label.afterCloser ? "shares its line with a %% closer" : "inside a blockquote",
        });
        const end = hit.label.afterCloser ? i : quotedDefinitionEnd(lines, scan, starts, i);
        for (let j = i; j <= end; j++) insideDefinition[j] = true;
    }
    for (const hit of inItemDefinitionLabels(lines, scan, masked, starts)) {
        add({ name: hit.name, line: hit.line, reason: "inside a list item" });
        insideDefinition[hit.line] = true;
    }
    if (found.size === 0) return unchanged([]);

    // every live reference, by lower-cased name, with whether it sits
    // inside a definition's body or an inline footnote (where a converted
    // reference would nest). A quoted label's own "[^x]" is not a
    // reference; a lazy label's is, as it renders.
    type Ref = { line: number; start: number; end: number; nested: boolean };
    const refs = new Map<string, Ref[]>();
    const tableRows = tableRowLinesOf(lines);
    for (let i = 0; i < lines.length; i++) {
        if (scan.isProtected[i] || !lines[i].includes("[^")) continue;
        const label = starts[i] ? definitionLabelWithName(lines[i], masked[i]) : null;
        const labelStart = label ? label.label.nameStart - 2 : -1;
        const spans = inlineFootnoteSpans(masked[i]);
        for (const occurrence of referenceOccurrences(lines[i], masked[i], starts[i])) {
            if (occurrence.start === labelStart) continue;
            const folded = occurrence.name.toLowerCase();
            const inSpan = spans.some((span) => occurrence.start > span.open && occurrence.end <= span.close + 1);
            refs.set(folded, [
                ...(refs.get(folded) ?? []),
                { line: i, start: occurrence.start, end: occurrence.end, nested: insideDefinition[i] || inSpan },
            ]);
        }
    }

    // decide each name, in the order its definitions appear
    const skipped: { line: number; name: string; reason: string }[] = [];
    const eligible: { block: DefinitionBlock; body: string; refs: Ref[] }[] = [];
    for (const [folded, entries] of found) {
        const first = entries[0];
        if (entries.length > 1) {
            skipped.push({ line: first.line, name: first.name, reason: "defined more than once" });
            continue;
        }
        if (first.reason !== undefined || first.block === undefined) {
            skipped.push({ line: first.line, name: first.name, reason: first.reason ?? "inside a list item" });
            continue;
        }
        const block = first.block;
        const skip = (reason: string) => skipped.push({ line: block.start, name: block.name, reason });
        if (block.end !== block.start) {
            skip("more than one line");
            continue;
        }
        const hit = definitionLabelWithName(lines[block.start], masked[block.start]);
        // Stryker disable next-line ConditionalExpression: a block always starts on a label line, so this branch is unreachable and only keeps the types honest
        if (!hit) continue;
        const bodyStart = hit.label.labelEnd;
        const body = lines[block.start].slice(bodyStart);
        if (body.trim() === "") {
            skip("empty");
            continue;
        }
        const maskedBody = masked[block.start].slice(bodyStart);
        if (referenceOccurrences(body, maskedBody, false).length > 0 || inlineFootnoteSpans(maskedBody).length > 0) {
            skip("its body holds a footnote");
            continue;
        }
        const its = refs.get(folded) ?? [];
        if (its.length === 0) {
            skip("nothing references it");
            continue;
        }
        if (its.some((ref) => ref.nested)) {
            skip("referenced from inside another footnote");
            continue;
        }
        eligible.push({ block, body: sanitizeInlineFootnoteContent(body), refs: its });
    }
    skipped.sort((a, b) => a.line - b.line);
    const named = skipped.map(({ name, reason }) => ({ name, reason }));
    if (eligible.length === 0) return unchanged(named);

    // the replacements, rightmost first on each line so that one keeps the
    // offsets of the ones before it
    const replacements = new Map<number, { start: number; end: number; text: string }[]>();
    for (const { body, refs: its } of eligible) {
        for (const ref of its) {
            // a pipe inside a table row's cell ends the cell, so it is
            // escaped there, the way Obsidian itself writes one
            const inline = `^[${tableRows[ref.line] ? body.replace(/\\[\s\S]|\|/g, (m) => (m === "|" ? "\\|" : m)) : body}]`;
            replacements.set(ref.line, [...(replacements.get(ref.line) ?? []), { start: ref.start, end: ref.end, text: inline }]);
        }
    }
    const replaced = lines.map((line, i) => {
        const edits = replacements.get(i);
        if (!edits) return line;
        return edits
            .sort((a, b) => b.start - a.start)
            .reduce((kept, edit) => kept.slice(0, edit.start) + edit.text + kept.slice(edit.end), line);
    });
    // The promise the orphan rules and the delete command make: a rewrite
    // that changes how Obsidian reads a line it was not asked to touch is
    // refused whole rather than half done.
    const byHand = "Converting would change how Obsidian reads the text around a footnote. Convert it by hand.";
    if (readsDifferently(lines, scan, starts, replaced)) return unchanged(named, byHand);
    const dead = eligible.map(({ block }) => block).sort((a, b) => a.start - b.start);
    const replacedScan = scanDocument(replaced);
    const out = removeLineRanges(replaced, dead);
    if (linesReadDifferently(replaced, replacedScan, dead, out)) return unchanged(named, byHand);

    return {
        markdown: restoreEol(out.join("\n"), eol),
        converted: eligible.length,
        references: eligible.reduce((n, { refs: its }) => n + its.length, 0),
        duplicated: eligible.filter(({ refs: its }) => its.length > 1).length,
        skipped: named,
    };
}
