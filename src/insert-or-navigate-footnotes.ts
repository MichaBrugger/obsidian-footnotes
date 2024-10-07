import { 
    Editor, 
    EditorPosition, 
    MarkdownView
} from "obsidian";

import FootnotePlugin from "./main";

export var AllMarkers = /\[\^([^\[\]]+)\](?!:)/dg;
var AllNumberedMarkers = /\[\^(\d+)\]/gi;
var AllDetailsNameOnly = /\[\^([^\[\]]+)\]:/g;
var DetailInLine = /\[\^([^\[\]]+)\]:/;
export var ExtractNameFromFootnote = /(\[\^)([^\[\]]+)(?=\])/;


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
    if (FootnoteDetailList.length > 0) {
        return FootnoteDetailList;
    } else {
        return null;
    }
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

export function shouldJumpFromDetailToMarker(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor
) {
    // check if we're in a footnote detail line ("[^1]: footnote")
    // if so, jump cursor back to the footnote in the text

    let match = lineText.match(DetailInLine);
    if (match) {
        let s = match[0];
        let index = s.replace("[^", "");
        index = index.replace("]:", "");
        let footnote = s.replace(":", "");

        let returnLineIndex = cursorPosition.line;
        // find the FIRST OCCURENCE where this footnote exists in the text
        for (let i = 0; i < doc.lineCount(); i++) {
            let scanLine = doc.getLine(i);
            if (scanLine.contains(footnote)) {
                let cursorLocationIndex = scanLine.indexOf(footnote);
                returnLineIndex = i;
                doc.setCursor({
                line: returnLineIndex,
                ch: cursorLocationIndex + footnote.length,
                });
                return true;
            }
        }
    }
    return false;
}

export function shouldJumpFromMarkerToDetail(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor
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

            // find the first line with this detail marker name in it.
            for (let i = 0; i < doc.lineCount(); i++) {
                let theLine = doc.getLine(i);
                let lineMatch = theLine.match(DetailInLine);
                if (lineMatch) {
                    // compare to the index
                    let nameMatch = lineMatch[1];
                    if (nameMatch == footnoteName) {
                        doc.setCursor({ line: i, ch: lineMatch[0].length + 1 });
                        return true;
                    }
                }
            }
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
        return returnHeading;
    }
    return "";
}


//FUNCTIONS FOR AUTONUMBERED FOOTNOTES

export function insertAutonumFootnote(plugin: FootnotePlugin) {
    const mdView = app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView) return false;
    if (mdView.editor == undefined) return false;

    const doc = mdView.editor;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;

    if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc))
        return;
    if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc))
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
    let linePart1 = lineText.substr(0, cursorPosition.ch);
    let linePart2 = lineText.substr(cursorPosition.ch);
    let newLine = linePart1 + footnoteMarker + linePart2;

    doc.replaceRange(
        newLine,
        { line: cursorPosition.line, ch: 0 },
        { line: cursorPosition.line, ch: lineText.length }
    );

    let lastLineIndex = doc.lastLine();
    let lastLine = doc.getLine(lastLineIndex);

    while (lastLineIndex > 0) {
        lastLine = doc.getLine(lastLineIndex);
        if (lastLine.length > 0) {
            doc.replaceRange(
                "",
                { line: lastLineIndex, ch: 0 },
                { line: doc.lastLine(), ch: 0 }
            );
            break;
        }
        lastLineIndex--;
    }

    let footnoteDetail = `\n[^${footNoteId}]: `;

    let list = listExistingFootnoteDetails(doc);
    
    if (list===null && currentMax == 1) {
        footnoteDetail = "\n" + footnoteDetail;
        let Heading = addFootnoteSectionHeader(plugin);
        doc.setLine(doc.lastLine(), lastLine + Heading + footnoteDetail);
        doc.setCursor(doc.lastLine() - 1, footnoteDetail.length - 1);
    } else {
        doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
        doc.setCursor(doc.lastLine(), footnoteDetail.length - 1);
    }
}


//FUNCTIONS FOR NAMED FOOTNOTES

export function insertNamedFootnote(plugin: FootnotePlugin) {
    const mdView = app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView) return false;
    if (mdView.editor == undefined) return false;

    const doc = mdView.editor;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;

    if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc))
        return;
    if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc))
        return;

    if (shouldCreateMatchingFootnoteDetail(lineText, cursorPosition, plugin, doc))
        return; 
    return shouldCreateFootnoteMarker(
        lineText,
        cursorPosition,
        doc,
        markdownText
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
            
            // Check if the list is empty OR if the list doesn't include current footnote
            // if so, add detail for the current footnote
            if(list === null || !list.includes(footnoteId)) {
                let lastLineIndex = doc.lastLine();
                let lastLine = doc.getLine(lastLineIndex);

                while (lastLineIndex > 0) {
                    lastLine = doc.getLine(lastLineIndex);
                    if (lastLine.length > 0) {
                        doc.replaceRange(
                            "",
                            { line: lastLineIndex, ch: 0 },
                            { line: doc.lastLine(), ch: 0 }
                        );
                        break;
                    }
                    lastLineIndex--;
                }
                
                let footnoteDetail = `\n[^${footnoteId}]: `;
                            
                if (list===null || list.length < 1) {
                    footnoteDetail = "\n" + footnoteDetail;
                    let Heading = addFootnoteSectionHeader(plugin);
                    doc.setLine(doc.lastLine(), lastLine + Heading + footnoteDetail);
                    doc.setCursor(doc.lastLine() - 1, footnoteDetail.length - 1);
                } else {
                    doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
                    doc.setCursor(doc.lastLine(), footnoteDetail.length - 1);
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
    markdownText: string
) {
    //create empty footnote marker for name input
    let emptyMarker = `[^]`;
    doc.replaceRange(emptyMarker,doc.getCursor());
    //move cursor in between [^ and ]
    doc.setCursor(cursorPosition.line, cursorPosition.ch+2);
    //open footnotePicker popup
    
}