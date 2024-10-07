'use strict';

var obsidian = require('obsidian');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const DEFAULT_SETTINGS = {
    enableAutoSuggest: true,
    // enableFootnoteSectionDivider: false,
    // FootnoteSectionHeadingStyle: "# Footnotes",
    enableFootnoteSectionHeading: false,
    FootnoteSectionHeading: "# Footnotes",
};
class FootnotePluginSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", {
            text: "Footnote Shortcut",
        });
        const mainDesc = containerEl.createEl('p');
        mainDesc.appendText('Need help? Check the ');
        mainDesc.appendChild(createEl('a', {
            text: "README",
            href: "https://github.com/MichaBrugger/obsidian-footnotes",
        }));
        mainDesc.appendText('!');
        containerEl.createEl('br');
        new obsidian.Setting(containerEl)
            .setName("Enable Footnote Autosuggest")
            .setDesc("Suggests existing footnotes when entering named footnotes.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enableAutoSuggest)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enableAutoSuggest = value;
            yield this.plugin.saveSettings();
        })));
        containerEl.createEl("h3", {
            text: "Footnotes Section Behavior",
        });
        new obsidian.Setting(containerEl)
            .setName("Enable Footnote Section Heading")
            .setDesc("Automatically adds a heading separating footnotes at the bottom of the note from the rest of the text.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enableFootnoteSectionHeading)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enableFootnoteSectionHeading = value;
            yield this.plugin.saveSettings();
        })));
        // new Setting(containerEl)
        // .setName("Footnote Section Divider")
        // .setDesc("Add a horizontal line above the footnotes section for more visual separation.")
        // .addToggle((toggle) =>
        // 	toggle
        // 		.setValue(this.plugin.settings.enableFootnoteSectionDivider)
        // 		.onChange(async (value) => {
        // 			this.plugin.settings.enableFootnoteSectionDivider = value;
        // 			await this.plugin.saveSettings();
        // 		})
        // );
        // new Setting(containerEl)
        // .setName("Footnote Section Heading Style")
        // .setDesc("The style of the footnote section header. Accepts Markdown formatting.")
        // .addText((text) =>
        // 	text
        // 		.setPlaceholder("# Footnotes")
        // 		.setValue(this.plugin.settings.FootnoteSectionHeadingStyle)
        // )
        // const footnoteSectionHeadingDescription = (): HTMLElement => {
        // 	const fshDiv = containerEl.createDiv();
        // 	const 
        // }
        new obsidian.Setting(containerEl)
            .setName("Footnote Section Heading")
            .setDesc("Heading to place above footnotes section. Accepts standard Markdown formatting.")
            .addTextArea((text) => text
            .setPlaceholder("Heading is Empty")
            .setValue(this.plugin.settings.FootnoteSectionHeading)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.FootnoteSectionHeading = value;
            // console.log(`obsidian-footnotes: ${value ? "enabling" : "disabling"} automatic footnote section heading creation`);
            yield this.plugin.saveSettings();
        }))
            .then((text) => {
            // text.inputEl.style.justifyContent = 'flex-start';
            text.inputEl.style.width = '100%';
            text.inputEl.rows = 6;
            text.inputEl.style.resize = 'none';
            text.inputEl.style.fontFamily = 'monospace';
        }))
            .then((setting) => {
            setting.settingEl.style.display = 'block';
            if (this.plugin.settings.enableFootnoteSectionHeading == false) {
                setting.settingEl.style.fill = 'black';
                setting.settingEl.style.fillOpacity = '0%';
            }
        });
    }
}

var AllMarkers = /\[\^([^\[\]]+)\](?!:)/dg;
var AllNumberedMarkers = /\[\^(\d+)\]/gi;
var AllDetailsNameOnly = /\[\^([^\[\]]+)\]:/g;
var DetailInLine = /\[\^([^\[\]]+)\]:/;
var ExtractNameFromFootnote = /(\[\^)([^\[\]]+)(?=\])/;
function listExistingFootnoteDetails(doc) {
    let FootnoteDetailList = [];
    //search each line for footnote details and add to list
    for (let i = 0; i < doc.lineCount(); i++) {
        let theLine = doc.getLine(i);
        let lineMatch = theLine.match(AllDetailsNameOnly);
        if (lineMatch) {
            let temp = lineMatch[0];
            temp = temp.replace("[^", "");
            temp = temp.replace("]:", "");
            FootnoteDetailList.push(temp);
        }
    }
    if (FootnoteDetailList.length > 0) {
        return FootnoteDetailList;
    }
    else {
        return null;
    }
}
function listExistingFootnoteMarkersAndLocations(doc) {
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
            };
            FootnoteMarkerInfo.push(markerEntry);
        }
    }
    return FootnoteMarkerInfo;
}
function shouldJumpFromDetailToMarker(lineText, cursorPosition, doc) {
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
function shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc) {
    // Jump cursor TO detail marker
    // does this line have a footnote marker?
    // does the cursor overlap with one of them?
    // if so, which one?
    // find this footnote marker's detail line
    // place cursor there
    let markerTarget = null;
    let FootnoteMarkerInfo = listExistingFootnoteMarkersAndLocations(doc);
    let currentLine = cursorPosition.line;
    let footnotesOnLine = FootnoteMarkerInfo.filter((markerEntry) => markerEntry.lineNum === currentLine);
    if (footnotesOnLine != null) {
        for (let i = 0; i <= footnotesOnLine.length - 1; i++) {
            if (footnotesOnLine[i].footnote !== null) {
                let marker = footnotesOnLine[i].footnote;
                let indexOfMarkerInLine = footnotesOnLine[i].startIndex;
                if (cursorPosition.ch >= indexOfMarkerInLine &&
                    cursorPosition.ch <= indexOfMarkerInLine + marker.length) {
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
function addFootnoteSectionHeader(plugin) {
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
function insertAutonumFootnote(plugin) {
    const mdView = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!mdView)
        return false;
    if (mdView.editor == undefined)
        return false;
    const doc = mdView.editor;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;
    if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc))
        return;
    if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc))
        return;
    return shouldCreateAutonumFootnote(lineText, cursorPosition, plugin, doc, markdownText);
}
function shouldCreateAutonumFootnote(lineText, cursorPosition, plugin, doc, markdownText) {
    // create new footnote with the next numerical index
    let matches = markdownText.match(AllNumberedMarkers);
    let currentMax = 1;
    if (matches != null) {
        for (let i = 0; i <= matches.length - 1; i++) {
            let match = matches[i];
            match = match.replace("[^", "");
            match = match.replace("]", "");
            let matchNumber = Number(match);
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
    doc.replaceRange(newLine, { line: cursorPosition.line, ch: 0 }, { line: cursorPosition.line, ch: lineText.length });
    let lastLineIndex = doc.lastLine();
    let lastLine = doc.getLine(lastLineIndex);
    while (lastLineIndex > 0) {
        lastLine = doc.getLine(lastLineIndex);
        if (lastLine.length > 0) {
            doc.replaceRange("", { line: lastLineIndex, ch: 0 }, { line: doc.lastLine(), ch: 0 });
            break;
        }
        lastLineIndex--;
    }
    let footnoteDetail = `\n[^${footNoteId}]: `;
    let list = listExistingFootnoteDetails(doc);
    if (list === null && currentMax == 1) {
        footnoteDetail = "\n" + footnoteDetail;
        let Heading = addFootnoteSectionHeader(plugin);
        doc.setLine(doc.lastLine(), lastLine + Heading + footnoteDetail);
        doc.setCursor(doc.lastLine() - 1, footnoteDetail.length - 1);
    }
    else {
        doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
        doc.setCursor(doc.lastLine(), footnoteDetail.length - 1);
    }
}
//FUNCTIONS FOR NAMED FOOTNOTES
function insertNamedFootnote(plugin) {
    const mdView = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!mdView)
        return false;
    if (mdView.editor == undefined)
        return false;
    const doc = mdView.editor;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    mdView.data;
    if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc))
        return;
    if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc))
        return;
    if (shouldCreateMatchingFootnoteDetail(lineText, cursorPosition, plugin, doc))
        return;
    return shouldCreateFootnoteMarker(lineText, cursorPosition, doc);
}
function shouldCreateMatchingFootnoteDetail(lineText, cursorPosition, plugin, doc) {
    // Create matching footnote detail for footnote marker
    // does this line have a footnote marker?
    // does the cursor overlap with one of them?
    // if so, which one?
    // does this footnote marker have a detail line?
    // if not, create it and place cursor there
    let reOnlyMarkersMatches = lineText.match(AllMarkers);
    let markerTarget = null;
    if (reOnlyMarkersMatches) {
        for (let i = 0; i <= reOnlyMarkersMatches.length; i++) {
            let marker = reOnlyMarkersMatches[i];
            if (marker != undefined) {
                let indexOfMarkerInLine = lineText.indexOf(marker);
                if (cursorPosition.ch >= indexOfMarkerInLine &&
                    cursorPosition.ch <= indexOfMarkerInLine + marker.length) {
                    markerTarget = marker;
                    break;
                }
            }
        }
    }
    if (markerTarget != null) {
        //extract footnote
        let match = markerTarget.match(ExtractNameFromFootnote);
        //find if this footnote exists by listing existing footnote details
        if (match) {
            let footnoteId = match[2];
            let list = listExistingFootnoteDetails(doc);
            // Check if the list is empty OR if the list doesn't include current footnote
            // if so, add detail for the current footnote
            if (list === null || !list.includes(footnoteId)) {
                let lastLineIndex = doc.lastLine();
                let lastLine = doc.getLine(lastLineIndex);
                while (lastLineIndex > 0) {
                    lastLine = doc.getLine(lastLineIndex);
                    if (lastLine.length > 0) {
                        doc.replaceRange("", { line: lastLineIndex, ch: 0 }, { line: doc.lastLine(), ch: 0 });
                        break;
                    }
                    lastLineIndex--;
                }
                let footnoteDetail = `\n[^${footnoteId}]: `;
                if (list === null || list.length < 1) {
                    footnoteDetail = "\n" + footnoteDetail;
                    let Heading = addFootnoteSectionHeader(plugin);
                    doc.setLine(doc.lastLine(), lastLine + Heading + footnoteDetail);
                    doc.setCursor(doc.lastLine() - 1, footnoteDetail.length - 1);
                }
                else {
                    doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
                    doc.setCursor(doc.lastLine(), footnoteDetail.length - 1);
                }
                return true;
            }
            return;
        }
    }
}
function shouldCreateFootnoteMarker(lineText, cursorPosition, doc, markdownText) {
    //create empty footnote marker for name input
    let emptyMarker = `[^]`;
    doc.replaceRange(emptyMarker, doc.getCursor());
    //move cursor in between [^ and ]
    doc.setCursor(cursorPosition.line, cursorPosition.ch + 2);
    //open footnotePicker popup
}

