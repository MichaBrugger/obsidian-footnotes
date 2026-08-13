import { Editor, EditorChange, EditorPosition } from "obsidian";

import type FootnotePlugin from "../main";
import { DocContext, docContext } from "../editor/doc-context";
import { findDefinitionBlocks, findLineRunEnd, scanDocument } from "../parsing/markdown-scan";

// Where a new footnote definition lands: the section-heading setting and
// the append edit both creation paths share. Split out of the all-in-one
// commands file 2026-08-11.

function addFootnoteSectionHeader(plugin: FootnotePlugin): string {
    //check if 'Enable Footnote Section Heading' is true
    //if so, return the "Footnote Section Heading"
    // else, return ""

    // a cleared-out heading value counts as no heading — the lint path
    // already treats "" that way, and "\n\n" + "" would otherwise strand
    // stray blank lines above the first footnote
    if (
        plugin.settings.enableFootnoteSectionHeading &&
        plugin.settings.footnoteSectionHeading
    ) {
        // the setting holds literal markdown (legacy plain-text values are
        // migrated on load); a blank line ALWAYS separates the heading from
        // the content above it — markdown block convention (requested
        // 2026-07-20), and it keeps a heading starting with a divider from
        // turning the line above into a setext heading
        return `\n\n${plugin.settings.footnoteSectionHeading}`;
    }
    return "";
}

// Build (don't apply) the edit that appends `[^id]: ` to the note's
// footnote definitions: right after the last existing definition block
// when there is one (issue #55 — the definitions may live under a
// mid-document heading with more content below), otherwise after the last
// non-blank line — trimming trailing blank lines if enabled, and adding a
// blank separator plus the optional section heading before the first
// footnote. Returned as data so the caller can bundle it with the reference
// insertion into a single transaction (see moveCursorAndSetJumpPoint).
export function buildDefinitionAppend(
    doc: Editor,
    footnoteId: string,
    isFirstFootnote: boolean,
    plugin: FootnotePlugin,
    ctx: DocContext = docContext(doc),
): { change: EditorChange; cursor: EditorPosition; prepend?: EditorChange } {
    const lines = ctx.lines;
    const isProtected = ctx.scan.isProtected;
    const blocks = findDefinitionBlocks(lines, isProtected, ctx.scan);
    // a non-blank line directly below the new definition would be pulled INTO
    // it — Obsidian lazily continues a definition into the next line — so
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
                from: { line: lastLine, ch: doc.getLine(lastLine).length },
                text,
            },
            cursor,
        };
    }

    // no definitions yet — but an existing section heading in the note
    // claims the first footnote (QOL follow-up to issue #55): slot the
    // definition under it instead of appending a second heading at the end.
    // The setting is markdown that can span multiple lines, so match runs.
    if (
        plugin.settings.enableFootnoteSectionHeading &&
        plugin.settings.footnoteSectionHeading
    ) {
        // findLineRunEnd is the ONE anchor matcher shared with the
        // move-to-bottom rule — the fixed-point guarantee needs both to
        // agree on what counts as the existing heading
        const anchorEnd = findLineRunEnd(
            lines,
            isProtected,
            plugin.settings.footnoteSectionHeading.split("\n"),
        );
        if (anchorEnd !== -1) {
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
                    from: { line: fromLine, ch: doc.getLine(fromLine).length },
                    text: slotText,
                },
                cursor,
            };
        }
    }

    let fromLine = doc.lastLine();
    let to: EditorPosition | undefined;
    if (ctx.scan.endsProtected) {
        // the note ends inside an UNCLOSED fence/comment/math (2026-08-11
        // review bug #10): a definition appended at EOF would be born as
        // inert code — and the next lint would then delete its live
        // reference as an orphan. Land it above the unclosed region: walk
        // up to the last prefix a definition can live after, then past
        // blank lines. Trailing-blank trimming must not fire here — its
        // `to` spans to EOF and would delete the region itself.
        while (
            fromLine >= 0 &&
            scanDocument(lines.slice(0, fromLine + 1)).endsProtected
        ) {
            fromLine--;
        }
        while (fromLine >= 0 && lines[fromLine].trim() === "") fromLine--;
        if (fromLine < 0) {
            // the unclosed region starts at line 0 — plant the definition
            // on top, blank-separated from whatever follows
            const topText =
                `[^${footnoteId}]: \n` + (lines[0].trim() === "" ? "" : "\n");
            return {
                change: { from: { line: 0, ch: 0 }, text: topText },
                cursor: { line: 0, ch: `[^${footnoteId}]: `.length },
            };
        }
    } else if (plugin.settings.enableRemoveBlankLastLines) {
        while (fromLine > 0 && doc.getLine(fromLine).length === 0) {
            fromLine--;
        }
        to = { line: doc.lastLine(), ch: doc.getLine(doc.lastLine()).length };
    }
    const from = { line: fromLine, ch: doc.getLine(fromLine).length };

    let text = `\n[^${footnoteId}]: `;
    if (isFirstFootnote) {
        let heading = addFootnoteSectionHeader(plugin);
        // the heading carries its own blank line above; a blank insertion
        // line (trimming off, note ends empty) already supplies it
        if (heading && doc.getLine(fromLine).trim() === "") {
            heading = heading.slice(1);
        }
        text = heading + "\n" + text;
    }

    // cursor lands at the end of the inserted definition line
    const linesAdded = text.split("\n").length - 1;
    const cursor = {
        line: fromLine + linesAdded,
        ch: text.length - text.lastIndexOf("\n") - 1,
    };

    // with the insertion sitting mid-document (above an unclosed region),
    // a non-blank line directly below it would be pulled INTO the new
    // definition — same A4 hazard as the other insertion points
    if (ctx.scan.endsProtected && needsSeparator(fromLine)) text += "\n";

    // The first footnote's section heading can carry a column-0 "---"
    // divider; if the note's first line is a bare unclosed "---" (a
    // thematic break), inserting that divider makes Obsidian re-read the
    // whole head as YAML frontmatter, swallowing the prose in it (same
    // hazard as preserveLeadingThematicBreak in
    // move-footnotes-to-the-bottom — verified against metadataCache,
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
