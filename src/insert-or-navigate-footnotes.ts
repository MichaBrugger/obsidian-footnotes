import {
	Editor,
	EditorChange,
	EditorPosition,
	MarkdownView,
	Notice
} from "obsidian";

import FootnotePlugin from "./main";
import { openFootnotePopup, popupEditingAvailable, settleFootnotePopupWithFeedback, toggleCloseFootnotePopup } from "./footnote-popup";
import { findDefinitionBlocks, maskProtectedLines, protectedLines } from "./markdown-scan";
import { EditorWithCm, VaultWithConfig, WindowWithVim } from "./obsidian-internals";
import { activeTableCellEditor, resolveTableCellCursor, TableCellEditor } from "./table-cursor";

// Core logic for both hotkey commands. Each press walks the same decision
// cascade against the caret position:
//   1. on a detail line ("[^x]: …")      → jump back to the first marker
//   2. on a marker with an existing detail → jump to (or popup-edit) it
//   3. named command, on a marker with NO detail → create the detail
//   4. otherwise → insert a new marker ("[^N]" + detail, or empty "[^]")
// Table caveat (see table-cursor.ts): when the caret is in an actively
// edited table cell, reads use the position resolved from the cell's
// sub-editor and marker writes are dispatched INTO that sub-editor.

/** Every footnote marker (numbered or named) — the (?!:) excludes details. /g: read with matchAll, never test/exec (lastIndex is stateful). */
export const AllMarkers = /\[\^([^[\]]+)\](?!:)/g;
/** Numbered markers AND numbered details — both reserve their number for autonumbering. */
const AllNumberedMarkers = /\[\^(\d+)\]/g;
// anchored: a detail only counts at the start of a line, same as markdown
const DetailInLine = /^\[\^([^[\]]+)\]:/;
/** Pulls the name out of a single marker string; the name is match[2]. */
export const ExtractNameFromFootnote = /(\[\^)([^[\]]+)(?=\])/;

// Obsidian won't render a footnote whose name contains whitespace; the
// marker regexes stay permissive so such names can be caught and warned
// about instead of silently misbehaving
export function isValidFootnoteName(name: string): boolean {
    return !/\s/.test(name);
}


// Scans run against the document's masked twin (code and frontmatter
// blotted out, indices preserved): a "[^x]" inside a code sample is plain
// text, not a footnote (issue #41).
function docLines(doc: Editor): string[] {
    const lines: string[] = [];
    for (let i = 0; i < doc.lineCount(); i++) {
        lines.push(doc.getLine(i));
    }
    return lines;
}

/** Names of all footnote details ("[^x]: …" lines) in document order, one per line at most. Code blocks don't count. */
export function listExistingFootnoteDetails(
    doc: Editor
) {
    const detailNames: string[] = [];

    //search each line for footnote details and add their names to the list
    for (const line of maskProtectedLines(docLines(doc))) {
        const match = line.match(DetailInLine);
        if (match) {
            detailNames.push(match[1]);
        }
    }
    return detailNames;
}

/** Every marker occurrence with its position — repeated markers appear once per use. Code blocks don't count. */
export function listExistingFootnoteMarkersAndLocations(
    doc: Editor
) {
    const markers: { footnote: string; lineNum: number; startIndex: number }[] = [];

    //search each line for footnote markers
    //for each, add their name, line number, and start index to the list
    const lines = docLines(doc);
    const masked = maskProtectedLines(lines);
    for (let i = 0; i < lines.length; i++) {
        for (const match of masked[i].matchAll(AllMarkers)) {
            const start = match.index ?? 0;
            markers.push({
                // slice the original: the masked match text could carry
                // mask characters when code sits inside the brackets
                footnote: lines[i].slice(start, start + match[0].length),
                lineNum: i,
                startIndex: start,
            });
        }
    }
    return markers;
}

