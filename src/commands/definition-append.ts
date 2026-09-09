import { Editor, EditorChange, EditorPosition } from "obsidian";

import type FootnotePlugin from "../main";
import { comparePositions } from "../editor/cursor-motion";
import { DocContext, docContext } from "../editor/doc-context";
import { definitionLabel } from "../parsing/footnote-grammar";
import { findLineRunEnd, scanDocument } from "../parsing/markdown-scan";

// Where a new footnote definition goes. This module holds the
// section-heading setting and the append edit, both of which every
// creation press shares. Split out of the one big commands file on
// 2026-08-11.

function addFootnoteSectionHeader(plugin: FootnotePlugin): string {
    //If the "Enable Footnote Section Heading" setting is on, return the
    //"Footnote Section Heading" setting's text. Otherwise return "".

    // A heading whose text has been cleared out counts as no heading at
    // all. Lint already reads "" that way, and without this check the
    // "\n\n" prefix plus an empty heading would leave stray blank lines
    // sitting above the first footnote.
    if (
        plugin.settings.enableFootnoteSectionHeading &&
        plugin.settings.footnoteSectionHeading
    ) {
        // The setting holds real markdown; older plain-text values are
        // converted when the plugin loads. A blank line always goes
        // between the heading and whatever is above it. That is the
        // markdown convention for blocks (requested 2026-07-20), and it
        // also stops a heading that begins with a divider from turning the
        // line above it into a setext heading.
        return `\n\n${plugin.settings.footnoteSectionHeading}`;
    }
    return "";
}