class Autocomplete extends obsidian.EditorSuggest {
    constructor(plugin) {
        super(plugin.app);
        this.Footnote_Detail_Names_And_Text = /\[\^([^\[\]]+)\]:(.+(?:\n(?:(?!\[\^[^\[\]]+\]:).)+)*)/g;
        this.getSuggestions = (context) => {
            const { query } = context;
            const mdView = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            const doc = mdView.editor;
            const matches = this.Extract_Footnote_Detail_Names_And_Text(doc);
            const filteredResults = matches.filter((entry) => entry[1].includes(query));
            return filteredResults;
        };
        this.plugin = plugin;
    }
    onTrigger(cursorPosition, doc, file) {
        if (this.plugin.settings.enableAutoSuggest) {
            const mdView = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            const lineText = doc.getLine(cursorPosition.line);
            mdView.data;
            let reOnlyMarkersMatches = lineText.match(AllMarkers);
            let markerTarget = null;
            let indexOfMarkerInLine = null;
            if (reOnlyMarkersMatches) {
                for (let i = 0; i <= reOnlyMarkersMatches.length; i++) {
                    let marker = reOnlyMarkersMatches[i];
                    if (marker != undefined) {
                        indexOfMarkerInLine = lineText.indexOf(marker);
                        if (cursorPosition.ch >= indexOfMarkerInLine &&
                            cursorPosition.ch <= indexOfMarkerInLine + marker.length) {
                            markerTarget = marker;
                            break;
                        }
                    }
                }
            }
            if (markerTarget != null) {
                //extract footnote
                let match = markerTarget.match(ExtractNameFromFootnote);
                //find if this footnote exists by listing existing footnote details
                if (match) {
                    let footnoteId = match[2];
                    if (footnoteId !== undefined) {
                        this.latestTriggerInfo = {
                            end: cursorPosition,
                            start: {
                                ch: indexOfMarkerInLine + 2,
                                line: cursorPosition.line
                            },
                            query: footnoteId
                        };
                        return this.latestTriggerInfo;
                    }
                }
            }
            return null;
        }
    }
    Extract_Footnote_Detail_Names_And_Text(doc) {
        //search each line for footnote details and add to list
        //save the footnote detail name as capture group 1
        //save the footnote detail text as capture group 2
        let docText = doc.getValue();
        const matches = Array.from(docText.matchAll(this.Footnote_Detail_Names_And_Text));
        return matches;
    }
    renderSuggestion(value, el) {
        el.createEl("b", { text: value[1] });
        el.createEl("br");
        el.createEl("p", { text: value[2] });
    }
    selectSuggestion(value, evt) {
        const { context, plugin } = this;
        if (!context)
            return;
        const mdView = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        mdView.editor;
        const field = value[1];
        const replacement = `${field}`;
        context.editor.replaceRange(replacement, this.latestTriggerInfo.start, this.latestTriggerInfo.end);
    }
}

//Add chevron-up-square icon from lucide for mobile toolbar (temporary until Obsidian updates to Lucide v0.130.0)
obsidian.addIcon("chevron-up-square", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-square"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><polyline points="8,14 12,10 16,14"></polyline></svg>`);
class FootnotePlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.registerEditorSuggest(new Autocomplete(this));
            this.addCommand({
                id: "insert-autonumbered-footnote",
                name: "Insert / Navigate Auto-Numbered Footnote",
                icon: "plus-square",
                checkCallback: (checking) => {
                    if (checking)
                        return !!this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                    insertAutonumFootnote(this);
                },
            });
            this.addCommand({
                id: "insert-named-footnote",
                name: "Insert / Navigate Named Footnote",
                icon: "chevron-up-square",
                checkCallback: (checking) => {
                    if (checking)
                        return !!this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                    insertNamedFootnote(this);
                }
            });
            this.addSettingTab(new FootnotePluginSettingTab(this.app, this));
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
}