function moveCursorAndSetJumpPoint(
    doc: Editor,
    oldCursorPos: EditorPosition,
    newCursorPos: EditorPosition,
    plugin: FootnotePlugin,
    changes?: EditorChange[],
    center = false,
): void {
    // when focus sits in a sub-editor (a table cell being edited — its
    // contentDOM is nested inside the main editor's), return it to the main
    // editor BEFORE moving the cursor: a jump out of the table would
    // otherwise leave keystrokes going to the abandoned cell editor, while
    // a jump into a table re-activates cell editing on its own
    const cmView = (doc as EditorWithCm).cm;
    if (cmView) {
        const active = cmView.contentDOM.ownerDocument.activeElement;
        if (active !== cmView.contentDOM && cmView.contentDOM.contains(active)) {
            cmView.focus();
        }
    }

    if (changes && changes.length > 0) {
        // text edits and the cursor move must go out as ONE transaction:
        // while a table cell is being edited (Obsidian 1.5+ table editor),
        // separate dispatches in the same tick race the cell editor's
        // sync-back and corrupt the document (issue #28). `selection` here
        // is resolved against the post-change document.
        doc.transaction({ changes, selection: { from: newCursorPos } });
    } else {
        doc.setCursor(newCursorPos);
    }

    // jumps land CENTERED: Obsidian's minimal scrolling would park the
    // cursor at the viewport edge — on mobile, nearly off screen. Local
    // inserts pass center=false so the view doesn't shift underfoot.
    if (center) {
        doc.scrollIntoView({ from: newCursorPos, to: newCursorPos }, true);
    }

    // if user has vim mode enabled, set jump point
    // getConfig is private API, like the vim internals below
    if ((plugin.app.vault as VaultWithConfig).getConfig?.("vimMode")) {
        (activeWindow as WindowWithVim).CodeMirrorAdapter?.Vim.getVimGlobalState_().jumpList.add(
            (doc as EditorWithCm).cm?.cm, // SIC two levels deep
            oldCursorPos,
            newCursorPos,
        );
    }
}

/** Cascade step 1: caret on a detail line → jump to the first use of its marker. Returns whether it handled the press. */
export function shouldJumpFromDetailToMarker(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    plugin: FootnotePlugin
) {
    // check if we're in a footnote detail line ("[^1]: footnote")
    // if so, jump cursor back to the footnote in the text

    // cheap pre-check on the raw line; the whole-document masking below
    // only runs when the caret actually sits on something detail-shaped
    if (!DetailInLine.test(lineText)) return false;

    // #41: a "[^x]:" inside a code block is not a detail, and a marker
    // inside code is not a jump target — scan the masked twin instead
    const masked = maskProtectedLines(docLines(doc));
    const match = (masked[cursorPosition.line] ?? "").match(DetailInLine);
    if (match) {
        const footnote = `[^${match[1]}]`;

        // find the FIRST OCCURENCE where this footnote exists in the text
        for (let i = 0; i < masked.length; i++) {
            const ch = masked[i].indexOf(footnote);
            if (ch !== -1) {
                const newCursorPos = { line: i, ch: ch + footnote.length };
                moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, undefined, true);
                return true;
            }
        }
    }
    return false;
}

/** Move the caret to the end of the named footnote's detail (including its indented continuation lines). */
export function jumpToFootnoteDetail(
    footnoteName: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    plugin: FootnotePlugin
) {
    // find the first line with this detail marker name in it — matching
    // the masked twin so detail-shaped lines inside code don't count (#41)
    const masked = maskProtectedLines(docLines(doc));
    for (let i = 0; i < masked.length; i++) {
        const lineMatch = masked[i].match(DetailInLine);
        if (lineMatch && lineMatch[1] === footnoteName) {
            // land at the END of the detail (indented lines belong to
            // it) so the user can backspace/type without arrow keys
            let endLine = i;
            while (endLine < doc.lastLine() && /^\s+\S/.test(doc.getLine(endLine + 1))) {
                endLine++;
            }
            const newCursorPos = { line: endLine, ch: doc.getLine(endLine).length };
            moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, undefined, true);
            return true;
        }
    }
    return false;
}