// Works out the edit that adds a "[^name]: " label to the note's
// definitions, and hands it back without applying it.
//
// Where it goes: right after the last definition block when the note has
// one. That matters because the definitions may sit under a heading in the
// middle of the note with more content below them (issue #55). When there
// is no definition yet, it goes after the last line that has anything on
// it, trimming trailing blank lines if that setting is on. Before the very
// first footnote it also adds a blank line and, if enabled, the section
// heading.
//
// It comes back as plain data so that the calling code can put it and the
// reference insertion into one single edit (see moveCursorAndSetJumpPoint).
export function buildDefinitionAppend(
    doc: Editor,
    footnoteId: string,
    isFirstFootnote: boolean,
    plugin: FootnotePlugin,
    ctx: DocContext = docContext(doc),
    // The stretch of text a conversion is about to replace in this same
    // edit. Two things follow from that. The definition must not land
    // inside it, or the two edits would overlap. And a section heading
    // that the selection is swallowing is no place to put the definition
    // under (found by a property test, 2026-09-09: dragging across a
    // "# Footnotes" heading with the setting on wrote the definition into
    // the middle of the selection and glued the rest of the paragraph onto
    // it).
    //
    // Only two of the four places a definition can go could ever fall
    // inside this stretch, and both consult it: the slot under the heading,
    // which is skipped when the heading is being swallowed, and the walk
    // upward from a note ending inside an unclosed region. The other two
    // cannot land inside it, because the calling code refuses a selection
    // that overlaps a definition block, and the append at the end of the
    // note sits at or after where the selection ends.
    avoid?: { from: EditorPosition; to: EditorPosition },
): { change: EditorChange; cursor: EditorPosition; prepend?: EditorChange } {
    // Read everything through `ctx`, never through `doc`. The table-cell
    // path writes into the cell between building the context and calling
    // this, so reading the document from two places is exactly how the two
    // pictures of it come to disagree (second review 2026-09-09).
    const lines = ctx.lines;
    const isProtected = ctx.scan.isProtected;
    const blocks = ctx.blocks();
    // Whether inserting at the END of `line` would land strictly inside
    // the stretch `avoid` names.
    const endInsideAvoid = (line: number): boolean => {
        if (!avoid) return false;
        const at = { line, ch: lines[line].length };
        return comparePositions(avoid.from, at) < 0 && comparePositions(at, avoid.to) < 0;
    };
    // A line with text on it directly below the new definition gets pulled
    // INTO the definition, because Obsidian carries a definition on into
    // the next line. So when there is content below, add a blank line
    // after the definition (the A4 bug, 2026-07-20). The caret still lands
    // on the definition line itself.
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

    // No definitions yet. But if the note already has a section heading,
    // that heading claims the first footnote (a follow-up to issue #55):
    // put the definition under it, rather than adding a second heading at
    // the end of the note. The setting can hold markdown spanning several
    // lines, so what is matched is a run of lines, not one line.
    if (
        plugin.settings.enableFootnoteSectionHeading &&
        plugin.settings.footnoteSectionHeading
    ) {
        // findLineRunEnd is the single piece of code that finds the
        // heading, shared with the move-to-bottom rule. They have to agree
        // on what counts as the existing heading, or running lint twice
        // would keep changing the note instead of settling.
        const headingLines = plugin.settings.footnoteSectionHeading.split("\n");
        const anchorEnd = findLineRunEnd(lines, isProtected, headingLines);
        // A heading the selection overlaps is about to be converted away
        // along with the rest of the selection. A drag that stops at
        // character 0 of the heading's line leaves the heading intact.
        const headingSwallowed =
            anchorEnd !== -1 &&
            avoid !== undefined &&
            anchorEnd >= avoid.from.line &&
            (anchorEnd - headingLines.length + 1 < avoid.to.line ||
                (anchorEnd - headingLines.length + 1 === avoid.to.line && avoid.to.ch > 0));
        if (anchorEnd !== -1 && !headingSwallowed) {
            let fromLine = anchorEnd;
            let slotText = `\n\n[^${footnoteId}]: `;
            // If a blank line already sits between the heading and what
            // follows, use that one instead of adding a second.
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
        // The note ends inside a fence, comment, or math region that was
        // never closed (2026-08-11 review, bug #10). A definition added at
        // the very end would be born inside it as dead text, and the next
        // lint would then delete its live reference as an orphan.
        //
        // So put it above the unclosed region: walk up to the last line a
        // definition can follow, then keep walking up past blank lines.
        // The trailing-blank trimming must not run in this case, because
        // its range reaches to the end of the note and would delete the
        // unclosed region itself.
        while (
            fromLine >= 0 &&
            (ctx.scan.endsProtectedAt[fromLine] || endInsideAvoid(fromLine))
        ) {
            fromLine--;
        }
        while (fromLine >= 0 && (lines[fromLine].trim() === "" || endInsideAvoid(fromLine))) fromLine--;
        if (fromLine < 0) {
            // The unclosed region starts at line 0, so there is nowhere
            // above it to walk to. Put the definition at the very top,
            // with a blank line between it and whatever follows.
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
        // The heading already brings a blank line of its own above it. If
        // the line we are inserting after is itself blank, which happens
        // when trimming is off and the note ends empty, that blank line is
        // already there, so drop the heading's one.
        if (heading && lines[fromLine].trim() === "") {
            heading = heading.slice(1);
        }
        text = heading + "\n" + text;
    } else if (lines[fromLine].trim() !== "") {
        // Not the first footnote, and yet there is no definition block at
        // the left margin to append under, because the note's only
        // definitions are inside blockquotes. Without help the label would
        // land directly beneath a line of prose, and Obsidian reads such a
        // line as more of that paragraph rather than as a definition. The
        // project calls that a lazy label; definitionStartLines is what
        // decides it (ground truth in the live Reading view, 2026-09-09).
        // So give it the blank line that the first footnote would have
        // received from its heading.
        text = "\n" + text;
    }

    // The caret ends up at the end of the definition line just inserted.
    const linesAdded = text.split("\n").length - 1;
    const cursor = {
        line: fromLine + linesAdded,
        ch: text.length - text.lastIndexOf("\n") - 1,
    };

    // When the definition sits in the middle of the note, above an
    // unclosed region, a line with text on it directly below would be
    // pulled INTO the new definition. Same danger as at the other places a
    // definition can be inserted (the A4 bug again).
    if (ctx.scan.endsProtected && needsSeparator(fromLine)) text += "\n";

    // The first footnote's section heading may itself start with a "---"
    // divider at the left margin. If the note's first line is also a bare
    // "---", meaning a horizontal rule with no partner, adding that second
    // divider makes Obsidian re-read the whole top of the note as YAML
    // frontmatter and swallow the prose in it. The same danger that
    // preserveLeadingThematicBreak handles in
    // move-footnotes-to-the-bottom, checked against Obsidian's own
    // metadataCache on 2026-08-10.
    //
    // The fix: add a blank line at the very top in the same edit. That
    // pins line 0 as ordinary content, and it renders exactly the same.
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
 * Takes buildDefinitionAppend's edit and fills `body` in after the label,
 * because a conversion (issue #35) creates its definition already holding
 * the selected text.
 *
 * The label is the LAST label-shaped string in the edit's text, since an
 * optional section heading above it could contain one too. The caret,
 * which arrives sitting at the end of the label, slides along to the end
 * of the body, and stops before any blank line added after it.
 *
 * When the body spans several lines, which happens when a selection
 * spanning lines is converted (2026-08-19) and which already carries its
 * continuation indent, the caret lands at the end of the body's LAST line.
 *
 * `labelLineOffset` is which line of the edit's text the label is on. It
 * is worked out here, BEFORE the body is filled in. Once the body is
 * spliced in, a label-shaped string inside the body, say "`[^1]: x`"
 * written in a code span, would be the last one and would point the caller
 * at a continuation line instead (review A4; Jason confirmed it live on
 * 2026-09-08, where the conversion was wrongly refused as protected text).
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