module.exports = FootnotePlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzLnRzIiwic3JjL2F1dG9zdWdnZXN0LnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlLCBTdXBwcmVzc2VkRXJyb3IsIFN5bWJvbCwgSXRlcmF0b3IgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXNEZWNvcmF0ZShjdG9yLCBkZXNjcmlwdG9ySW4sIGRlY29yYXRvcnMsIGNvbnRleHRJbiwgaW5pdGlhbGl6ZXJzLCBleHRyYUluaXRpYWxpemVycykge1xyXG4gICAgZnVuY3Rpb24gYWNjZXB0KGYpIHsgaWYgKGYgIT09IHZvaWQgMCAmJiB0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRnVuY3Rpb24gZXhwZWN0ZWRcIik7IHJldHVybiBmOyB9XHJcbiAgICB2YXIga2luZCA9IGNvbnRleHRJbi5raW5kLCBrZXkgPSBraW5kID09PSBcImdldHRlclwiID8gXCJnZXRcIiA6IGtpbmQgPT09IFwic2V0dGVyXCIgPyBcInNldFwiIDogXCJ2YWx1ZVwiO1xyXG4gICAgdmFyIHRhcmdldCA9ICFkZXNjcmlwdG9ySW4gJiYgY3RvciA/IGNvbnRleHRJbltcInN0YXRpY1wiXSA/IGN0b3IgOiBjdG9yLnByb3RvdHlwZSA6IG51bGw7XHJcbiAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JJbiB8fCAodGFyZ2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGNvbnRleHRJbi5uYW1lKSA6IHt9KTtcclxuICAgIHZhciBfLCBkb25lID0gZmFsc2U7XHJcbiAgICBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4pIGNvbnRleHRbcF0gPSBwID09PSBcImFjY2Vzc1wiID8ge30gOiBjb250ZXh0SW5bcF07XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4uYWNjZXNzKSBjb250ZXh0LmFjY2Vzc1twXSA9IGNvbnRleHRJbi5hY2Nlc3NbcF07XHJcbiAgICAgICAgY29udGV4dC5hZGRJbml0aWFsaXplciA9IGZ1bmN0aW9uIChmKSB7IGlmIChkb25lKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFkZCBpbml0aWFsaXplcnMgYWZ0ZXIgZGVjb3JhdGlvbiBoYXMgY29tcGxldGVkXCIpOyBleHRyYUluaXRpYWxpemVycy5wdXNoKGFjY2VwdChmIHx8IG51bGwpKTsgfTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gKDAsIGRlY29yYXRvcnNbaV0pKGtpbmQgPT09IFwiYWNjZXNzb3JcIiA/IHsgZ2V0OiBkZXNjcmlwdG9yLmdldCwgc2V0OiBkZXNjcmlwdG9yLnNldCB9IDogZGVzY3JpcHRvcltrZXldLCBjb250ZXh0KTtcclxuICAgICAgICBpZiAoa2luZCA9PT0gXCJhY2Nlc3NvclwiKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHZvaWQgMCkgY29udGludWU7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZFwiKTtcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmdldCkpIGRlc2NyaXB0b3IuZ2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LnNldCkpIGRlc2NyaXB0b3Iuc2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmluaXQpKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoXyA9IGFjY2VwdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIGlmIChraW5kID09PSBcImZpZWxkXCIpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgICAgICBlbHNlIGRlc2NyaXB0b3Jba2V5XSA9IF87XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRhcmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgY29udGV4dEluLm5hbWUsIGRlc2NyaXB0b3IpO1xyXG4gICAgZG9uZSA9IHRydWU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19ydW5Jbml0aWFsaXplcnModGhpc0FyZywgaW5pdGlhbGl6ZXJzLCB2YWx1ZSkge1xyXG4gICAgdmFyIHVzZVZhbHVlID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRpYWxpemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhbHVlID0gdXNlVmFsdWUgPyBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnLCB2YWx1ZSkgOiBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1c2VWYWx1ZSA/IHZhbHVlIDogdm9pZCAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcHJvcEtleSh4KSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwic3ltYm9sXCIgPyB4IDogXCJcIi5jb25jYXQoeCk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zZXRGdW5jdGlvbk5hbWUoZiwgbmFtZSwgcHJlZml4KSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3ltYm9sXCIpIG5hbWUgPSBuYW1lLmRlc2NyaXB0aW9uID8gXCJbXCIuY29uY2F0KG5hbWUuZGVzY3JpcHRpb24sIFwiXVwiKSA6IFwiXCI7XHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGYsIFwibmFtZVwiLCB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHByZWZpeCA/IFwiXCIuY29uY2F0KHByZWZpeCwgXCIgXCIsIG5hbWUpIDogbmFtZSB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGcgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEl0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpO1xyXG4gICAgcmV0dXJuIGcubmV4dCA9IHZlcmIoMCksIGdbXCJ0aHJvd1wiXSA9IHZlcmIoMSksIGdbXCJyZXR1cm5cIl0gPSB2ZXJiKDIpLCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBBc3luY0l0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBBc3luY0l0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpLCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIsIGF3YWl0UmV0dXJuKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gYXdhaXRSZXR1cm4oZikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGYsIHJlamVjdCk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpZiAoZ1tuXSkgeyBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyBpZiAoZikgaVtuXSA9IGYoaVtuXSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IGZhbHNlIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrIGluIG1vZCkgaWYgKGsgIT09IFwiZGVmYXVsdFwiICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtb2QsIGspKSBfX2NyZWF0ZUJpbmRpbmcocmVzdWx0LCBtb2QsIGspO1xyXG4gICAgX19zZXRNb2R1bGVEZWZhdWx0KHJlc3VsdCwgbW9kKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydERlZmF1bHQobW9kKSB7XHJcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IGRlZmF1bHQ6IG1vZCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEdldChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRTZXQocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEluKHN0YXRlLCByZWNlaXZlcikge1xyXG4gICAgaWYgKHJlY2VpdmVyID09PSBudWxsIHx8ICh0eXBlb2YgcmVjZWl2ZXIgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHJlY2VpdmVyICE9PSBcImZ1bmN0aW9uXCIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHVzZSAnaW4nIG9wZXJhdG9yIG9uIG5vbi1vYmplY3RcIik7XHJcbiAgICByZXR1cm4gdHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciA9PT0gc3RhdGUgOiBzdGF0ZS5oYXMocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hZGREaXNwb3NhYmxlUmVzb3VyY2UoZW52LCB2YWx1ZSwgYXN5bmMpIHtcclxuICAgIGlmICh2YWx1ZSAhPT0gbnVsbCAmJiB2YWx1ZSAhPT0gdm9pZCAwKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdmFsdWUgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZC5cIik7XHJcbiAgICAgICAgdmFyIGRpc3Bvc2UsIGlubmVyO1xyXG4gICAgICAgIGlmIChhc3luYykge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5hc3luY0Rpc3Bvc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNEaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5hc3luY0Rpc3Bvc2VdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGlzcG9zZSA9PT0gdm9pZCAwKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmRpc3Bvc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuZGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuZGlzcG9zZV07XHJcbiAgICAgICAgICAgIGlmIChhc3luYykgaW5uZXIgPSBkaXNwb3NlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIGRpc3Bvc2UgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBub3QgZGlzcG9zYWJsZS5cIik7XHJcbiAgICAgICAgaWYgKGlubmVyKSBkaXNwb3NlID0gZnVuY3Rpb24oKSB7IHRyeSB7IGlubmVyLmNhbGwodGhpcyk7IH0gY2F0Y2ggKGUpIHsgcmV0dXJuIFByb21pc2UucmVqZWN0KGUpOyB9IH07XHJcbiAgICAgICAgZW52LnN0YWNrLnB1c2goeyB2YWx1ZTogdmFsdWUsIGRpc3Bvc2U6IGRpc3Bvc2UsIGFzeW5jOiBhc3luYyB9KTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgZW52LnN0YWNrLnB1c2goeyBhc3luYzogdHJ1ZSB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiB2YWx1ZTtcclxuXHJcbn1cclxuXHJcbnZhciBfU3VwcHJlc3NlZEVycm9yID0gdHlwZW9mIFN1cHByZXNzZWRFcnJvciA9PT0gXCJmdW5jdGlvblwiID8gU3VwcHJlc3NlZEVycm9yIDogZnVuY3Rpb24gKGVycm9yLCBzdXBwcmVzc2VkLCBtZXNzYWdlKSB7XHJcbiAgICB2YXIgZSA9IG5ldyBFcnJvcihtZXNzYWdlKTtcclxuICAgIHJldHVybiBlLm5hbWUgPSBcIlN1cHByZXNzZWRFcnJvclwiLCBlLmVycm9yID0gZXJyb3IsIGUuc3VwcHJlc3NlZCA9IHN1cHByZXNzZWQsIGU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kaXNwb3NlUmVzb3VyY2VzKGVudikge1xyXG4gICAgZnVuY3Rpb24gZmFpbChlKSB7XHJcbiAgICAgICAgZW52LmVycm9yID0gZW52Lmhhc0Vycm9yID8gbmV3IF9TdXBwcmVzc2VkRXJyb3IoZSwgZW52LmVycm9yLCBcIkFuIGVycm9yIHdhcyBzdXBwcmVzc2VkIGR1cmluZyBkaXNwb3NhbC5cIikgOiBlO1xyXG4gICAgICAgIGVudi5oYXNFcnJvciA9IHRydWU7XHJcbiAgICB9XHJcbiAgICB2YXIgciwgcyA9IDA7XHJcbiAgICBmdW5jdGlvbiBuZXh0KCkge1xyXG4gICAgICAgIHdoaWxlIChyID0gZW52LnN0YWNrLnBvcCgpKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXIuYXN5bmMgJiYgcyA9PT0gMSkgcmV0dXJuIHMgPSAwLCBlbnYuc3RhY2sucHVzaChyKSwgUHJvbWlzZS5yZXNvbHZlKCkudGhlbihuZXh0KTtcclxuICAgICAgICAgICAgICAgIGlmIChyLmRpc3Bvc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gci5kaXNwb3NlLmNhbGwoci52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHIuYXN5bmMpIHJldHVybiBzIHw9IDIsIFByb21pc2UucmVzb2x2ZShyZXN1bHQpLnRoZW4obmV4dCwgZnVuY3Rpb24oZSkgeyBmYWlsKGUpOyByZXR1cm4gbmV4dCgpOyB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgcyB8PSAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICBmYWlsKGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChzID09PSAxKSByZXR1cm4gZW52Lmhhc0Vycm9yID8gUHJvbWlzZS5yZWplY3QoZW52LmVycm9yKSA6IFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICAgIGlmIChlbnYuaGFzRXJyb3IpIHRocm93IGVudi5lcnJvcjtcclxuICAgIH1cclxuICAgIHJldHVybiBuZXh0KCk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fbWV0YWRhdGE6IF9fbWV0YWRhdGEsXHJcbiAgICBfX2F3YWl0ZXI6IF9fYXdhaXRlcixcclxuICAgIF9fZ2VuZXJhdG9yOiBfX2dlbmVyYXRvcixcclxuICAgIF9fY3JlYXRlQmluZGluZzogX19jcmVhdGVCaW5kaW5nLFxyXG4gICAgX19leHBvcnRTdGFyOiBfX2V4cG9ydFN0YXIsXHJcbiAgICBfX3ZhbHVlczogX192YWx1ZXMsXHJcbiAgICBfX3JlYWQ6IF9fcmVhZCxcclxuICAgIF9fc3ByZWFkOiBfX3NwcmVhZCxcclxuICAgIF9fc3ByZWFkQXJyYXlzOiBfX3NwcmVhZEFycmF5cyxcclxuICAgIF9fc3ByZWFkQXJyYXk6IF9fc3ByZWFkQXJyYXksXHJcbiAgICBfX2F3YWl0OiBfX2F3YWl0LFxyXG4gICAgX19hc3luY0dlbmVyYXRvcjogX19hc3luY0dlbmVyYXRvcixcclxuICAgIF9fYXN5bmNEZWxlZ2F0b3I6IF9fYXN5bmNEZWxlZ2F0b3IsXHJcbiAgICBfX2FzeW5jVmFsdWVzOiBfX2FzeW5jVmFsdWVzLFxyXG4gICAgX19tYWtlVGVtcGxhdGVPYmplY3Q6IF9fbWFrZVRlbXBsYXRlT2JqZWN0LFxyXG4gICAgX19pbXBvcnRTdGFyOiBfX2ltcG9ydFN0YXIsXHJcbiAgICBfX2ltcG9ydERlZmF1bHQ6IF9faW1wb3J0RGVmYXVsdCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRHZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEluOiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4sXHJcbiAgICBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZTogX19hZGREaXNwb3NhYmxlUmVzb3VyY2UsXHJcbiAgICBfX2Rpc3Bvc2VSZXNvdXJjZXM6IF9fZGlzcG9zZVJlc291cmNlcyxcclxufTtcclxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZvb3Rub3RlUGx1Z2luU2V0dGluZ3Mge1xuICAgIGVuYWJsZUF1dG9TdWdnZXN0OiBib29sZWFuO1xuXG5cdC8vIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkRpdmlkZXI6IGJvb2xlYW47XG5cdC8vIEZvb3Rub3RlU2VjdGlvbkhlYWRpbmdTdHlsZTogc3RyaW5nO1xuICAgIFxuICAgIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IGJvb2xlYW47XG4gICAgRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogRm9vdG5vdGVQbHVnaW5TZXR0aW5ncyA9IHtcbiAgICBlbmFibGVBdXRvU3VnZ2VzdDogdHJ1ZSxcblxuXHQvLyBlbmFibGVGb290bm90ZVNlY3Rpb25EaXZpZGVyOiBmYWxzZSxcblx0Ly8gRm9vdG5vdGVTZWN0aW9uSGVhZGluZ1N0eWxlOiBcIiMgRm9vdG5vdGVzXCIsXG5cdFxuICAgIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IGZhbHNlLFxuICAgIEZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IFwiIyBGb290bm90ZXNcIixcbn07XG5cbmV4cG9ydCBjbGFzcyBGb290bm90ZVBsdWdpblNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luO1xuXG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4pIHtcbiAgICAgICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB9XG5cbiAgICBkaXNwbGF5KCk6IHZvaWQge1xuICAgICAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcbiAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcblxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcbiAgICAgICAgdGV4dDogXCJGb290bm90ZSBTaG9ydGN1dFwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBtYWluRGVzYyA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdwJyk7XG5cbiAgICAgICAgICAgIG1haW5EZXNjLmFwcGVuZFRleHQoJ05lZWQgaGVscD8gQ2hlY2sgdGhlICcpO1xuICAgICAgICAgICAgbWFpbkRlc2MuYXBwZW5kQ2hpbGQoXG4gICAgICAgICAgICAgICAgY3JlYXRlRWwoJ2EnLCB7XG4gICAgICAgICAgICAgICAgdGV4dDogXCJSRUFETUVcIixcbiAgICAgICAgICAgICAgICBocmVmOiBcImh0dHBzOi8vZ2l0aHViLmNvbS9NaWNoYUJydWdnZXIvb2JzaWRpYW4tZm9vdG5vdGVzXCIsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBtYWluRGVzYy5hcHBlbmRUZXh0KCchJyk7XG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdicicpO1xuICAgICAgICBcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgIC5zZXROYW1lKFwiRW5hYmxlIEZvb3Rub3RlIEF1dG9zdWdnZXN0XCIpXG4gICAgICAgIC5zZXREZXNjKFwiU3VnZ2VzdHMgZXhpc3RpbmcgZm9vdG5vdGVzIHdoZW4gZW50ZXJpbmcgbmFtZWQgZm9vdG5vdGVzLlwiKVxuICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGVcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlQXV0b1N1Z2dlc3QpXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVBdXRvU3VnZ2VzdCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgICAgICAgdGV4dDogXCJGb290bm90ZXMgU2VjdGlvbiBCZWhhdmlvclwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgLnNldE5hbWUoXCJFbmFibGUgRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nXCIpXG4gICAgICAgIC5zZXREZXNjKFwiQXV0b21hdGljYWxseSBhZGRzIGEgaGVhZGluZyBzZXBhcmF0aW5nIGZvb3Rub3RlcyBhdCB0aGUgYm90dG9tIG9mIHRoZSBub3RlIGZyb20gdGhlIHJlc3Qgb2YgdGhlIHRleHQuXCIpXG4gICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgIHRvZ2dsZVxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nKVxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICApO1xuXG5cdFx0Ly8gbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0Ly8gLnNldE5hbWUoXCJGb290bm90ZSBTZWN0aW9uIERpdmlkZXJcIilcblx0XHQvLyAuc2V0RGVzYyhcIkFkZCBhIGhvcml6b250YWwgbGluZSBhYm92ZSB0aGUgZm9vdG5vdGVzIHNlY3Rpb24gZm9yIG1vcmUgdmlzdWFsIHNlcGFyYXRpb24uXCIpXG5cdFx0Ly8gLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuXHRcdC8vIFx0dG9nZ2xlXG5cdFx0Ly8gXHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25EaXZpZGVyKVxuXHRcdC8vIFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0Ly8gXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uRGl2aWRlciA9IHZhbHVlO1xuXHRcdC8vIFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdC8vIFx0XHR9KVxuXHRcdC8vICk7XG5cblx0XHQvLyBuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHQvLyAuc2V0TmFtZShcIkZvb3Rub3RlIFNlY3Rpb24gSGVhZGluZyBTdHlsZVwiKVxuXHRcdC8vIC5zZXREZXNjKFwiVGhlIHN0eWxlIG9mIHRoZSBmb290bm90ZSBzZWN0aW9uIGhlYWRlci4gQWNjZXB0cyBNYXJrZG93biBmb3JtYXR0aW5nLlwiKVxuXHRcdC8vIC5hZGRUZXh0KCh0ZXh0KSA9PlxuXHRcdC8vIFx0dGV4dFxuXHRcdC8vIFx0XHQuc2V0UGxhY2Vob2xkZXIoXCIjIEZvb3Rub3Rlc1wiKVxuXHRcdC8vIFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZ1N0eWxlKVxuXHRcdC8vIClcblxuXHRcdC8vIGNvbnN0IGZvb3Rub3RlU2VjdGlvbkhlYWRpbmdEZXNjcmlwdGlvbiA9ICgpOiBIVE1MRWxlbWVudCA9PiB7XG5cdFx0Ly8gXHRjb25zdCBmc2hEaXYgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoKTtcblx0XHQvLyBcdGNvbnN0IFxuXHRcdFx0XG5cdFx0Ly8gfVxuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAuc2V0TmFtZShcIkZvb3Rub3RlIFNlY3Rpb24gSGVhZGluZ1wiKVxuICAgICAgICAuc2V0RGVzYyhcIkhlYWRpbmcgdG8gcGxhY2UgYWJvdmUgZm9vdG5vdGVzIHNlY3Rpb24uIEFjY2VwdHMgc3RhbmRhcmQgTWFya2Rvd24gZm9ybWF0dGluZy5cIilcbiAgICAgICAgLmFkZFRleHRBcmVhKCh0ZXh0KSA9PlxuICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIkhlYWRpbmcgaXMgRW1wdHlcIilcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZylcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9IHZhbHVlO1xuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKGBvYnNpZGlhbi1mb290bm90ZXM6ICR7dmFsdWUgPyBcImVuYWJsaW5nXCIgOiBcImRpc2FibGluZ1wifSBhdXRvbWF0aWMgZm9vdG5vdGUgc2VjdGlvbiBoZWFkaW5nIGNyZWF0aW9uYCk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR9KVxuXHRcdFx0XHQudGhlbigodGV4dCkgPT4ge1xuXHRcdFx0XHRcdC8vIHRleHQuaW5wdXRFbC5zdHlsZS5qdXN0aWZ5Q29udGVudCA9ICdmbGV4LXN0YXJ0Jztcblx0XHRcdFx0XHR0ZXh0LmlucHV0RWwuc3R5bGUud2lkdGggPSAnMTAwJSc7XG5cdFx0XHRcdFx0dGV4dC5pbnB1dEVsLnJvd3MgPSA2O1xuXHRcdFx0XHRcdHRleHQuaW5wdXRFbC5zdHlsZS5yZXNpemUgPSAnbm9uZSc7XG5cdFx0XHRcdFx0dGV4dC5pbnB1dEVsLnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcblx0XHRcdFx0fVxuXHRcdFx0KSlcblx0XHRcdC50aGVuKChzZXR0aW5nKSA9PiB7XG5cdFx0XHRcdHNldHRpbmcuc2V0dGluZ0VsLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9PSBmYWxzZSkge1xuXHRcdFx0XHRcdHNldHRpbmcuc2V0dGluZ0VsLnN0eWxlLmZpbGwgPSAnYmxhY2snO1xuXHRcdFx0XHRcdHNldHRpbmcuc2V0dGluZ0VsLnN0eWxlLmZpbGxPcGFjaXR5ID0gJzAlJztcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHRcdFxuICAgIH1cbn0iLCJpbXBvcnQgeyBcbiAgICBFZGl0b3IsIFxuICAgIEVkaXRvclBvc2l0aW9uLCBcbiAgICBNYXJrZG93blZpZXdcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCBGb290bm90ZVBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5cbmV4cG9ydCB2YXIgQWxsTWFya2VycyA9IC9cXFtcXF4oW15cXFtcXF1dKylcXF0oPyE6KS9kZztcbnZhciBBbGxOdW1iZXJlZE1hcmtlcnMgPSAvXFxbXFxeKFxcZCspXFxdL2dpO1xudmFyIEFsbERldGFpbHNOYW1lT25seSA9IC9cXFtcXF4oW15cXFtcXF1dKylcXF06L2c7XG52YXIgRGV0YWlsSW5MaW5lID0gL1xcW1xcXihbXlxcW1xcXV0rKVxcXTovO1xuZXhwb3J0IHZhciBFeHRyYWN0TmFtZUZyb21Gb290bm90ZSA9IC8oXFxbXFxeKShbXlxcW1xcXV0rKSg/PVxcXSkvO1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoXG4gICAgZG9jOiBFZGl0b3Jcbikge1xuICAgIGxldCBGb290bm90ZURldGFpbExpc3Q6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgLy9zZWFyY2ggZWFjaCBsaW5lIGZvciBmb290bm90ZSBkZXRhaWxzIGFuZCBhZGQgdG8gbGlzdFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcbiAgICAgICAgbGV0IHRoZUxpbmUgPSBkb2MuZ2V0TGluZShpKTtcbiAgICAgICAgbGV0IGxpbmVNYXRjaCA9IHRoZUxpbmUubWF0Y2goQWxsRGV0YWlsc05hbWVPbmx5KTtcbiAgICAgICAgaWYgKGxpbmVNYXRjaCkge1xuICAgICAgICAgICAgbGV0IHRlbXAgPSBsaW5lTWF0Y2hbMF07XG4gICAgICAgICAgICB0ZW1wID0gdGVtcC5yZXBsYWNlKFwiW15cIixcIlwiKTtcbiAgICAgICAgICAgIHRlbXAgPSB0ZW1wLnJlcGxhY2UoXCJdOlwiLFwiXCIpO1xuXG4gICAgICAgICAgICBGb290bm90ZURldGFpbExpc3QucHVzaCh0ZW1wKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoRm9vdG5vdGVEZXRhaWxMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmV0dXJuIEZvb3Rub3RlRGV0YWlsTGlzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0RXhpc3RpbmdGb290bm90ZU1hcmtlcnNBbmRMb2NhdGlvbnMoXG4gICAgZG9jOiBFZGl0b3Jcbikge1xuICAgIHR5cGUgbWFya2VyRW50cnkgPSB7XG4gICAgICAgIGZvb3Rub3RlOiBzdHJpbmc7XG4gICAgICAgIGxpbmVOdW06IG51bWJlcjtcbiAgICAgICAgc3RhcnRJbmRleDogbnVtYmVyO1xuICAgIH1cbiAgICBsZXQgbWFya2VyRW50cnk7XG5cbiAgICBsZXQgRm9vdG5vdGVNYXJrZXJJbmZvID0gW107XG4gICAgLy9zZWFyY2ggZWFjaCBsaW5lIGZvciBmb290bm90ZSBtYXJrZXJzXG4gICAgLy9mb3IgZWFjaCwgYWRkIHRoZWlyIG5hbWUsIGxpbmUgbnVtYmVyLCBhbmQgc3RhcnQgaW5kZXggdG8gRm9vdG5vdGVNYXJrZXJJbmZvXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xuICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xuICAgICAgICBsZXQgbGluZU1hdGNoO1xuXG4gICAgICAgIHdoaWxlICgobGluZU1hdGNoID0gQWxsTWFya2Vycy5leGVjKHRoZUxpbmUpKSAhPSBudWxsKSB7XG4gICAgICAgIG1hcmtlckVudHJ5ID0ge1xuICAgICAgICAgICAgZm9vdG5vdGU6IGxpbmVNYXRjaFswXSxcbiAgICAgICAgICAgIGxpbmVOdW06IGksXG4gICAgICAgICAgICBzdGFydEluZGV4OiBsaW5lTWF0Y2guaW5kZXhcbiAgICAgICAgfVxuICAgICAgICBGb290bm90ZU1hcmtlckluZm8ucHVzaChtYXJrZXJFbnRyeSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIEZvb3Rub3RlTWFya2VySW5mbztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIoXG4gICAgbGluZVRleHQ6IHN0cmluZyxcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXG4gICAgZG9jOiBFZGl0b3Jcbikge1xuICAgIC8vIGNoZWNrIGlmIHdlJ3JlIGluIGEgZm9vdG5vdGUgZGV0YWlsIGxpbmUgKFwiW14xXTogZm9vdG5vdGVcIilcbiAgICAvLyBpZiBzbywganVtcCBjdXJzb3IgYmFjayB0byB0aGUgZm9vdG5vdGUgaW4gdGhlIHRleHRcblxuICAgIGxldCBtYXRjaCA9IGxpbmVUZXh0Lm1hdGNoKERldGFpbEluTGluZSk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGxldCBzID0gbWF0Y2hbMF07XG4gICAgICAgIGxldCBpbmRleCA9IHMucmVwbGFjZShcIlteXCIsIFwiXCIpO1xuICAgICAgICBpbmRleCA9IGluZGV4LnJlcGxhY2UoXCJdOlwiLCBcIlwiKTtcbiAgICAgICAgbGV0IGZvb3Rub3RlID0gcy5yZXBsYWNlKFwiOlwiLCBcIlwiKTtcblxuICAgICAgICBsZXQgcmV0dXJuTGluZUluZGV4ID0gY3Vyc29yUG9zaXRpb24ubGluZTtcbiAgICAgICAgLy8gZmluZCB0aGUgRklSU1QgT0NDVVJFTkNFIHdoZXJlIHRoaXMgZm9vdG5vdGUgZXhpc3RzIGluIHRoZSB0ZXh0XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBzY2FuTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xuICAgICAgICAgICAgaWYgKHNjYW5MaW5lLmNvbnRhaW5zKGZvb3Rub3RlKSkge1xuICAgICAgICAgICAgICAgIGxldCBjdXJzb3JMb2NhdGlvbkluZGV4ID0gc2NhbkxpbmUuaW5kZXhPZihmb290bm90ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuTGluZUluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBkb2Muc2V0Q3Vyc29yKHtcbiAgICAgICAgICAgICAgICBsaW5lOiByZXR1cm5MaW5lSW5kZXgsXG4gICAgICAgICAgICAgICAgY2g6IGN1cnNvckxvY2F0aW9uSW5kZXggKyBmb290bm90ZS5sZW5ndGgsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcbiAgICBkb2M6IEVkaXRvclxuKSB7XG4gICAgLy8gSnVtcCBjdXJzb3IgVE8gZGV0YWlsIG1hcmtlclxuXG4gICAgLy8gZG9lcyB0aGlzIGxpbmUgaGF2ZSBhIGZvb3Rub3RlIG1hcmtlcj9cbiAgICAvLyBkb2VzIHRoZSBjdXJzb3Igb3ZlcmxhcCB3aXRoIG9uZSBvZiB0aGVtP1xuICAgIC8vIGlmIHNvLCB3aGljaCBvbmU/XG4gICAgLy8gZmluZCB0aGlzIGZvb3Rub3RlIG1hcmtlcidzIGRldGFpbCBsaW5lXG4gICAgLy8gcGxhY2UgY3Vyc29yIHRoZXJlXG4gICAgbGV0IG1hcmtlclRhcmdldCA9IG51bGw7XG5cbiAgICBsZXQgRm9vdG5vdGVNYXJrZXJJbmZvID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVNYXJrZXJzQW5kTG9jYXRpb25zKGRvYyk7XG4gICAgbGV0IGN1cnJlbnRMaW5lID0gY3Vyc29yUG9zaXRpb24ubGluZTtcbiAgICBsZXQgZm9vdG5vdGVzT25MaW5lID0gRm9vdG5vdGVNYXJrZXJJbmZvLmZpbHRlcigobWFya2VyRW50cnk6IHsgbGluZU51bTogbnVtYmVyOyB9KSA9PiBtYXJrZXJFbnRyeS5saW5lTnVtID09PSBjdXJyZW50TGluZSk7XG5cbiAgICBpZiAoZm9vdG5vdGVzT25MaW5lICE9IG51bGwpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gZm9vdG5vdGVzT25MaW5lLmxlbmd0aC0xOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChmb290bm90ZXNPbkxpbmVbaV0uZm9vdG5vdGUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBsZXQgbWFya2VyID0gZm9vdG5vdGVzT25MaW5lW2ldLmZvb3Rub3RlO1xuICAgICAgICAgICAgICAgIGxldCBpbmRleE9mTWFya2VySW5MaW5lID0gZm9vdG5vdGVzT25MaW5lW2ldLnN0YXJ0SW5kZXg7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoID49IGluZGV4T2ZNYXJrZXJJbkxpbmUgJiZcbiAgICAgICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA8PSBpbmRleE9mTWFya2VySW5MaW5lICsgbWFya2VyLmxlbmd0aFxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIG1hcmtlclRhcmdldCA9IG1hcmtlcjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1hcmtlclRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBleHRyYWN0IG5hbWVcbiAgICAgICAgbGV0IG1hdGNoID0gbWFya2VyVGFyZ2V0Lm1hdGNoKEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlKTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICBsZXQgZm9vdG5vdGVOYW1lID0gbWF0Y2hbMl07XG5cbiAgICAgICAgICAgIC8vIGZpbmQgdGhlIGZpcnN0IGxpbmUgd2l0aCB0aGlzIGRldGFpbCBtYXJrZXIgbmFtZSBpbiBpdC5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xuICAgICAgICAgICAgICAgIGxldCBsaW5lTWF0Y2ggPSB0aGVMaW5lLm1hdGNoKERldGFpbEluTGluZSk7XG4gICAgICAgICAgICAgICAgaWYgKGxpbmVNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb21wYXJlIHRvIHRoZSBpbmRleFxuICAgICAgICAgICAgICAgICAgICBsZXQgbmFtZU1hdGNoID0gbGluZU1hdGNoWzFdO1xuICAgICAgICAgICAgICAgICAgICBpZiAobmFtZU1hdGNoID09IGZvb3Rub3RlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9jLnNldEN1cnNvcih7IGxpbmU6IGksIGNoOiBsaW5lTWF0Y2hbMF0ubGVuZ3RoICsgMSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxuKTogc3RyaW5nIHtcbiAgICAvL2NoZWNrIGlmICdFbmFibGUgRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nJyBpcyB0cnVlXG4gICAgLy9pZiBzbywgcmV0dXJuIHRoZSBcIkZvb3Rub3RlIFNlY3Rpb24gSGVhZGluZ1wiXG4gICAgLy8gZWxzZSwgcmV0dXJuIFwiXCJcblxuICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9PSB0cnVlKSB7XG4gICAgICAgIGxldCByZXR1cm5IZWFkaW5nID0gcGx1Z2luLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmc7XG4gICAgICAgIHJldHVybiByZXR1cm5IZWFkaW5nO1xuICAgIH1cbiAgICByZXR1cm4gXCJcIjtcbn1cblxuXG4vL0ZVTkNUSU9OUyBGT1IgQVVUT05VTUJFUkVEIEZPT1ROT1RFU1xuXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0QXV0b251bUZvb3Rub3RlKHBsdWdpbjogRm9vdG5vdGVQbHVnaW4pIHtcbiAgICBjb25zdCBtZFZpZXcgPSBhcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcblxuICAgIGlmICghbWRWaWV3KSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG1kVmlldy5lZGl0b3IgPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBkb2MgPSBtZFZpZXcuZWRpdG9yO1xuICAgIGNvbnN0IGN1cnNvclBvc2l0aW9uID0gZG9jLmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVUZXh0ID0gZG9jLmdldExpbmUoY3Vyc29yUG9zaXRpb24ubGluZSk7XG4gICAgY29uc3QgbWFya2Rvd25UZXh0ID0gbWRWaWV3LmRhdGE7XG5cbiAgICBpZiAoc2hvdWxkSnVtcEZyb21EZXRhaWxUb01hcmtlcihsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYykpXG4gICAgICAgIHJldHVybjtcbiAgICBpZiAoc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYykpXG4gICAgICAgIHJldHVybjtcblxuICAgIHJldHVybiBzaG91bGRDcmVhdGVBdXRvbnVtRm9vdG5vdGUoXG4gICAgICAgIGxpbmVUZXh0LFxuICAgICAgICBjdXJzb3JQb3NpdGlvbixcbiAgICAgICAgcGx1Z2luLFxuICAgICAgICBkb2MsXG4gICAgICAgIG1hcmtkb3duVGV4dFxuICAgICk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZUF1dG9udW1Gb290bm90ZShcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxuICAgIGRvYzogRWRpdG9yLFxuICAgIG1hcmtkb3duVGV4dDogc3RyaW5nXG4pIHtcbiAgICAvLyBjcmVhdGUgbmV3IGZvb3Rub3RlIHdpdGggdGhlIG5leHQgbnVtZXJpY2FsIGluZGV4XG4gICAgbGV0IG1hdGNoZXMgPSBtYXJrZG93blRleHQubWF0Y2goQWxsTnVtYmVyZWRNYXJrZXJzKTtcbiAgICBsZXQgbnVtYmVyczogQXJyYXk8bnVtYmVyPiA9IFtdO1xuICAgIGxldCBjdXJyZW50TWF4ID0gMTtcblxuICAgIGlmIChtYXRjaGVzICE9IG51bGwpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gbWF0Y2hlcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBtYXRjaCA9IG1hdGNoZXNbaV07XG4gICAgICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoXCJbXlwiLCBcIlwiKTtcbiAgICAgICAgICAgIG1hdGNoID0gbWF0Y2gucmVwbGFjZShcIl1cIiwgXCJcIik7XG4gICAgICAgICAgICBsZXQgbWF0Y2hOdW1iZXIgPSBOdW1iZXIobWF0Y2gpO1xuICAgICAgICAgICAgbnVtYmVyc1tpXSA9IG1hdGNoTnVtYmVyO1xuICAgICAgICAgICAgaWYgKG1hdGNoTnVtYmVyICsgMSA+IGN1cnJlbnRNYXgpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50TWF4ID0gbWF0Y2hOdW1iZXIgKyAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGZvb3ROb3RlSWQgPSBjdXJyZW50TWF4O1xuICAgIGxldCBmb290bm90ZU1hcmtlciA9IGBbXiR7Zm9vdE5vdGVJZH1dYDtcbiAgICBsZXQgbGluZVBhcnQxID0gbGluZVRleHQuc3Vic3RyKDAsIGN1cnNvclBvc2l0aW9uLmNoKTtcbiAgICBsZXQgbGluZVBhcnQyID0gbGluZVRleHQuc3Vic3RyKGN1cnNvclBvc2l0aW9uLmNoKTtcbiAgICBsZXQgbmV3TGluZSA9IGxpbmVQYXJ0MSArIGZvb3Rub3RlTWFya2VyICsgbGluZVBhcnQyO1xuXG4gICAgZG9jLnJlcGxhY2VSYW5nZShcbiAgICAgICAgbmV3TGluZSxcbiAgICAgICAgeyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogMCB9LFxuICAgICAgICB7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiBsaW5lVGV4dC5sZW5ndGggfVxuICAgICk7XG5cbiAgICBsZXQgbGFzdExpbmVJbmRleCA9IGRvYy5sYXN0TGluZSgpO1xuICAgIGxldCBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xuXG4gICAgd2hpbGUgKGxhc3RMaW5lSW5kZXggPiAwKSB7XG4gICAgICAgIGxhc3RMaW5lID0gZG9jLmdldExpbmUobGFzdExpbmVJbmRleCk7XG4gICAgICAgIGlmIChsYXN0TGluZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBkb2MucmVwbGFjZVJhbmdlKFxuICAgICAgICAgICAgICAgIFwiXCIsXG4gICAgICAgICAgICAgICAgeyBsaW5lOiBsYXN0TGluZUluZGV4LCBjaDogMCB9LFxuICAgICAgICAgICAgICAgIHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiAwIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBsYXN0TGluZUluZGV4LS07XG4gICAgfVxuXG4gICAgbGV0IGZvb3Rub3RlRGV0YWlsID0gYFxcblteJHtmb290Tm90ZUlkfV06IGA7XG5cbiAgICBsZXQgbGlzdCA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhkb2MpO1xuICAgIFxuICAgIGlmIChsaXN0PT09bnVsbCAmJiBjdXJyZW50TWF4ID09IDEpIHtcbiAgICAgICAgZm9vdG5vdGVEZXRhaWwgPSBcIlxcblwiICsgZm9vdG5vdGVEZXRhaWw7XG4gICAgICAgIGxldCBIZWFkaW5nID0gYWRkRm9vdG5vdGVTZWN0aW9uSGVhZGVyKHBsdWdpbik7XG4gICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIEhlYWRpbmcgKyBmb290bm90ZURldGFpbCk7XG4gICAgICAgIGRvYy5zZXRDdXJzb3IoZG9jLmxhc3RMaW5lKCkgLSAxLCBmb290bm90ZURldGFpbC5sZW5ndGggLSAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBkb2Muc2V0TGluZShkb2MubGFzdExpbmUoKSwgbGFzdExpbmUgKyBmb290bm90ZURldGFpbCk7XG4gICAgICAgIGRvYy5zZXRDdXJzb3IoZG9jLmxhc3RMaW5lKCksIGZvb3Rub3RlRGV0YWlsLmxlbmd0aCAtIDEpO1xuICAgIH1cbn1cblxuXG4vL0ZVTkNUSU9OUyBGT1IgTkFNRUQgRk9PVE5PVEVTXG5cbmV4cG9ydCBmdW5jdGlvbiBpbnNlcnROYW1lZEZvb3Rub3RlKHBsdWdpbjogRm9vdG5vdGVQbHVnaW4pIHtcbiAgICBjb25zdCBtZFZpZXcgPSBhcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcblxuICAgIGlmICghbWRWaWV3KSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG1kVmlldy5lZGl0b3IgPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBkb2MgPSBtZFZpZXcuZWRpdG9yO1xuICAgIGNvbnN0IGN1cnNvclBvc2l0aW9uID0gZG9jLmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVUZXh0ID0gZG9jLmdldExpbmUoY3Vyc29yUG9zaXRpb24ubGluZSk7XG4gICAgY29uc3QgbWFya2Rvd25UZXh0ID0gbWRWaWV3LmRhdGE7XG5cbiAgICBpZiAoc2hvdWxkSnVtcEZyb21EZXRhaWxUb01hcmtlcihsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYykpXG4gICAgICAgIHJldHVybjtcbiAgICBpZiAoc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYykpXG4gICAgICAgIHJldHVybjtcblxuICAgIGlmIChzaG91bGRDcmVhdGVNYXRjaGluZ0Zvb3Rub3RlRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgcGx1Z2luLCBkb2MpKVxuICAgICAgICByZXR1cm47IFxuICAgIHJldHVybiBzaG91bGRDcmVhdGVGb290bm90ZU1hcmtlcihcbiAgICAgICAgbGluZVRleHQsXG4gICAgICAgIGN1cnNvclBvc2l0aW9uLFxuICAgICAgICBkb2MsXG4gICAgICAgIG1hcmtkb3duVGV4dFxuICAgICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDcmVhdGVNYXRjaGluZ0Zvb3Rub3RlRGV0YWlsKFxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXG4gICAgZG9jOiBFZGl0b3Jcbikge1xuICAgIC8vIENyZWF0ZSBtYXRjaGluZyBmb290bm90ZSBkZXRhaWwgZm9yIGZvb3Rub3RlIG1hcmtlclxuICAgIFxuICAgIC8vIGRvZXMgdGhpcyBsaW5lIGhhdmUgYSBmb290bm90ZSBtYXJrZXI/XG4gICAgLy8gZG9lcyB0aGUgY3Vyc29yIG92ZXJsYXAgd2l0aCBvbmUgb2YgdGhlbT9cbiAgICAvLyBpZiBzbywgd2hpY2ggb25lP1xuICAgIC8vIGRvZXMgdGhpcyBmb290bm90ZSBtYXJrZXIgaGF2ZSBhIGRldGFpbCBsaW5lP1xuICAgIC8vIGlmIG5vdCwgY3JlYXRlIGl0IGFuZCBwbGFjZSBjdXJzb3IgdGhlcmVcbiAgICBsZXQgcmVPbmx5TWFya2Vyc01hdGNoZXMgPSBsaW5lVGV4dC5tYXRjaChBbGxNYXJrZXJzKTtcblxuICAgIGxldCBtYXJrZXJUYXJnZXQgPSBudWxsO1xuXG4gICAgaWYgKHJlT25seU1hcmtlcnNNYXRjaGVzKXtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gcmVPbmx5TWFya2Vyc01hdGNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBtYXJrZXIgPSByZU9ubHlNYXJrZXJzTWF0Y2hlc1tpXTtcbiAgICAgICAgICAgIGlmIChtYXJrZXIgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbGV0IGluZGV4T2ZNYXJrZXJJbkxpbmUgPSBsaW5lVGV4dC5pbmRleE9mKG1hcmtlcik7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA+PSBpbmRleE9mTWFya2VySW5MaW5lICYmXG4gICAgICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoIDw9IGluZGV4T2ZNYXJrZXJJbkxpbmUgKyBtYXJrZXIubGVuZ3RoXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcmtlclRhcmdldCA9IG1hcmtlcjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1hcmtlclRhcmdldCAhPSBudWxsKSB7XG4gICAgICAgIC8vZXh0cmFjdCBmb290bm90ZVxuICAgICAgICBsZXQgbWF0Y2ggPSBtYXJrZXJUYXJnZXQubWF0Y2goRXh0cmFjdE5hbWVGcm9tRm9vdG5vdGUpXG4gICAgICAgIC8vZmluZCBpZiB0aGlzIGZvb3Rub3RlIGV4aXN0cyBieSBsaXN0aW5nIGV4aXN0aW5nIGZvb3Rub3RlIGRldGFpbHNcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICBsZXQgZm9vdG5vdGVJZCA9IG1hdGNoWzJdO1xuXG4gICAgICAgICAgICBsZXQgbGlzdDogc3RyaW5nW10gPSBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoZG9jKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIGxpc3QgaXMgZW1wdHkgT1IgaWYgdGhlIGxpc3QgZG9lc24ndCBpbmNsdWRlIGN1cnJlbnQgZm9vdG5vdGVcbiAgICAgICAgICAgIC8vIGlmIHNvLCBhZGQgZGV0YWlsIGZvciB0aGUgY3VycmVudCBmb290bm90ZVxuICAgICAgICAgICAgaWYobGlzdCA9PT0gbnVsbCB8fCAhbGlzdC5pbmNsdWRlcyhmb290bm90ZUlkKSkge1xuICAgICAgICAgICAgICAgIGxldCBsYXN0TGluZUluZGV4ID0gZG9jLmxhc3RMaW5lKCk7XG4gICAgICAgICAgICAgICAgbGV0IGxhc3RMaW5lID0gZG9jLmdldExpbmUobGFzdExpbmVJbmRleCk7XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAobGFzdExpbmVJbmRleCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RMaW5lLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvYy5yZXBsYWNlUmFuZ2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxpbmU6IGxhc3RMaW5lSW5kZXgsIGNoOiAwIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsaW5lOiBkb2MubGFzdExpbmUoKSwgY2g6IDAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxhc3RMaW5lSW5kZXgtLTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbGV0IGZvb3Rub3RlRGV0YWlsID0gYFxcblteJHtmb290bm90ZUlkfV06IGA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKGxpc3Q9PT1udWxsIHx8IGxpc3QubGVuZ3RoIDwgMSkge1xuICAgICAgICAgICAgICAgICAgICBmb290bm90ZURldGFpbCA9IFwiXFxuXCIgKyBmb290bm90ZURldGFpbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IEhlYWRpbmcgPSBhZGRGb290bm90ZVNlY3Rpb25IZWFkZXIocGx1Z2luKTtcbiAgICAgICAgICAgICAgICAgICAgZG9jLnNldExpbmUoZG9jLmxhc3RMaW5lKCksIGxhc3RMaW5lICsgSGVhZGluZyArIGZvb3Rub3RlRGV0YWlsKTtcbiAgICAgICAgICAgICAgICAgICAgZG9jLnNldEN1cnNvcihkb2MubGFzdExpbmUoKSAtIDEsIGZvb3Rub3RlRGV0YWlsLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIGZvb3Rub3RlRGV0YWlsKTtcbiAgICAgICAgICAgICAgICAgICAgZG9jLnNldEN1cnNvcihkb2MubGFzdExpbmUoKSwgZm9vdG5vdGVEZXRhaWwubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47IFxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ3JlYXRlRm9vdG5vdGVNYXJrZXIoXG4gICAgbGluZVRleHQ6IHN0cmluZyxcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXG4gICAgZG9jOiBFZGl0b3IsXG4gICAgbWFya2Rvd25UZXh0OiBzdHJpbmdcbikge1xuICAgIC8vY3JlYXRlIGVtcHR5IGZvb3Rub3RlIG1hcmtlciBmb3IgbmFtZSBpbnB1dFxuICAgIGxldCBlbXB0eU1hcmtlciA9IGBbXl1gO1xuICAgIGRvYy5yZXBsYWNlUmFuZ2UoZW1wdHlNYXJrZXIsZG9jLmdldEN1cnNvcigpKTtcbiAgICAvL21vdmUgY3Vyc29yIGluIGJldHdlZW4gW14gYW5kIF1cbiAgICBkb2Muc2V0Q3Vyc29yKGN1cnNvclBvc2l0aW9uLmxpbmUsIGN1cnNvclBvc2l0aW9uLmNoKzIpO1xuICAgIC8vb3BlbiBmb290bm90ZVBpY2tlciBwb3B1cFxuICAgIFxufSIsImltcG9ydCB7XG4gICAgRWRpdG9yLFxuICAgIEVkaXRvclBvc2l0aW9uLFxuICAgIEVkaXRvclN1Z2dlc3QsXG4gICAgRWRpdG9yU3VnZ2VzdENvbnRleHQsXG4gICAgRWRpdG9yU3VnZ2VzdFRyaWdnZXJJbmZvLFxuICAgIE1hcmtkb3duVmlldyxcbiAgICBURmlsZSxcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHsgQWxsTWFya2VycywgRXh0cmFjdE5hbWVGcm9tRm9vdG5vdGUgfSBmcm9tIFwiLi9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzXCJcblxuXG5leHBvcnQgY2xhc3MgQXV0b2NvbXBsZXRlIGV4dGVuZHMgRWRpdG9yU3VnZ2VzdDxSZWdFeHBNYXRjaEFycmF5PiB7XG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbjtcbiAgICBsYXRlc3RUcmlnZ2VySW5mbzogRWRpdG9yU3VnZ2VzdFRyaWdnZXJJbmZvO1xuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbjtcblxuICAgIGNvbnN0cnVjdG9yKHBsdWdpbjogRm9vdG5vdGVQbHVnaW4pIHtcbiAgICAgICAgc3VwZXIocGx1Z2luLmFwcCk7XG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIH1cblxuICAgIG9uVHJpZ2dlcihcbiAgICAgICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLCBcbiAgICAgICAgZG9jOiBFZGl0b3IsIFxuICAgICAgICBmaWxlOiBURmlsZVxuICAgICk6IEVkaXRvclN1Z2dlc3RUcmlnZ2VySW5mbyB8IG51bGx7XG4gICAgICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVBdXRvU3VnZ2VzdCkge1xuXG4gICAgICAgICAgICBjb25zdCBtZFZpZXcgPSBhcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVUZXh0ID0gZG9jLmdldExpbmUoY3Vyc29yUG9zaXRpb24ubGluZSk7XG4gICAgICAgICAgICBjb25zdCBtYXJrZG93blRleHQgPSBtZFZpZXcuZGF0YTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHJlT25seU1hcmtlcnNNYXRjaGVzID0gbGluZVRleHQubWF0Y2goQWxsTWFya2Vycyk7XG5cbiAgICAgICAgICAgIGxldCBtYXJrZXJUYXJnZXQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IGluZGV4T2ZNYXJrZXJJbkxpbmUgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAocmVPbmx5TWFya2Vyc01hdGNoZXMpe1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IHJlT25seU1hcmtlcnNNYXRjaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBtYXJrZXIgPSByZU9ubHlNYXJrZXJzTWF0Y2hlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hcmtlciAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4T2ZNYXJrZXJJbkxpbmUgPSBsaW5lVGV4dC5pbmRleE9mKG1hcmtlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPj0gaW5kZXhPZk1hcmtlckluTGluZSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoIDw9IGluZGV4T2ZNYXJrZXJJbkxpbmUgKyBtYXJrZXIubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXJrZXJUYXJnZXQgPSBtYXJrZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXJrZXJUYXJnZXQgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vZXh0cmFjdCBmb290bm90ZVxuICAgICAgICAgICAgICAgIGxldCBtYXRjaCA9IG1hcmtlclRhcmdldC5tYXRjaChFeHRyYWN0TmFtZUZyb21Gb290bm90ZSlcbiAgICAgICAgICAgICAgICAvL2ZpbmQgaWYgdGhpcyBmb290bm90ZSBleGlzdHMgYnkgbGlzdGluZyBleGlzdGluZyBmb290bm90ZSBkZXRhaWxzXG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBmb290bm90ZUlkID0gbWF0Y2hbMl07XG4gICAgICAgICAgICAgICAgICAgIGlmIChmb290bm90ZUlkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubGF0ZXN0VHJpZ2dlckluZm8gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kOiBjdXJzb3JQb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaDogaW5kZXhPZk1hcmtlckluTGluZSArIDIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5OiBmb290bm90ZUlkXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubGF0ZXN0VHJpZ2dlckluZm9cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBGb290bm90ZV9EZXRhaWxfTmFtZXNfQW5kX1RleHQgPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdOiguKyg/Olxcbig/Oig/IVxcW1xcXlteXFxbXFxdXStcXF06KS4pKykqKS9nO1xuXG4gICAgRXh0cmFjdF9Gb290bm90ZV9EZXRhaWxfTmFtZXNfQW5kX1RleHQoXG4gICAgICAgIGRvYzogRWRpdG9yXG4gICAgKSB7XG4gICAgICAgIC8vc2VhcmNoIGVhY2ggbGluZSBmb3IgZm9vdG5vdGUgZGV0YWlscyBhbmQgYWRkIHRvIGxpc3RcbiAgICAgICAgLy9zYXZlIHRoZSBmb290bm90ZSBkZXRhaWwgbmFtZSBhcyBjYXB0dXJlIGdyb3VwIDFcbiAgICAgICAgLy9zYXZlIHRoZSBmb290bm90ZSBkZXRhaWwgdGV4dCBhcyBjYXB0dXJlIGdyb3VwIDJcbiAgICAgICAgXG4gICAgICAgIGxldCBkb2NUZXh0OnN0cmluZyA9IGRvYy5nZXRWYWx1ZSgpO1xuICAgICAgICBjb25zdCBtYXRjaGVzID0gQXJyYXkuZnJvbShkb2NUZXh0Lm1hdGNoQWxsKHRoaXMuRm9vdG5vdGVfRGV0YWlsX05hbWVzX0FuZF9UZXh0KSk7XG4gICAgICAgIHJldHVybiBtYXRjaGVzO1xuICAgIH1cblxuICAgIGdldFN1Z2dlc3Rpb25zID0gKGNvbnRleHQ6IEVkaXRvclN1Z2dlc3RDb250ZXh0KTogUmVnRXhwTWF0Y2hBcnJheVtdID0+IHtcbiAgICAgICAgY29uc3QgeyBxdWVyeSB9ID0gY29udGV4dDtcblxuICAgICAgICBjb25zdCBtZFZpZXcgPSBhcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICAgICAgY29uc3QgZG9jID0gbWRWaWV3LmVkaXRvcjtcbiAgICAgICAgY29uc3QgbWF0Y2hlcyA9IHRoaXMuRXh0cmFjdF9Gb290bm90ZV9EZXRhaWxfTmFtZXNfQW5kX1RleHQoZG9jKVxuICAgICAgICBjb25zdCBmaWx0ZXJlZFJlc3VsdHM6IFJlZ0V4cE1hdGNoQXJyYXlbXSA9IG1hdGNoZXMuZmlsdGVyKChlbnRyeSkgPT4gZW50cnlbMV0uaW5jbHVkZXMocXVlcnkpKTtcbiAgICAgICAgcmV0dXJuIGZpbHRlcmVkUmVzdWx0c1xuICAgIH07XG5cbiAgICByZW5kZXJTdWdnZXN0aW9uKFxuICAgICAgICB2YWx1ZTogUmVnRXhwTWF0Y2hBcnJheSwgXG4gICAgICAgIGVsOiBIVE1MRWxlbWVudFxuICAgICk6IHZvaWQge1xuICAgICAgICBlbC5jcmVhdGVFbChcImJcIiwgeyB0ZXh0OiB2YWx1ZVsxXSB9KTtcbiAgICAgICAgZWwuY3JlYXRlRWwoXCJiclwiKTtcbiAgICAgICAgZWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogdmFsdWVbMl19KTtcbiAgICB9XG5cbiAgICBzZWxlY3RTdWdnZXN0aW9uKFxuICAgICAgICB2YWx1ZTogUmVnRXhwTWF0Y2hBcnJheSwgXG4gICAgICAgIGV2dDogTW91c2VFdmVudCB8IEtleWJvYXJkRXZlbnRcbiAgICApOiB2b2lkIHtcbiAgICAgICAgY29uc3QgeyBjb250ZXh0LCBwbHVnaW4gfSA9IHRoaXM7XG4gICAgICAgIGlmICghY29udGV4dCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1kVmlldyA9IGFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuICAgICAgICBjb25zdCBkb2MgPSBtZFZpZXcuZWRpdG9yO1xuXG4gICAgICAgIGNvbnN0IGZpZWxkID0gdmFsdWVbMV07XG4gICAgICAgIGNvbnN0IHJlcGxhY2VtZW50ID0gYCR7ZmllbGR9YDtcblxuICAgICAgICBjb250ZXh0LmVkaXRvci5yZXBsYWNlUmFuZ2UoXG4gICAgICAgICAgICByZXBsYWNlbWVudCxcbiAgICAgICAgICAgIHRoaXMubGF0ZXN0VHJpZ2dlckluZm8uc3RhcnQsXG4gICAgICAgICAgICB0aGlzLmxhdGVzdFRyaWdnZXJJbmZvLmVuZCxcbiAgICAgICAgKTtcbiAgICB9XG59IiwiaW1wb3J0IHsgXG4gIGFkZEljb24sXG4gIEVkaXRvciwgXG4gIEVkaXRvclBvc2l0aW9uLCBcbiAgRWRpdG9yU3VnZ2VzdCwgXG4gIEVkaXRvclN1Z2dlc3RDb250ZXh0LFxuICBFZGl0b3JTdWdnZXN0VHJpZ2dlckluZm8sXG4gIE1hcmtkb3duVmlldywgXG4gIFBsdWdpblxufSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRm9vdG5vdGVQbHVnaW5TZXR0aW5nVGFiLCBGb290bm90ZVBsdWdpblNldHRpbmdzLCBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcbmltcG9ydCB7IEF1dG9jb21wbGV0ZSB9IGZyb20gXCIuL2F1dG9zdWdnZXN0XCJcbmltcG9ydCB7IGluc2VydEF1dG9udW1Gb290bm90ZSxpbnNlcnROYW1lZEZvb3Rub3RlIH0gZnJvbSBcIi4vaW5zZXJ0LW9yLW5hdmlnYXRlLWZvb3Rub3Rlc1wiO1xuXG4vL0FkZCBjaGV2cm9uLXVwLXNxdWFyZSBpY29uIGZyb20gbHVjaWRlIGZvciBtb2JpbGUgdG9vbGJhciAodGVtcG9yYXJ5IHVudGlsIE9ic2lkaWFuIHVwZGF0ZXMgdG8gTHVjaWRlIHYwLjEzMC4wKVxuYWRkSWNvbihcImNoZXZyb24tdXAtc3F1YXJlXCIsIGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgY2xhc3M9XCJsdWNpZGUgbHVjaWRlLWNoZXZyb24tdXAtc3F1YXJlXCI+PHJlY3Qgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgeD1cIjNcIiB5PVwiM1wiIHJ4PVwiMlwiIHJ5PVwiMlwiPjwvcmVjdD48cG9seWxpbmUgcG9pbnRzPVwiOCwxNCAxMiwxMCAxNiwxNFwiPjwvcG9seWxpbmU+PC9zdmc+YCk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvb3Rub3RlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHVibGljIHNldHRpbmdzOiBGb290bm90ZVBsdWdpblNldHRpbmdzO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG4gICAgdGhpcy5yZWdpc3RlckVkaXRvclN1Z2dlc3QobmV3IEF1dG9jb21wbGV0ZSh0aGlzKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiaW5zZXJ0LWF1dG9udW1iZXJlZC1mb290bm90ZVwiLFxuICAgICAgbmFtZTogXCJJbnNlcnQgLyBOYXZpZ2F0ZSBBdXRvLU51bWJlcmVkIEZvb3Rub3RlXCIsXG4gICAgICBpY29uOiBcInBsdXMtc3F1YXJlXCIsXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgaWYgKGNoZWNraW5nKVxuICAgICAgICAgIHJldHVybiAhIXRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgICAgIGluc2VydEF1dG9udW1Gb290bm90ZSh0aGlzKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluc2VydC1uYW1lZC1mb290bm90ZVwiLFxuICAgICAgbmFtZTogXCJJbnNlcnQgLyBOYXZpZ2F0ZSBOYW1lZCBGb290bm90ZVwiLFxuICAgICAgaWNvbjogXCJjaGV2cm9uLXVwLXNxdWFyZVwiLFxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG4gICAgICAgIGlmIChjaGVja2luZylcbiAgICAgICAgICByZXR1cm4gISF0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuICAgICAgICBpbnNlcnROYW1lZEZvb3Rub3RlKHRoaXMpO1xuICAgICAgfVxuICAgIH0pO1xuICBcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn0iXSwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJNYXJrZG93blZpZXciLCJFZGl0b3JTdWdnZXN0IiwiYWRkSWNvbiIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFvR0E7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcs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