/**
 * The marker whose brackets contain `ch`, or null. Strictly INSIDE only —
 * same rule as inline footnotes: a caret immediately after the closing
 * bracket (or before the opening one) is outside, so the hotkey there
 * inserts a consecutive footnote instead of navigating (issue #49).
 */
export function markerAtCursor(
    markers: { footnote: string; startIndex: number }[],
    ch: number,
): string | null {
    for (const { footnote, startIndex } of markers) {
        if (ch > startIndex && ch < startIndex + footnote.length) {
            return footnote;
        }
    }
    return null;
}

/** Cascade step 2: caret on a marker that HAS a detail → popup-edit it (when enabled) or jump to it. Markers without a detail return false so creation runs. */
export function shouldJumpFromMarkerToDetail(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    plugin: FootnotePlugin
) {
    // Jump cursor TO detail marker:
    // find the marker whose brackets contain the cursor on this line,
    // then place the cursor at that footnote's detail line. This runs on
    // every keypress of both commands and a whole-document scan here is
    // measurable on large notes, so the raw line gates first — masking
    // (which needs the whole document for fence state) only runs when
    // the caret actually sits on something marker-shaped.
    const rawMarkers = [...lineText.matchAll(AllMarkers)].map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (markerAtCursor(rawMarkers, cursorPosition.ch) === null) return false;

    // #41: re-check against the masked twin — a marker inside a fence or
    // inline code is plain text, so the press falls through to insertion
    const maskedLine =
        maskProtectedLines(docLines(doc))[cursorPosition.line] ?? "";
    const markersOnLine = [...maskedLine.matchAll(AllMarkers)].map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    const markerTarget = markerAtCursor(markersOnLine, cursorPosition.ch);

    if (markerTarget !== null) {
        // extract name
        const match = markerTarget.match(ExtractNameFromFootnote);
        if (match) {
            const footnoteName = match[2];

            // markers without a detail line fall through to the
            // detail-creation paths
            if (!listExistingFootnoteDetails(doc).includes(footnoteName)) {
                return false;
            }

            if (popupEditingAvailable(plugin)) {
                void openFootnotePopup(plugin, footnoteName, () =>
                    jumpToFootnoteDetail(footnoteName, cursorPosition, doc, plugin)
                );
                return true;
            }
            return jumpToFootnoteDetail(footnoteName, cursorPosition, doc, plugin);
        }
    }
    return false;
}

export function addFootnoteSectionHeader(
    plugin: FootnotePlugin,
): string {
    //check if 'Enable Footnote Section Heading' is true
    //if so, return the "Footnote Section Heading"
    // else, return ""

    if (plugin.settings.enableFootnoteSectionHeading) {
        const returnHeading = plugin.settings.footnoteSectionHeading;
        // the setting holds literal markdown (legacy plain-text values are
        // migrated on load); a divider directly below a text line would turn
        // that line into a setext heading, so keep a blank line in between
        const dividerRegex = /^(---|\*\*\*|___)/;
        if (dividerRegex.test(returnHeading)) {
            return `\n\n${returnHeading}`;
        }
        return `\n${returnHeading}`;
    }
    return "";
}

