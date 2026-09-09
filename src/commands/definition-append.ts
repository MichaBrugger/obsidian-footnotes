import { Editor, EditorChange, EditorPosition } from "obsidian";

import type FootnotePlugin from "../main";
import { comparePositions } from "../editor/cursor-motion";
import { DocContext, docContext } from "../editor/doc-context";
import { definitionLabel } from "../parsing/footnote-grammar";
import { findLineRunEnd, scanDocument } from "../parsing/markdown-scan";

// Where a new footnote definition lands: the section-heading setting and
// the append edit both creation paths share. Split out of the all-in-one
// commands file 2026-08-11.

function addFootnoteSectionHeader(plugin: FootnotePlugin): string {
    //check if 'Enable Footnote Section Heading' is true
    //if so, return the "Footnote Section Heading"
    // else, return ""

    // a cleared-out heading value counts as no heading - the lint path
    // already treats "" that way, and "\n\n" + "" would otherwise strand
    // stray blank lines above the first footnote
    if (
        plugin.settings.enableFootnoteSectionHeading &&
        plugin.settings.footnoteSectionHeading
    ) {
        // the setting holds literal markdown (legacy plain-text values are
        // migrated on load); a blank line ALWAYS separates the heading from
        // the content above it - markdown block convention (requested
        // 2026-07-20), and it keeps a heading starting with a divider from
        // turning the line above into a setext heading
        return `\n\n${plugin.settings.footnoteSectionHeading}`;
    }
    return "";
}

