import { Editor, EditorPosition, MarkdownView, Plugin } from "obsidian";

export default class ObsidianFootnotes extends Plugin {
  private detailLineRegex = /\[\^(\d+)\]\:/;
  private reOnlyMarkers = /\[\^(\d+)\]/gi;
  private numericalRe = /(\d+)/;

  async onload() {
    this.addCommand({
      id: "insert-footnote",
      name: "Insert and Navigate Footnote",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        this.insertFootnote();
      },
    });
  }

  insertFootnote() {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView) return false;
    if (mdView.editor == undefined) return false;

    const doc = mdView.editor;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;

    if (this.shouldJumpFromDetailToMarker(lineText, cursorPosition, doc))
      return;
    if (this.shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc))
      return;

    return this.shouldCreateNewFootnote(
      lineText,
      cursorPosition,
      doc,
      markdownText
    );
  }

  private shouldJumpFromDetailToMarker(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor
  ) {
    // check if we're in a footnote detail line ("[^1]: footnote")
    // if so, jump cursor back to the footnote in the text
    // https://github.com/akaalias/obsidian-footnotes#improved-quick-navigation
    let match = lineText.match(this.detailLineRegex);
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

  private shouldJumpFromMarkerToDetail(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor
  ) {
    // Jump cursor TO detail marker
    // check if the cursor is inside or left or right of a footnote in a line
    // if so, jump cursor to the footnote detail line
    // https://github.com/akaalias/obsidian-footnotes#improved-quick-navigation

    // does this line have a footnote marker?
    // does the cursor overlap with one of them?
    // if so, which one?
    // find this footnote marker's detail line
    // place cursor there
    let reOnlyMarkersMatches = lineText.match(this.reOnlyMarkers);

    let markerTarget = null;

    if (reOnlyMarkersMatches) {
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
      // extract index
      let match = markerTarget.match(this.numericalRe);
      if (match) {
        let indexString = match[0];
        let markerIndex = Number(indexString);

        // find the first line with this detail marker index in it.
        for (let i = 0; i < doc.lineCount(); i++) {
          let theLine = doc.getLine(i);
          let lineMatch = theLine.match(this.detailLineRegex);
          if (lineMatch) {
            // compare to the index
            let indexMatch = lineMatch[1];
            let indexMatchNumber = Number(indexMatch);
            if (indexMatchNumber == markerIndex) {
              doc.setCursor({ line: i, ch: lineMatch[0].length + 1 });
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private shouldCreateNewFootnote(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    markdownText: string
  ) {
    // create new footnote with the next numerical index
    let matches = markdownText.match(this.reOnlyMarkers);
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

    if (currentMax == 1) {
      footnoteDetail = "\n" + footnoteDetail;
    }

    doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
    doc.setCursor(doc.lastLine(), footnoteDetail.length - 1);
  }
}
