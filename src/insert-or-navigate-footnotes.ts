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
const AllNumberedMarkers = /\[\^(\d+)\]/gi;
const AllDetailsNameOnly = /\[\^([^[\]]+)\]:/g;
const DetailInLine = /\[\^([^[\]]+)\]:/;
export const ExtractNameFromFootnote = /(\[\^)([^[\]]+)(?=\])/;


export function listExistingFootnoteDetails(
    doc: Editor
) {
    let FootnoteDetailList: string[] = [];
    
    //search each line for footnote details and add to list
    for (let i = 0; i < doc.lineCount(); i++) {
        let theLine = doc.getLine(i);
        let lineMatch = theLine.match(AllDetailsNameOnly);
        if (lineMatch) {
            let temp = lineMatch[0];
            temp = temp.replace("[^","");
            temp = temp.replace("]:","");

            FootnoteDetailList.push(temp);
        }
    }
    return FootnoteDetailList;
}

export function listExistingFootnoteMarkersAndLocations(
    doc: Editor
) {
    type markerEntry = {
        footnote: string;
        lineNum: number;
        startIndex: number;
    }
    let markerEntry;

    let FootnoteMarkerInfo = [];
    //search each line for footnote markers
    //for each, add their name, line number, and start index to FootnoteMarkerInfo
    for (let i = 0; i < doc.lineCount(); i++) {
        let theLine = doc.getLine(i);
        let lineMatch;

        while ((lineMatch = AllMarkers.exec(theLine)) != null) {
        markerEntry = {
            footnote: lineMatch[0],
            lineNum: i,
            startIndex: lineMatch.index
        }
        FootnoteMarkerInfo.push(markerEntry);
        }
    }
    return FootnoteMarkerInfo;
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

    let match = lineText.match(DetailInLine);
    if (match) {
        let s = match[0];
        let footnote = s.replace(":", "");

        let returnLineIndex = cursorPosition.line;
        // find the FIRST OCCURENCE where this footnote exists in the text
        for (let i = 0; i < doc.lineCount(); i++) {
            let scanLine = doc.getLine(i);
            if (scanLine.contains(footnote)) {
                let cursorLocationIndex = scanLine.indexOf(footnote);
                returnLineIndex = i;
                const newCursorPos = { line: returnLineIndex, ch: cursorLocationIndex + footnote.length };
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
        let theLine = doc.getLine(i);
        let lineMatch = theLine.match(DetailInLine);
        if (lineMatch) {
            // compare to the index
            let nameMatch = lineMatch[1];
            if (nameMatch == footnoteName) {
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
    }
    return false;
}

export function shouldJumpFromMarkerToDetail(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    plugin: FootnotePlugin
) {
    // Jump cursor TO detail marker

    // does this line have a footnote marker?
    // does the cursor overlap with one of them?
    // if so, which one?
    // find this footnote marker's detail line
    // place cursor there
    let markerTarget = null;

    let FootnoteMarkerInfo = listExistingFootnoteMarkersAndLocations(doc);
    let currentLine = cursorPosition.line;
    let footnotesOnLine = FootnoteMarkerInfo.filter((markerEntry: { lineNum: number; }) => markerEntry.lineNum === currentLine);

    if (footnotesOnLine != null) {
        for (let i = 0; i <= footnotesOnLine.length-1; i++) {
            if (footnotesOnLine[i].footnote !== null) {
                let marker = footnotesOnLine[i].footnote;
                let indexOfMarkerInLine = footnotesOnLine[i].startIndex;
                if (
                cursorPosition.ch >= indexOfMarkerInLine &&
                cursorPosition.ch <= indexOfMarkerInLine + marker.length
                ) {
                markerTarget = marker;
                break;
                }
            }
        }
    }
    if (markerTarget !== null) {
        // extract name
        let match = markerTarget.match(ExtractNameFromFootnote);
        if (match) {
            let footnoteName = match[2];

            // markers without a detail line fall through to the
            // detail-creation paths
            let details = listExistingFootnoteDetails(doc);
            if (!details.includes(footnoteName)) {
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

    if (plugin.settings.enableFootnoteSectionHeading == true) {
        let returnHeading = plugin.settings.FootnoteSectionHeading;
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

    if (!mdView) return false;
    if (mdView.editor == undefined) return false;

    const doc = mdView.editor;
    // an actively edited table cell owns the real caret; getCursor() is
    // stale there and inserting at it shreds the row's pipes
    const cursorPosition = resolveTableCellCursor(doc) ?? doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;

    if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc, plugin))
        return;
    if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc, plugin))
        return;

    return shouldCreateAutonumFootnote(
        lineText,
        cursorPosition,
        plugin,
        doc,
        markdownText
    );
}


export function shouldCreateAutonumFootnote(
    lineText: string,
    cursorPosition: EditorPosition,
    plugin: FootnotePlugin,
    doc: Editor,
    markdownText: string
) {
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);

    // create new footnote with the next numerical index
    let matches = markdownText.match(AllNumberedMarkers);
    let numbers: Array<number> = [];
    let currentMax = 1;

    if (matches != null) {
        for (let i = 0; i <= matches.length - 1; i++) {
            let match = matches[i];
            match = match.replace("[^", "");
            match = match.replace("]", "");
            let matchNumber = Number(match);
            numbers[i] = matchNumber;
            if (matchNumber + 1 > currentMax) {
                currentMax = matchNumber + 1;
            }
        }
    }

    let footNoteId = currentMax;
    let footnoteMarker = `[^${footNoteId}]`;

    const list = listExistingFootnoteDetails(doc);
    const isFirstFootnote = list.length === 0 && currentMax == 1;
    const detail = buildDetailAppend(doc, String(footNoteId), isFirstFootnote, plugin);
    const changes: EditorChange[] = [
        { from: cursorPosition, text: footnoteMarker },
        detail.change,
    ];

    if (popupEditingAvailable(plugin)) {
        // type the detail in a popup instead of jumping to the bottom;
        // the cursor only moves past the new marker
        const afterMarker = { line: cursorPosition.line, ch: cursorPosition.ch + footnoteMarker.length };
        doc.transaction({ changes, selection: { from: afterMarker } });
        void openFootnotePopup(plugin, String(footNoteId), () =>
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

    if (!mdView) return false;
    if (mdView.editor == undefined) return false;

    const doc = mdView.editor;
    // an actively edited table cell owns the real caret; getCursor() is
    // stale there and inserting at it shreds the row's pipes
    const cursorPosition = resolveTableCellCursor(doc) ?? doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;

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
        markdownText,
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
    
    // does this line have a footnote marker?
    // does the cursor overlap with one of them?
    // if so, which one?
    // does this footnote marker have a detail line?
    // if not, create it and place cursor there
    let reOnlyMarkersMatches = lineText.match(AllMarkers);

    let markerTarget = null;

    if (reOnlyMarkersMatches){
        for (let i = 0; i <= reOnlyMarkersMatches.length; i++) {
            let marker = reOnlyMarkersMatches[i];
            if (marker != undefined) {
                let indexOfMarkerInLine = lineText.indexOf(marker);
                if (
                    cursorPosition.ch >= indexOfMarkerInLine &&
                    cursorPosition.ch <= indexOfMarkerInLine + marker.length
                ) {
                    markerTarget = marker;
                    break;
                }
            }
        }
    }

    if (markerTarget != null) {
        //extract footnote
        let match = markerTarget.match(ExtractNameFromFootnote)
        //find if this footnote exists by listing existing footnote details
        if (match) {
            let footnoteId = match[2];

            let list: string[] = listExistingFootnoteDetails(doc);

            // Check if the list doesn't include current footnote
            // if so, add detail for the current footnote
            if(!list.includes(footnoteId)) {
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
    markdownText: string,
    plugin: FootnotePlugin
) {
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);

    //create empty footnote marker for name input, cursor in between [^ and ]
    let emptyMarker = `[^]`;
    const newCursorPos = { line: cursorPosition.line, ch: cursorPosition.ch + 2 }
    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
        { from: cursorPosition, text: emptyMarker },
    ])
}