// Build (don't apply) the edit that appends `[^id]: ` to the note's
// footnote definitions: right after the last existing definition block
// when there is one (issue #55 — the definitions may live under a
// mid-document heading with more content below), otherwise after the last
// non-blank line — trimming trailing blank lines if enabled, and adding a
// blank separator plus the optional section heading before the first
// footnote. Returned as data so the caller can bundle it with the marker
// insertion into a single transaction (see moveCursorAndSetJumpPoint).
export function buildDetailAppend(
    doc: Editor,
    footnoteId: string,
    isFirstFootnote: boolean,
    plugin: FootnotePlugin,
): { change: EditorChange; cursor: EditorPosition } {
    const lines = docLines(doc);
    const blocks = findDefinitionBlocks(lines, protectedLines(lines));
    if (blocks.length > 0) {
        const lastLine = blocks[blocks.length - 1].end;
        const text = `\n[^${footnoteId}]: `;
        return {
            change: {
                from: { line: lastLine, ch: doc.getLine(lastLine).length },
                text,
            },
            cursor: { line: lastLine + 1, ch: text.length - 1 },
        };
    }

    let text = `\n[^${footnoteId}]: `;
    if (isFirstFootnote) {
        text = addFootnoteSectionHeader(plugin) + "\n" + text;
    }

    let fromLine = doc.lastLine();
    let to: EditorPosition | undefined;
    if (plugin.settings.enableRemoveBlankLastLines === true) {
        while (fromLine > 0 && doc.getLine(fromLine).length === 0) {
            fromLine--;
        }
        to = { line: doc.lastLine(), ch: doc.getLine(doc.lastLine()).length };
    }
    const from = { line: fromLine, ch: doc.getLine(fromLine).length };

    // cursor lands at the end of the inserted detail line
    const linesAdded = text.split("\n").length - 1;
    const cursor = {
        line: fromLine + linesAdded,
        ch: text.length - text.lastIndexOf("\n") - 1,
    };
    return { change: { from, to, text }, cursor };
}

/**
 * The end-of-word insertion point within plain text: from `offset`, the end
 * of the word under (or just before) the cursor, plus one trailing
 * `.,:;`. Offsets with no word touching them are returned unchanged. This is
 * `adjustFootnotePosition` for table cells, where the main editor's
 * `wordAt` can't see the cell sub-editor's text. Word characters are `\w`
 * (ASCII), matching the marker insertion behavior users already have.
 */
export function endOfWordOffset(text: string, offset: number): number {
    const isWord = (c: string | undefined) => !!c && /\w/.test(c);
    if (!isWord(text[offset]) && !isWord(text[offset - 1])) return offset;
    let end = offset;
    while (isWord(text[end])) end++;
    if ([".", ",", ":", ";"].includes(text[end] ?? "")) end++;
    return end;
}

/** adjust cursor position to insert a footnote only at the end of word */
function adjustFootnotePosition(
    cursorPosition: EditorPosition,
    doc: Editor,
    lineText: string,
    plugin: FootnotePlugin
) {
    if (!plugin.settings.insertAtEndOfWord) return cursorPosition;
    const endOfWordUnderCursor = doc.wordAt(cursorPosition)?.to;
    if (!endOfWordUnderCursor) return cursorPosition; // no word under cursor

    // adjust cursor position to insert a footnote only at the end of word
    const nextChar = lineText.charAt(endOfWordUnderCursor.ch);
    if ([".", ",", ":", ";"].includes(nextChar)) endOfWordUnderCursor.ch++;
    cursorPosition = endOfWordUnderCursor;
    return cursorPosition;
}

// Fallback for the rare state where focus sits in a nested sub-editor whose
// EditorView isn't reachable (activeTableCellEditor returned null): editing
// the document while a sub-editor owns focus races its sync-back on blur —
// the sub-editor rewrites its region from pre-edit state, which at best
// swallows the inserted footnote and at worst displaces a table row's pipes
// (regression reported 2026-07-14; same family as issue #28). Hand focus
// back to the main editor and only edit once the sync-back has settled.
// The primary table-cell path dispatches through the cell's own editor
// instead — see shouldCreateAutonumFootnote / shouldCreateFootnoteMarker.
export function runOutsideTableCell(
    doc: Editor,
    run: (cursorPosition: EditorPosition) => void,
) {
    const cursorPosition = resolveTableCellCursor(doc) ?? doc.getCursor();
    const cm = (doc as EditorWithCm).cm;
    const active = cm?.contentDOM.ownerDocument.activeElement;
    if (!cm || !active || active === cm.contentDOM || !cm.contentDOM.contains(active)) {
        run(cursorPosition);
        return;
    }
    cm.focus();
    // rAF stalls entirely while the window is hidden (same reason the popup
    // teardown uses a timeout), which would swallow the command outright —
    // whichever of the two fires first runs the edit
    let ran = false;
    const invoke = () => {
        if (ran) return;
        ran = true;
        run(cursorPosition);
    };
    window.requestAnimationFrame(invoke);
    window.setTimeout(invoke, 100);
}