// Build (don't apply) the edit that appends `[^id]: ` to the note's
// footnote definitions: right after the last existing definition block
// when there is one (issue #55 - the definitions may live under a
// mid-document heading with more content below), otherwise after the last
// non-blank line - trimming trailing blank lines if enabled, and adding a
// blank separator plus the optional section heading before the first
// footnote. Returned as data so the caller can bundle it with the reference
// insertion into a single transaction (see moveCursorAndSetJumpPoint).
export function buildDefinitionAppend(
    doc: Editor,
    footnoteId: string,
    isFirstFootnote: boolean,
    plugin: FootnotePlugin,
    ctx: DocContext = docContext(doc),
    // the span a selection conversion is about to REPLACE in the same
    // transaction: the definition must not land inside it (the two changes
    // would overlap), and a section heading the selection swallows is no
    // slot to append under (property find 2026-09-09: a drag across the
    // "# Footnotes" heading with the setting on wrote the definition into
    // the middle of the selection and glued the paragraph's tail to it).
    // Honored where a slot can fall inside the span: the heading slot
    // (skipped when the heading is swallowed) and the walk up from an
    // unclosed tail. The other two branches cannot land inside it - the
    // caller refuses a selection that overlaps a definition block, and the
    // EOF append sits at or after the span's end.
    avoid?: { from: EditorPosition; to: EditorPosition },
): { change: EditorChange; cursor: EditorPosition; prepend?: EditorChange } {
    // every read goes through `ctx` (never `doc`): a cell branch dispatches
    // a cell edit between building the context and calling this, and two
    // sources for one document is how those drift (second review 2026-09-09)
    const lines = ctx.lines;
    const isProtected = ctx.scan.isProtected;
    const blocks = ctx.blocks();
    // an insertion at the END of `line` would sit strictly inside `avoid`
    const endInsideAvoid = (line: number): boolean => {
        if (!avoid) return false;
        const at = { line, ch: lines[line].length };
        return comparePositions(avoid.from, at) < 0 && comparePositions(at, avoid.to) < 0;
    };
    // a non-blank line directly below the new definition would be pulled INTO
    // it - Obsidian lazily continues a definition into the next line - so
    // insertions with content below them add a trailing blank separator
    // (A4 bug, 2026-07-20). The cursor still lands on the definition line.
    const needsSeparator = (insertLine: number) =>
        insertLine + 1 < lines.length && lines[insertLine + 1].trim() !== "";
    if (blocks.length > 0) {
        const lastLine = blocks[blocks.length - 1].end;
        let text = `\n[^${footnoteId}]: `;
        const cursor = { line: lastLine + 1, ch: text.length - 1 };
        if (needsSeparator(lastLine)) text += "\n";
        return {
            change: {
                from: { line: lastLine, ch: lines[lastLine].length },
                text,
            },
            cursor,
        };
    }

    // no definitions yet - but an existing section heading in the note
    // claims the first footnote (QOL follow-up to issue #55): slot the
    // definition under it instead of appending a second heading at the end.
    // The setting is markdown that can span multiple lines, so match runs.
    if (
        plugin.settings.enableFootnoteSectionHeading &&
        plugin.settings.footnoteSectionHeading
    ) {
        // findLineRunEnd is the ONE anchor matcher shared with the
        // move-to-bottom rule - the fixed-point guarantee needs both to
        // agree on what counts as the existing heading
        const headingLines = plugin.settings.footnoteSectionHeading.split("\n");
        const anchorEnd = findLineRunEnd(lines, isProtected, headingLines);
        // a heading the selection overlaps is being converted away with it
        // (a drag ending at ch 0 of the heading line leaves it intact)
        const headingSwallowed =
            anchorEnd !== -1 &&
            avoid !== undefined &&
            anchorEnd >= avoid.from.line &&
            (anchorEnd - headingLines.length + 1 < avoid.to.line ||
                (anchorEnd - headingLines.length + 1 === avoid.to.line && avoid.to.ch > 0));
        if (anchorEnd !== -1 && !headingSwallowed) {
            let fromLine = anchorEnd;
            let slotText = `\n\n[^${footnoteId}]: `;
            // reuse a blank line already separating the heading from what
            // follows, instead of doubling it
            if (fromLine + 1 < lines.length && lines[fromLine + 1] === "") {
                fromLine += 1;
                slotText = `\n[^${footnoteId}]: `;
            }
            const slotLinesAdded = slotText.split("\n").length - 1;
            const cursor = {
                line: fromLine + slotLinesAdded,
                ch: slotText.length - slotText.lastIndexOf("\n") - 1,
            };
            if (needsSeparator(fromLine)) slotText += "\n";
            return {
                change: {
                    from: { line: fromLine, ch: lines[fromLine].length },
                    text: slotText,
                },
                cursor,
            };
        }
    }

    let fromLine = lines.length - 1;
    let to: EditorPosition | undefined;
    if (ctx.scan.endsProtected) {
        // the note ends inside an UNCLOSED fence/comment/math (2026-08-11
        // review bug #10): a definition appended at EOF would be born as
        // inert code - and the next lint would then delete its live
        // reference as an orphan. Land it above the unclosed region: walk
        // up to the last prefix a definition can live after, then past
        // blank lines. Trailing-blank trimming must not fire here - its
        // `to` spans to EOF and would delete the region itself.
        while (
            fromLine >= 0 &&
            (ctx.scan.endsProtectedAt[fromLine] || endInsideAvoid(fromLine))
        ) {
            fromLine--;
        }
        while (fromLine >= 0 && (lines[fromLine].trim() === "" || endInsideAvoid(fromLine))) fromLine--;
        if (fromLine < 0) {
            // the unclosed region starts at line 0 - plant the definition
            // on top, blank-separated from whatever follows
            const topText =
                `${definitionLabel(footnoteId)} \n` + (lines[0].trim() === "" ? "" : "\n");
            return {
                change: { from: { line: 0, ch: 0 }, text: topText },
                cursor: { line: 0, ch: definitionLabel(footnoteId).length + 1 },
            };
        }
    } else if (plugin.settings.enableRemoveBlankLastLines) {
        while (fromLine > 0 && lines[fromLine].length === 0) {
            fromLine--;
        }
        to = { line: lines.length - 1, ch: lines[lines.length - 1].length };
    }
    const from = { line: fromLine, ch: lines[fromLine].length };

    let text = `\n[^${footnoteId}]: `;
    if (isFirstFootnote) {
        let heading = addFootnoteSectionHeader(plugin);
        // the heading carries its own blank line above; a blank insertion
        // line (trimming off, note ends empty) already supplies it
        if (heading && lines[fromLine].trim() === "") {
            heading = heading.slice(1);
        }
        text = heading + "\n" + text;
    } else if (lines[fromLine].trim() !== "") {
        // not the first footnote, yet no column-0 block to append under
        // (the note's only definitions are blockquoted): the label would
        // land directly under a prose line, which Obsidian reads as lazy
        // paragraph text, not a definition (definitionStartLines, ground
        // truth 2026-09-09) - give it the blank separator the first
        // footnote gets from its heading slot
        text = "\n" + text;
    }

    // cursor lands at the end of the inserted definition line
    const linesAdded = text.split("\n").length - 1;
    const cursor = {
        line: fromLine + linesAdded,
        ch: text.length - text.lastIndexOf("\n") - 1,
    };

    // with the insertion sitting mid-document (above an unclosed region),
    // a non-blank line directly below it would be pulled INTO the new
    // definition - same A4 hazard as the other insertion points
    if (ctx.scan.endsProtected && needsSeparator(fromLine)) text += "\n";

    // The first footnote's section heading can carry a column-0 "---"
    // divider; if the note's first line is a bare unclosed "---" (a
    // thematic break), inserting that divider makes Obsidian re-read the
    // whole head as YAML frontmatter, swallowing the prose in it (same
    // hazard as preserveLeadingThematicBreak in
    // move-footnotes-to-the-bottom - verified against metadataCache,
    // 2026-08-10). A blank line prepended in the same transaction pins
    // line 0 as content; it renders identically.
    let prepend: EditorChange | undefined;
    if (isFirstFootnote && lines[0] === "---" && !isProtected[0]) {
        const candidate = lines.slice(0, fromLine + 1).join("\n") + text;
        if (scanDocument(candidate.split("\n")).isProtected[0]) {
            prepend = { from: { line: 0, ch: 0 }, text: "\n" };
            cursor.line += 1;
        }
    }
    return { change: { from, to, text }, cursor, prepend };
}

