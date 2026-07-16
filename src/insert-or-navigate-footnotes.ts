import {
	Editor,
	EditorChange,
	EditorPosition,
	MarkdownView,
	Notice
} from "obsidian";

import FootnotePlugin from "./main";
import { openFootnotePopup, popupEditingAvailable, toggleCloseFootnotePopup } from "./footnote-popup";
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


/** Names of all footnote details ("[^x]: …" lines) in document order, one per line at most. */
export function listExistingFootnoteDetails(
    doc: Editor
) {
    const detailNames: string[] = [];

    //search each line for footnote details and add their names to the list
    for (let i = 0; i < doc.lineCount(); i++) {
        const match = doc.getLine(i).match(DetailInLine);
        if (match) {
            detailNames.push(match[1]);
        }
    }
    return detailNames;
}

/** Every marker occurrence with its position — repeated markers appear once per use. */
export function listExistingFootnoteMarkersAndLocations(
    doc: Editor
) {
    const markers: { footnote: string; lineNum: number; startIndex: number }[] = [];

    //search each line for footnote markers
    //for each, add their name, line number, and start index to the list
    for (let i = 0; i < doc.lineCount(); i++) {
        for (const match of doc.getLine(i).matchAll(AllMarkers)) {
            markers.push({
                footnote: match[0],
                lineNum: i,
                startIndex: match.index ?? 0,
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

    const match = lineText.match(DetailInLine);
    if (match) {
        const footnote = `[^${match[1]}]`;

        // find the FIRST OCCURENCE where this footnote exists in the text
        for (let i = 0; i < doc.lineCount(); i++) {
            const ch = doc.getLine(i).indexOf(footnote);
            if (ch !== -1) {
                const newCursorPos = { line: i, ch: ch + footnote.length };
                moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin);
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
    // find the first line with this detail marker name in it.
    for (let i = 0; i < doc.lineCount(); i++) {
        const lineMatch = doc.getLine(i).match(DetailInLine);
        if (lineMatch && lineMatch[1] === footnoteName) {
            // land at the END of the detail (indented lines belong to
            // it) so the user can backspace/type without arrow keys
            let endLine = i;
            while (endLine < doc.lastLine() && /^\s+\S/.test(doc.getLine(endLine + 1))) {
                endLine++;
            }
            const newCursorPos = { line: endLine, ch: doc.getLine(endLine).length };
            moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin);
            return true;
        }
    }
    return false;
}

/** Cascade step 2: caret on a marker that HAS a detail → popup-edit it (when enabled) or jump to it. Markers without a detail return false so creation runs. */
export function shouldJumpFromMarkerToDetail(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    plugin: FootnotePlugin
) {
    // Jump cursor TO detail marker:
    // find the marker the cursor overlaps on this line,
    // then place the cursor at that footnote's detail line
    let markerTarget: string | null = null;

    const markersOnLine = listExistingFootnoteMarkersAndLocations(doc)
        .filter((entry) => entry.lineNum === cursorPosition.line);
    for (const { footnote, startIndex } of markersOnLine) {
        if (
            cursorPosition.ch >= startIndex &&
            cursorPosition.ch <= startIndex + footnote.length
        ) {
            markerTarget = footnote;
            break;
        }
    }

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

// Build (don't apply) the edit that appends `[^id]: ` after the last
// non-blank line — trimming trailing blank lines if enabled, and adding a
// blank separator plus the optional section heading before the first
// footnote. Returned as data so the caller can bundle it with the marker
// insertion into a single transaction (see moveCursorAndSetJumpPoint).
function buildDetailAppend(
    doc: Editor,
    footnoteId: string,
    isFirstFootnote: boolean,
    plugin: FootnotePlugin,
): { change: EditorChange; cursor: EditorPosition } {
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
function runOutsideTableCell(
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
    window.requestAnimationFrame(() => run(cursorPosition));
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

// One more than the highest numbered marker or detail in the text; gaps in
// the numbering are not reused, and named footnotes don't count.
export function computeNextFootnoteNumber(markdownText: string): number {
    let currentMax = 1;
    for (const match of markdownText.matchAll(AllNumberedMarkers)) {
        currentMax = Math.max(currentMax, Number(match[1]) + 1);
    }
    return currentMax;
}

/** The auto-numbered command ("Insert / navigate auto-numbered footnote"): runs the decision cascade, creating "[^N]" + detail when nothing to navigate to. */
export function insertAutonumFootnote(plugin: FootnotePlugin) {
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
    // create new footnote with the next numerical index, reading the editor
    // document (the view's data buffer lags editor edits by a tick, so it
    // can't be trusted here)
    const currentMax = computeNextFootnoteNumber(doc.getValue());

    const footnoteId = String(currentMax);
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
                moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin)
            );
        } else {
            moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, [detail.change]);
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
            moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin)
        );
    } else {
        moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, changes);
    }
}


//FUNCTIONS FOR NAMED FOOTNOTES

/** The named command ("Insert / navigate named footnote"): same cascade, but creation is two-step — first press inserts "[^]" for name entry, next press (caret on the named marker) creates its detail. */
export function insertNamedFootnote(plugin: FootnotePlugin) {
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

    // does the cursor overlap a footnote marker on this line?
    // does that marker have a detail line?
    // if not, create it and place cursor there
    let markerTarget: string | null = null;

    for (const match of lineText.matchAll(AllMarkers)) {
        const startIndex = match.index ?? 0;
        if (
            cursorPosition.ch >= startIndex &&
            cursorPosition.ch <= startIndex + match[0].length
        ) {
            markerTarget = match[0];
            break;
        }
    }

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
                        moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin)
                    );
                } else {
                    moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, [detail.change]);
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