// Insert `text` at the caret of an actively edited table cell, through the
// cell's own editor so the widget handles the markdown write-back. Respects
// the end-of-word setting and leaves the cell caret `caretOffsetInText`
// characters into the inserted text (focus stays in the cell).
export function insertInTableCell(
    cell: TableCellEditor,
    plugin: FootnotePlugin,
    text: string,
    caretOffsetInText: number,
) {
    const cellText = cell.state.doc.toString();
    const head = cell.state.selection.main.head;
    const at = plugin.settings.insertAtEndOfWord
        ? endOfWordOffset(cellText, head)
        : head;
    cell.dispatch({
        changes: { from: at, insert: text },
        selection: { anchor: at + caretOffsetInText },
    });
}

//FUNCTIONS FOR AUTONUMBERED FOOTNOTES

/**
 * The note's `footnote-prefix` frontmatter value, or "" when absent. Chapter
 * notes of a combined document set this (e.g. "2.") so the autonumbered
 * command creates "[^2.1]", "[^2.2]", … — unique across the merged export
 * (issue #31).
 */
export function footnotePrefix(markdownText: string): string {
    const lines = markdownText.split("\n");
    if (lines[0] !== "---") return "";
    for (let i = 1; i < lines.length; i++) {
        if (/^(---|\.\.\.)\s*$/.test(lines[i])) break;
        const match = lines[i].match(/^footnote-prefix:\s*(.*)$/);
        if (match) {
            let value = match[1].trim();
            const quoted = value.match(/^(["'])(.*)\1$/);
            if (quoted) value = quoted[2];
            return value;
        }
    }
    return "";
}

// The prefix the autonumbered command should actually use: a prefix that
// can't form a renderable footnote name is dropped with an explanation
// instead of silently producing broken markers.
function activeFootnotePrefix(markdownText: string): string {
    const prefix = footnotePrefix(markdownText);
    if (!prefix) return "";
    if (!isValidFootnoteName(prefix) || /[[\]]/.test(prefix)) {
        new Notice(
            `The note's footnote-prefix ("${prefix}") contains spaces or brackets, so it was ignored.`,
        );
        return "";
    }
    return prefix;
}

// One more than the highest numbered marker or detail in the text; gaps in
// the numbering are not reused, and named footnotes don't count. Numbers
// inside code blocks or frontmatter don't reserve anything (#41). With a
// `prefix`, only markers carrying it count ("[^2.7]" under prefix "2."),
// and plain numbered markers belong to the "" prefix only.
export function computeNextFootnoteNumber(markdownText: string, prefix = ""): number {
    const masked = maskProtectedLines(markdownText.split("\n")).join("\n");
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const numberedMarkers = prefix
        ? new RegExp(`\\[\\^${escaped}(\\d+)\\]`, "g")
        : AllNumberedMarkers;
    let currentMax = 1;
    for (const match of masked.matchAll(numberedMarkers)) {
        currentMax = Math.max(currentMax, Number(match[1]) + 1);
    }
    return currentMax;
}

/** The auto-numbered command ("Insert / navigate auto-numbered footnote"): runs the decision cascade, creating "[^N]" + detail when nothing to navigate to. */
export async function insertAutonumFootnote(plugin: FootnotePlugin) {
    // ORDER MATTERS: settle first, then toggle. The settle wait must come
    // before the popup toggle so a same-tick second press sees the popup
    // the first press opened (and closes it) instead of racing past it —
    // and document edits must wait for a just-closed popup's pending
    // detail save, or that save clobbers them.
    await settleFootnotePopupWithFeedback();
    // pressing the hotkey while the popup editor is open closes it
    if (toggleCloseFootnotePopup()) return;

    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView || !mdView.editor) return false;

    const doc = mdView.editor;
    // an actively edited table cell owns the real caret; getCursor() is
    // stale there, and editing the row via the main editor corrupts the
    // table — reads use the resolved position, writes go through the cell
    const cell = activeTableCellEditor(doc);
    const run = (cursorPosition: EditorPosition) => {
        const lineText = doc.getLine(cursorPosition.line);

        if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc, plugin))
            return;
        if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc, plugin))
            return;

        shouldCreateAutonumFootnote(lineText, cursorPosition, plugin, doc, cell);
    };
    if (cell) run(resolveTableCellCursor(doc) ?? doc.getCursor());
    else runOutsideTableCell(doc, run);
}