/**
 * `buildDefinitionAppend`'s edit with `body` seeded after the definition
 * label - the selection-to-footnote conversion (issue #35) creates its
 * definition pre-filled with the selected text. The label is the LAST
 * occurrence in the change text (an optional section heading could carry a
 * label-shaped line above it), and the returned cursor - already at the
 * label's end - slides to the end of the body, before any trailing
 * separator newline. A multi-line body (a multi-paragraph selection,
 * 2026-08-19, already carrying its continuation indent) lands the cursor
 * at the end of its LAST line. `labelLineOffset` is the label's line
 * within the change text, found here against the UNSEEDED text: once the
 * body is spliced in, a label-shaped string inside the body ("`[^1]: x`"
 * in a code span) would win a lastIndexOf and point the caller at a
 * continuation line (review A4, Jason confirmed live 2026-09-08 - the
 * conversion was refused as protected text).
 */
export function seedDefinitionBody(
    definition: {
        change: EditorChange;
        cursor: EditorPosition;
        prepend?: EditorChange;
    },
    footnoteId: string,
    body: string,
): {
    change: EditorChange;
    cursor: EditorPosition;
    prepend?: EditorChange;
    labelLineOffset: number;
} {
    const label = `${definitionLabel(footnoteId)} `;
    const text = definition.change.text;
    const at = text.lastIndexOf(label) + label.length;
    const bodyLines = body.split("\n");
    return {
        ...definition,
        labelLineOffset: text.slice(0, at).split("\n").length - 1,
        change: {
            ...definition.change,
            text: text.slice(0, at) + body + text.slice(at),
        },
        cursor:
            bodyLines.length === 1
                ? {
                      line: definition.cursor.line,
                      ch: definition.cursor.ch + body.length,
                  }
                : {
                      line: definition.cursor.line + bodyLines.length - 1,
                      ch: bodyLines[bodyLines.length - 1].length,
                  },
    };
}
