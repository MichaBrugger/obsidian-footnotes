import {
	Editor,
	EditorChange,
	EditorPosition,
	MarkdownView
} from "obsidian";

import FootnotePlugin from "./main";
import { openFootnotePopup, popupEditingAvailable, toggleCloseFootnotePopup } from "./footnote-popup";
import { EditorWithCm, VaultWithConfig, WindowWithVim } from "./obsidian-internals";
import { resolveTableCellCursor } from "./table-cursor";

export const AllMarkers = /\[\^([^[\]]+)\](?!:)/g;
const AllNumberedMarkers = /\[\^(\d+)\]/g;
const DetailInLine = /\[\^([^[\]]+)\]:/;
export const ExtractNameFromFootnote = /(\[\^)([^[\]]+)(?=\])/;


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

//FUNCTIONS FOR AUTONUMBERED FOOTNOTES

export function insertAutonumFootnote(plugin: FootnotePlugin) {
    // pressing the hotkey while the popup editor is open closes it
    if (toggleCloseFootnotePopup()) return;

    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView || !mdView.editor) return false;

    const doc = mdView.editor;
    // an actively edited table cell owns the real caret; getCursor() is
    // stale there and inserting at it shreds the row's pipes
    const cursorPosition = resolveTableCellCursor(doc) ?? doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);

    if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc, plugin))
        return;
    if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc, plugin))
        return;

    return shouldCreateAutonumFootnote(
        lineText,
        cursorPosition,
        plugin,
        doc
    );
}


export function shouldCreateAutonumFootnote(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor
) {
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);

    // create new footnote with the next numerical index, scanning the
    // editor document line by line (the view's data buffer lags editor
    // edits by a tick, so it can't be trusted here)
    let currentMax = 1;
    for (let i = 0; i < doc.lineCount(); i++) {
        for (const match of doc.getLine(i).matchAll(AllNumberedMarkers)) {
            currentMax = Math.max(currentMax, Number(match[1]) + 1);
        }
    }

    const footnoteId = String(currentMax);
    const footnoteMarker = `[^${footnoteId}]`;

    const isFirstFootnote =
        listExistingFootnoteDetails(doc).length === 0 && currentMax === 1;
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

export function insertNamedFootnote(plugin: FootnotePlugin) {
    // pressing the hotkey while the popup editor is open closes it
    if (toggleCloseFootnotePopup()) return;

    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView || !mdView.editor) return false;

    const doc = mdView.editor;
    // an actively edited table cell owns the real caret; getCursor() is
    // stale there and inserting at it shreds the row's pipes
    const cursorPosition = resolveTableCellCursor(doc) ?? doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);

    if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc, plugin))
        return;
    if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc, plugin))
        return;

    if (shouldCreateMatchingFootnoteDetail(lineText, cursorPosition, plugin, doc))
        return;
    return shouldCreateFootnoteMarker(
        lineText,
        cursorPosition,
        doc,
        plugin
    );
}

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

export function shouldCreateFootnoteMarker(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    plugin: FootnotePlugin
) {
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);

    //create empty footnote marker for name input, cursor in between [^ and ]
    const emptyMarker = `[^]`;
    const newCursorPos = { line: cursorPosition.line, ch: cursorPosition.ch + 2 };
    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
        { from: cursorPosition, text: emptyMarker },
    ]);
}