/** Cascade step 4 (autonum): insert the next-numbered marker at the caret (through `cell` when in a table) and append its detail, then popup or jump per settings. */
export function shouldCreateAutonumFootnote(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    cell: TableCellEditor | null = null
) {
    // create new footnote with the next numerical index — namespaced by the
    // note's footnote-prefix property when set (#31) — reading the editor
    // document (the view's data buffer lags editor edits by a tick, so it
    // can't be trusted here)
    const markdownText = doc.getValue();
    const prefix = activeFootnotePrefix(markdownText);
    const currentMax = computeNextFootnoteNumber(markdownText, prefix);

    const footnoteId = `${prefix}${currentMax}`;
    const footnoteMarker = `[^${footnoteId}]`;

    const isFirstFootnote =
        listExistingFootnoteDetails(doc).length === 0 && currentMax === 1;

    if (cell) {
        // the marker goes through the cell's own editor (never the main
        // editor — that races the cell's sync-back and corrupts the table);
        // the detail append is outside the table, so the main editor is safe
        insertInTableCell(cell, plugin, footnoteMarker, footnoteMarker.length);
        const detail = buildDetailAppend(doc, footnoteId, isFirstFootnote, plugin);
        if (popupEditingAvailable(plugin)) {
            doc.transaction({ changes: [detail.change] });
            void openFootnotePopup(plugin, footnoteId, () =>
                moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, undefined, true)
            );
        } else {
            moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, [detail.change], true);
        }
        return;
    }

    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
    const detail = buildDetailAppend(doc, footnoteId, isFirstFootnote, plugin);
    const changes: EditorChange[] = [
        { from: cursorPosition, text: footnoteMarker },
        detail.change,
    ];

    if (popupEditingAvailable(plugin)) {
        // type the detail in a popup instead of jumping to the bottom;
        // the cursor only moves past the new marker
        const afterMarker = { line: cursorPosition.line, ch: cursorPosition.ch + footnoteMarker.length };
        doc.transaction({ changes, selection: { from: afterMarker } });
        void openFootnotePopup(plugin, footnoteId, () =>
            moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, undefined, true)
        );
    } else {
        moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, changes, true);
    }
}


//FUNCTIONS FOR INLINE FOOTNOTES (^[...])

/**
 * Clipboard text made safe as the body of an inline footnote. Inline
 * footnotes are single-line, so whitespace runs (including newlines)
 * collapse to one space and the result is trimmed. Balanced brackets pass
 * through (pasted markdown links keep working); if any bracket is
 * unbalanced — which would end the ^[...] early and corrupt the note —
 * every bracket is escaped instead. Empty/whitespace input becomes "".
 */
export function sanitizeInlineFootnoteContent(raw: string): string {
    const text = raw.replace(/\s+/g, " ").trim();
    let depth = 0;
    let balanced = true;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "\\") {
            i++; // an escaped character can't open or close anything
        } else if (c === "[") {
            depth++;
        } else if (c === "]") {
            depth--;
            if (depth < 0) break;
        }
    }
    if (depth !== 0) balanced = false;
    return balanced ? text : text.replace(/[[\]]/g, "\\$&");
}

// Shared tail of both inline commands: place `text` at the caret (through
// the cell sub-editor inside tables — see the table notes above) with the
// caret landing `caretOffsetInText` characters into the insertion.
function insertInlineText(
    plugin: FootnotePlugin,
    text: string,
    caretOffsetInText: number,
) {
    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView || !mdView.editor) return;
    const doc = mdView.editor;

    const cell = activeTableCellEditor(doc);
    if (cell) {
        insertInTableCell(cell, plugin, text, caretOffsetInText);
        return;
    }
    runOutsideTableCell(doc, (cursorPosition) => {
        const lineText = doc.getLine(cursorPosition.line);
        const at = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
        const newCursorPos = { line: at.line, ch: at.ch + caretOffsetInText };
        moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
            { from: at, text },
        ]);
    });
}

/**
 * The position just past an inline footnote's closing bracket when `ch`
 * sits inside one on `lineText`, or null when it doesn't. Bracket matching
 * is escape-aware and steps over nested balanced pairs (markdown links).
 * "Inside" spans from just after the `^` through the closing `]` itself.
 */
export function inlineFootnoteExitCh(lineText: string, ch: number): number | null {
    for (let i = 0; i < lineText.length - 1; i++) {
        const c = lineText[i];
        if (c === "\\") {
            i++;
            continue;
        }
        if (c !== "^" || lineText[i + 1] !== "[") continue;

        let depth = 0;
        let close = -1;
        for (let j = i + 1; j < lineText.length; j++) {
            const cj = lineText[j];
            if (cj === "\\") {
                j++;
            } else if (cj === "[") {
                depth++;
            } else if (cj === "]") {
                depth--;
                if (depth === 0) {
                    close = j;
                    break;
                }
            }
        }
        // unclosed footnote: no exit position exists on this line at all
        if (close === -1) return null;
        if (ch > i && ch <= close) return close + 1;
        i = close; // cursor isn't in this one — keep scanning after it
    }
    return null;
}

/**
 * Inline-footnote command: inserts `^[]` with the caret between the
 * brackets for quick writing. A second press while the cursor is still
 * inside an inline footnote instead hops it just past the closing bracket,
 * so typing continues without reaching for the arrow keys.
 */
export async function insertInlineFootnote(plugin: FootnotePlugin) {
    // settle before toggle — same ordering rationale as insertAutonumFootnote
    await settleFootnotePopupWithFeedback();
    // pressing any footnote hotkey while the popup editor is open closes it
    if (toggleCloseFootnotePopup()) return;

    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView || !mdView.editor) return;
    const doc = mdView.editor;

    const cell = activeTableCellEditor(doc);
    if (cell) {
        const exit = inlineFootnoteExitCh(
            cell.state.doc.toString(),
            cell.state.selection.main.head,
        );
        if (exit !== null) {
            cell.dispatch({ selection: { anchor: exit } });
            return;
        }
    } else {
        const cursorPosition = doc.getCursor();
        const exit = inlineFootnoteExitCh(doc.getLine(cursorPosition.line), cursorPosition.ch);
        if (exit !== null) {
            doc.setCursor({ line: cursorPosition.line, ch: exit });
            return;
        }
    }

    insertInlineText(plugin, "^[]", 2);
}

/** Inline-footnote paste command: inserts `^[<clipboard>]` with the caret after it. */
export async function pasteInlineFootnote(plugin: FootnotePlugin) {
    // settle before toggle — same ordering rationale as insertAutonumFootnote
    await settleFootnotePopupWithFeedback();
    if (toggleCloseFootnotePopup()) return;

    // read the clipboard BEFORE resolving positions — it's the only await,
    // and everything position-dependent should happen after it
    let raw: string;
    try {
        raw = await navigator.clipboard.readText();
    } catch {
        new Notice("Couldn't read the clipboard.");
        return;
    }
    const content = sanitizeInlineFootnoteContent(raw);
    if (!content) {
        new Notice("Clipboard is empty — nothing to put in an inline footnote.");
        return;
    }
    const text = `^[${content}]`;
    insertInlineText(plugin, text, text.length);
}

//FUNCTIONS FOR NAMED FOOTNOTES

/** The named command ("Insert / navigate named footnote"): same cascade, but creation is two-step — first press inserts "[^]" for name entry, next press (caret on the named marker) creates its detail. */
export async function insertNamedFootnote(plugin: FootnotePlugin) {
    // settle before toggle — same ordering rationale as insertAutonumFootnote
    await settleFootnotePopupWithFeedback();
    // pressing the hotkey while the popup editor is open closes it
    if (toggleCloseFootnotePopup()) return;

    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView || !mdView.editor) return false;

    const doc = mdView.editor;
    // an actively edited table cell owns the real caret; getCursor() is
    // stale there, and editing the row via the main editor corrupts the
    // table — reads use the resolved position, writes go through the cell
    const cell = activeTableCellEditor(doc);
    const run = (cursorPosition: EditorPosition) => {
        const lineText = doc.getLine(cursorPosition.line);

        if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc, plugin))
            return;
        if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc, plugin))
            return;

        if (shouldCreateMatchingFootnoteDetail(lineText, cursorPosition, plugin, doc))
            return;
        shouldCreateFootnoteMarker(lineText, cursorPosition, doc, plugin, cell);
    };
    if (cell) run(resolveTableCellCursor(doc) ?? doc.getCursor());
    else runOutsideTableCell(doc, run);
}

/** Cascade step 3 (named only): caret on a marker with no detail → append the matching detail (or warn on an invalid name). Returns true when it handled the press. */
export function shouldCreateMatchingFootnoteDetail(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor
) {
    // Create matching footnote detail for footnote marker

    // is the cursor inside a footnote marker on this line?
    // does that marker have a detail line?
    // if not, create it and place cursor there
    // (raw-line gate first, masked re-check after — same rationale and
    // #41 semantics as shouldJumpFromMarkerToDetail above)
    const rawMarkers = [...lineText.matchAll(AllMarkers)].map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    if (markerAtCursor(rawMarkers, cursorPosition.ch) === null) return;

    const maskedLine =
        maskProtectedLines(docLines(doc))[cursorPosition.line] ?? "";
    const markersOnLine = [...maskedLine.matchAll(AllMarkers)].map((match) => ({
        footnote: match[0],
        startIndex: match.index ?? 0,
    }));
    const markerTarget = markerAtCursor(markersOnLine, cursorPosition.ch);

    if (markerTarget !== null) {
        //extract footnote
        const match = markerTarget.match(ExtractNameFromFootnote);
        //find if this footnote exists by listing existing footnote details
        if (match) {
            const footnoteId = match[2];

            // a spaced name is a common authoring mistake Obsidian won't
            // render; warn instead of creating a detail that can't work
            if (!isValidFootnoteName(footnoteId)) {
                new Notice(
                    `Footnote name "${footnoteId}" contains spaces, so Obsidian won't render it as a footnote. Remove the spaces.`,
                );
                return true;
            }

            const list = listExistingFootnoteDetails(doc);

            // Check if the list doesn't include current footnote
            // if so, add detail for the current footnote
            if (!list.includes(footnoteId)) {
                const detail = buildDetailAppend(doc, footnoteId, list.length === 0, plugin);

                if (popupEditingAvailable(plugin)) {
                    // type the detail in a popup instead of jumping to the
                    // bottom; the cursor stays on the marker
                    doc.transaction({ changes: [detail.change] });
                    void openFootnotePopup(plugin, footnoteId, () =>
                        moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, undefined, true)
                    );
                } else {
                    moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, [detail.change], true);
                }

                return true;
            }
            return;
        }
    }
}

/** Cascade step 4 (named): insert an empty "[^]" (through `cell` when in a table) with the caret between the brackets, ready for name entry. */
export function shouldCreateFootnoteMarker(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    plugin: FootnotePlugin,
    cell: TableCellEditor | null = null
) {
    //create empty footnote marker for name input, cursor in between [^ and ]
    const emptyMarker = `[^]`;

    if (cell) {
        // through the cell's own editor (never the main editor — that races
        // the cell's sync-back and corrupts the table); the caret lands
        // between the brackets and focus stays in the cell for name entry
        insertInTableCell(cell, plugin, emptyMarker, 2);
        return;
    }

    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
    const newCursorPos = { line: cursorPosition.line, ch: cursorPosition.ch + 2 };
    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
        { from: cursorPosition, text: emptyMarker },
    ]);
}
