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
    insertAtEndOfWord: true,
    enablePopupEditor: true,
    enableFootnoteSectionHeading: false,
    FootnoteSectionHeading: "# Footnotes",
    enableRemoveBlankLastLines: true,
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
            .setName("Insert Footnote at end of word")
            .setDesc("A new footnote is only inserted at the end of the word and after any punctuation.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.insertAtEndOfWord)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.insertAtEndOfWord = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Edit footnotes in a popup")
            .setDesc("Open the footnote detail in a small editor at your cursor instead of jumping to the bottom of the note. Close it by pressing the footnote hotkey again, hitting Escape, or clicking outside.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enablePopupEditor)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enablePopupEditor = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Enable Trimming of Blank Lines")
            .setDesc("Removes blank lines from the end of the file when inserting a new footnote section")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enableRemoveBlankLastLines)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enableRemoveBlankLastLines = value;
            yield this.plugin.saveSettings();
        })));
        containerEl.createEl("h3", {
            text: "Footnotes Section Behavior",
        });
        new obsidian.Setting(containerEl)
            .setName("Enable Section Heading")
            .setDesc("Automatically adds a heading separating footnotes at the bottom of the note from the rest of the text.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enableFootnoteSectionHeading)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enableFootnoteSectionHeading = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Section Heading")
            .setDesc("Heading to place above footnotes section. Accepts standard Markdown formatting, including multiple lines and dividers.")
            .addTextArea((text) => text
            .setPlaceholder("Ex: '# Footnotes'")
            .setValue(this.plugin.settings.FootnoteSectionHeading)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.FootnoteSectionHeading = value;
            yield this.plugin.saveSettings();
        }))
            .then((text) => {
            text.inputEl.style.width = '100%';
            text.inputEl.rows = 6;
            text.inputEl.style.resize = 'none';
            text.inputEl.style.fontFamily = 'monospace';
        }));
    }
}

let activePopup = null;
function popupEditingAvailable(plugin) {
    var _a;
    // embedRegistry is undocumented API, so degrade to the legacy
    // jump-to-bottom behavior if it ever changes shape
    const registry = plugin.app.embedRegistry;
    return plugin.settings.enablePopupEditor === true
        && typeof ((_a = registry === null || registry === void 0 ? void 0 : registry.embedByExtension) === null || _a === void 0 ? void 0 : _a.md) === "function";
}
// Close from the footnote hotkey; returns whether a popup was open, so the
// hotkey can toggle the popup instead of inserting another footnote.
function toggleCloseFootnotePopup() {
    if (activePopup) {
        activePopup.close(true);
        return true;
    }
    return false;
}
// Close without stealing focus (leaf switched, plugin unloading).
function dismissFootnotePopup() {
    if (activePopup) {
        activePopup.close(false);
    }
}
function openFootnotePopup(plugin, footnoteId, onUnavailable) {
    return __awaiter(this, void 0, void 0, function* () {
        dismissFootnotePopup();
        const mdView = plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (!mdView || !mdView.file)
            return;
        // a just-inserted detail is only indexed once the file saves; finishing
        // the save (and its fold-state event) before the embed exists also keeps
        // it from reaching a half-initialized embed
        yield mdView.save();
        const editor = mdView.editor;
        const doc = mdView.containerEl.ownerDocument;
        const win = doc.defaultView || window;
        // anchor just below the cursor, flipping above it near the window bottom
        const cm = editor.cm;
        const coords = cm ? cm.coordsAtPos(cm.state.selection.main.head) : null;
        const width = Math.min(480, win.innerWidth - 32);
        const left = Math.max(16, Math.min(coords ? coords.left : 100, win.innerWidth - width - 16));
        let top = (coords ? coords.bottom : 100) + 6;
        if (top + 260 > win.innerHeight) {
            top = Math.max(16, (coords ? coords.top : 300) - 266);
        }
        const containerEl = doc.body.createDiv("footnote-shortcut-popup");
        containerEl.style.left = `${left}px`;
        containerEl.style.top = `${top}px`;
        containerEl.style.width = `${width}px`;
        // stay invisible until the footnote detail is actually loaded
        containerEl.style.visibility = "hidden";
        const subpath = `#[^${footnoteId}]`;
        const buildEmbed = () => {
            const built = plugin.app.embedRegistry.embedByExtension.md({ app: plugin.app, linktext: subpath, sourcePath: mdView.file.path, containerEl: containerEl, depth: 0 }, mdView.file, subpath);
            built.editable = true;
            built.load();
            return built;
        };
        let embed = buildEmbed();
        let closed = false;
        const close = (focusEditor) => {
            if (closed)
                return;
            closed = true;
            activePopup = null;
            doc.removeEventListener("mousedown", onDocMouseDown, true);
            containerEl.style.display = "none";
            if (focusEditor)
                editor.focus();
            // the embed saves edits on its own debounce; let that cycle finish
            // before unloading, since unloading mid-save clears the state the
            // save reads
            let attempts = 0;
            const teardown = () => {
                if ((embed.dirty || embed.saving || embed.saveAgain) && attempts++ < 50) {
                    win.setTimeout(teardown, 100);
                    return;
                }
                embed.unload();
                containerEl.remove();
            };
            teardown();
        };
        const onDocMouseDown = (evt) => {
            if (!containerEl.contains(evt.target))
                close(false);
        };
        doc.addEventListener("mousedown", onDocMouseDown, true);
        // bubble phase, so the embedded editor (e.g. vim mode leaving insert
        // mode) gets first claim on Escape
        containerEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Escape") {
                evt.preventDefault();
                close(true);
            }
        });
        activePopup = { containerEl, close };
        const tryShow = () => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            yield embed.loadFile();
            if (embed.subpathNotFound)
                return false;
            containerEl.style.visibility = "";
            embed.showEditor();
            (_b = (_a = embed.editMode) === null || _a === void 0 ? void 0 : _a.editor) === null || _b === void 0 ? void 0 : _b.focus();
            return true;
        });
        const waitForCacheChange = () => new Promise((resolve) => {
            const timeout = win.setTimeout(() => {
                plugin.app.metadataCache.offref(ref);
                resolve();
            }, 500);
            const ref = plugin.app.metadataCache.on("changed", (file) => {
                if (file === mdView.file) {
                    win.clearTimeout(timeout);
                    plugin.app.metadataCache.offref(ref);
                    resolve();
                }
            });
        });
        const showEditor = () => __awaiter(this, void 0, void 0, function* () {
            if (yield tryShow())
                return true;
            // retry as the metadata cache catches up with the saved file; a
            // loaded embed won't re-resolve its subpath, so rebuild each time
            const deadline = Date.now() + 3000;
            while (Date.now() < deadline) {
                yield waitForCacheChange();
                if (closed)
                    return true;
                embed.unload();
                containerEl.empty();
                embed = buildEmbed();
                if (yield tryShow())
                    return true;
            }
            return false;
        });
        showEditor()
            .then((shown) => {
            if (!shown && !closed) {
                close(false);
                onUnavailable === null || onUnavailable === void 0 ? void 0 : onUnavailable();
            }
        })
            .catch(() => {
            if (!closed) {
                close(false);
                onUnavailable === null || onUnavailable === void 0 ? void 0 : onUnavailable();
            }
        });
    });
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
function moveCursorAndSetJumpPoint(doc, oldCursorPos, newCursorPos) {
    doc.setCursor(newCursorPos);
    // if user has vim mode enabled, set jump point
    if (app.vault.getConfig("vimMode")) {
        // @ts-expect-error
        activeWindow.CodeMirrorAdapter.Vim.getVimGlobalState_().jumpList.add(
        // @ts-expect-error
        doc.cm.cm, // SIC two levels deep
        oldCursorPos, newCursorPos);
    }
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
                const newCursorPos = { line: returnLineIndex, ch: cursorLocationIndex + footnote.length };
                moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos);
                return true;
            }
        }
    }
    return false;
}
function jumpToFootnoteDetail(footnoteName, cursorPosition, doc) {
    // find the first line with this detail marker name in it.
    for (let i = 0; i < doc.lineCount(); i++) {
        let theLine = doc.getLine(i);
        let lineMatch = theLine.match(DetailInLine);
        if (lineMatch) {
            // compare to the index
            let nameMatch = lineMatch[1];
            if (nameMatch == footnoteName) {
                const newCursorPos = { line: i, ch: lineMatch[0].length + 1 };
                moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos);
                return true;
            }
        }
    }
    return false;
}
function shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc, plugin) {
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
            // markers without a detail line fall through to the
            // detail-creation paths
            let details = listExistingFootnoteDetails(doc);
            if (details === null || !details.includes(footnoteName)) {
                return false;
            }
            if (popupEditingAvailable(plugin)) {
                openFootnotePopup(plugin, footnoteName, () => jumpToFootnoteDetail(footnoteName, cursorPosition, doc));
                return true;
            }
            return jumpToFootnoteDetail(footnoteName, cursorPosition, doc);
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
/** adjust cursor position to insert a footnote only at the end of word */
function adjustFootnotePosition(cursorPosition, doc, lineText, plugin) {
    var _a;
    if (!plugin.settings.insertAtEndOfWord)
        return cursorPosition;
    const endOfWordUnderCursor = (_a = doc.wordAt(cursorPosition)) === null || _a === void 0 ? void 0 : _a.to;
    if (!endOfWordUnderCursor)
        return cursorPosition; // no word under cursor
    // adjust cursor position to insert a footnote only at the end of word
    const nextChar = lineText.charAt(endOfWordUnderCursor.ch);
    if ([".", ",", ":", ";"].includes(nextChar))
        endOfWordUnderCursor.ch++;
    cursorPosition = endOfWordUnderCursor;
    return cursorPosition;
}
//FUNCTIONS FOR AUTONUMBERED FOOTNOTES
function insertAutonumFootnote(plugin) {
    // pressing the hotkey while the popup editor is open closes it
    if (toggleCloseFootnotePopup())
        return;
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
    if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc, plugin))
        return;
    return shouldCreateAutonumFootnote(lineText, cursorPosition, plugin, doc, markdownText);
}
function shouldCreateAutonumFootnote(lineText, cursorPosition, plugin, doc, markdownText) {
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
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
    if (plugin.settings.enableRemoveBlankLastLines === true) {
        while (lastLineIndex > 0) {
            lastLine = doc.getLine(lastLineIndex);
            if (lastLine.length > 0) {
                doc.replaceRange("", { line: lastLineIndex, ch: 0 }, { line: doc.lastLine(), ch: 0 });
                break;
            }
            lastLineIndex--;
        }
    }
    let footnoteDetail = `\n[^${footNoteId}]: `;
    let list = listExistingFootnoteDetails(doc);
    let newCursorPos;
    if (list === null && currentMax == 1) {
        footnoteDetail = "\n" + footnoteDetail;
        let Heading = addFootnoteSectionHeader(plugin);
        doc.setLine(doc.lastLine(), lastLine + Heading + footnoteDetail);
        newCursorPos = { line: doc.lastLine() - 1, ch: footnoteDetail.length - 1 };
    }
    else {
        doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
        newCursorPos = { line: doc.lastLine(), ch: footnoteDetail.length - 1 };
    }
    if (popupEditingAvailable(plugin)) {
        // type the detail in a popup instead of jumping to the bottom
        doc.setCursor({ line: cursorPosition.line, ch: cursorPosition.ch + footnoteMarker.length });
        openFootnotePopup(plugin, String(footNoteId), () => moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos));
    }
    else {
        moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos);
    }
}
//FUNCTIONS FOR NAMED FOOTNOTES
function insertNamedFootnote(plugin) {
    // pressing the hotkey while the popup editor is open closes it
    if (toggleCloseFootnotePopup())
        return;
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
    if (shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc, plugin))
        return;
    if (shouldCreateMatchingFootnoteDetail(lineText, cursorPosition, plugin, doc))
        return;
    return shouldCreateFootnoteMarker(lineText, cursorPosition, doc, markdownText, plugin);
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
                if (plugin.settings.enableRemoveBlankLastLines === true) {
                    while (lastLineIndex > 0) {
                        lastLine = doc.getLine(lastLineIndex);
                        if (lastLine.length > 0) {
                            doc.replaceRange("", { line: lastLineIndex, ch: 0 }, { line: doc.lastLine(), ch: 0 });
                            break;
                        }
                        lastLineIndex--;
                    }
                }
                let footnoteDetail = `\n[^${footnoteId}]: `;
                let newCursorPos;
                if (list === null || list.length < 1) {
                    footnoteDetail = "\n" + footnoteDetail;
                    let Heading = addFootnoteSectionHeader(plugin);
                    doc.setLine(doc.lastLine(), lastLine + Heading + footnoteDetail);
                    newCursorPos = { line: doc.lastLine() - 1, ch: footnoteDetail.length - 1 };
                }
                else {
                    doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
                    newCursorPos = { line: doc.lastLine(), ch: footnoteDetail.length - 1 };
                }
                if (popupEditingAvailable(plugin)) {
                    // type the detail in a popup instead of jumping to the bottom
                    openFootnotePopup(plugin, footnoteId, () => moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos));
                }
                else {
                    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos);
                }
                return true;
            }
            return;
        }
    }
}
function shouldCreateFootnoteMarker(lineText, cursorPosition, doc, markdownText, plugin) {
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
    //create empty footnote marker for name input
    let emptyMarker = `[^]`;
    doc.replaceRange(emptyMarker, cursorPosition);
    //move cursor in between [^ and ]
    const newCursorPos = { line: cursorPosition.line, ch: cursorPosition.ch + 2 };
    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos);
    //open footnotePicker popup
}

//Add chevron-up-square icon from lucide for mobile toolbar (temporary until Obsidian updates to Lucide v0.130.0)
obsidian.addIcon("chevron-up-square", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-square"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><polyline points="8,14 12,10 16,14"></polyline></svg>`);
class FootnotePlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
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
            this.registerEvent(this.app.workspace.on("active-leaf-change", () => dismissFootnotePopup()));
        });
    }
    onunload() {
        dismissFootnotePopup();
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
            // migrate pre-1.0.4 section heading values: the old text input implied
            // an H1, the textarea takes literal markdown, so convert once and save
            const heading = this.settings.FootnoteSectionHeading;
            if (heading && !/^(#{1,6} |---|\*\*\*|___)/.test(heading)) {
                this.settings.FootnoteSectionHeading = `# ${heading}`;
                yield this.saveSettings();
            }
            // drop the setting for the removed autosuggest feature (Obsidian now
            // suggests footnotes natively)
            if ("enableAutoSuggest" in this.settings) {
                delete this.settings.enableAutoSuggest;
                yield this.saveSettings();
            }
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
}

module.exports = FootnotePlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9mb290bm90ZS1wb3B1cC50cyIsInNyYy9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlLCBTdXBwcmVzc2VkRXJyb3IsIFN5bWJvbCwgSXRlcmF0b3IgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXNEZWNvcmF0ZShjdG9yLCBkZXNjcmlwdG9ySW4sIGRlY29yYXRvcnMsIGNvbnRleHRJbiwgaW5pdGlhbGl6ZXJzLCBleHRyYUluaXRpYWxpemVycykge1xyXG4gICAgZnVuY3Rpb24gYWNjZXB0KGYpIHsgaWYgKGYgIT09IHZvaWQgMCAmJiB0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRnVuY3Rpb24gZXhwZWN0ZWRcIik7IHJldHVybiBmOyB9XHJcbiAgICB2YXIga2luZCA9IGNvbnRleHRJbi5raW5kLCBrZXkgPSBraW5kID09PSBcImdldHRlclwiID8gXCJnZXRcIiA6IGtpbmQgPT09IFwic2V0dGVyXCIgPyBcInNldFwiIDogXCJ2YWx1ZVwiO1xyXG4gICAgdmFyIHRhcmdldCA9ICFkZXNjcmlwdG9ySW4gJiYgY3RvciA/IGNvbnRleHRJbltcInN0YXRpY1wiXSA/IGN0b3IgOiBjdG9yLnByb3RvdHlwZSA6IG51bGw7XHJcbiAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JJbiB8fCAodGFyZ2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGNvbnRleHRJbi5uYW1lKSA6IHt9KTtcclxuICAgIHZhciBfLCBkb25lID0gZmFsc2U7XHJcbiAgICBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4pIGNvbnRleHRbcF0gPSBwID09PSBcImFjY2Vzc1wiID8ge30gOiBjb250ZXh0SW5bcF07XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4uYWNjZXNzKSBjb250ZXh0LmFjY2Vzc1twXSA9IGNvbnRleHRJbi5hY2Nlc3NbcF07XHJcbiAgICAgICAgY29udGV4dC5hZGRJbml0aWFsaXplciA9IGZ1bmN0aW9uIChmKSB7IGlmIChkb25lKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFkZCBpbml0aWFsaXplcnMgYWZ0ZXIgZGVjb3JhdGlvbiBoYXMgY29tcGxldGVkXCIpOyBleHRyYUluaXRpYWxpemVycy5wdXNoKGFjY2VwdChmIHx8IG51bGwpKTsgfTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gKDAsIGRlY29yYXRvcnNbaV0pKGtpbmQgPT09IFwiYWNjZXNzb3JcIiA/IHsgZ2V0OiBkZXNjcmlwdG9yLmdldCwgc2V0OiBkZXNjcmlwdG9yLnNldCB9IDogZGVzY3JpcHRvcltrZXldLCBjb250ZXh0KTtcclxuICAgICAgICBpZiAoa2luZCA9PT0gXCJhY2Nlc3NvclwiKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHZvaWQgMCkgY29udGludWU7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZFwiKTtcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmdldCkpIGRlc2NyaXB0b3IuZ2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LnNldCkpIGRlc2NyaXB0b3Iuc2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmluaXQpKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoXyA9IGFjY2VwdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIGlmIChraW5kID09PSBcImZpZWxkXCIpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgICAgICBlbHNlIGRlc2NyaXB0b3Jba2V5XSA9IF87XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRhcmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgY29udGV4dEluLm5hbWUsIGRlc2NyaXB0b3IpO1xyXG4gICAgZG9uZSA9IHRydWU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19ydW5Jbml0aWFsaXplcnModGhpc0FyZywgaW5pdGlhbGl6ZXJzLCB2YWx1ZSkge1xyXG4gICAgdmFyIHVzZVZhbHVlID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRpYWxpemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhbHVlID0gdXNlVmFsdWUgPyBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnLCB2YWx1ZSkgOiBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1c2VWYWx1ZSA/IHZhbHVlIDogdm9pZCAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcHJvcEtleSh4KSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwic3ltYm9sXCIgPyB4IDogXCJcIi5jb25jYXQoeCk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zZXRGdW5jdGlvbk5hbWUoZiwgbmFtZSwgcHJlZml4KSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3ltYm9sXCIpIG5hbWUgPSBuYW1lLmRlc2NyaXB0aW9uID8gXCJbXCIuY29uY2F0KG5hbWUuZGVzY3JpcHRpb24sIFwiXVwiKSA6IFwiXCI7XHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGYsIFwibmFtZVwiLCB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHByZWZpeCA/IFwiXCIuY29uY2F0KHByZWZpeCwgXCIgXCIsIG5hbWUpIDogbmFtZSB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGcgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEl0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpO1xyXG4gICAgcmV0dXJuIGcubmV4dCA9IHZlcmIoMCksIGdbXCJ0aHJvd1wiXSA9IHZlcmIoMSksIGdbXCJyZXR1cm5cIl0gPSB2ZXJiKDIpLCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBBc3luY0l0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBBc3luY0l0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpLCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIsIGF3YWl0UmV0dXJuKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gYXdhaXRSZXR1cm4oZikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGYsIHJlamVjdCk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpZiAoZ1tuXSkgeyBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyBpZiAoZikgaVtuXSA9IGYoaVtuXSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IGZhbHNlIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbnZhciBvd25LZXlzID0gZnVuY3Rpb24obykge1xyXG4gICAgb3duS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIHx8IGZ1bmN0aW9uIChvKSB7XHJcbiAgICAgICAgdmFyIGFyID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgayBpbiBvKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIGspKSBhclthci5sZW5ndGhdID0gaztcclxuICAgICAgICByZXR1cm4gYXI7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIG93bktleXMobyk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayA9IG93bktleXMobW9kKSwgaSA9IDA7IGkgPCBrLmxlbmd0aDsgaSsrKSBpZiAoa1tpXSAhPT0gXCJkZWZhdWx0XCIpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwga1tpXSk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4oc3RhdGUsIHJlY2VpdmVyKSB7XHJcbiAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwgfHwgKHR5cGVvZiByZWNlaXZlciAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcmVjZWl2ZXIgIT09IFwiZnVuY3Rpb25cIikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgdXNlICdpbicgb3BlcmF0b3Igb24gbm9uLW9iamVjdFwiKTtcclxuICAgIHJldHVybiB0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyID09PSBzdGF0ZSA6IHN0YXRlLmhhcyhyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZShlbnYsIHZhbHVlLCBhc3luYykge1xyXG4gICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkLlwiKTtcclxuICAgICAgICB2YXIgZGlzcG9zZSwgaW5uZXI7XHJcbiAgICAgICAgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmFzeW5jRGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0Rpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmFzeW5jRGlzcG9zZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkaXNwb3NlID09PSB2b2lkIDApIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuZGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5kaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5kaXNwb3NlXTtcclxuICAgICAgICAgICAgaWYgKGFzeW5jKSBpbm5lciA9IGRpc3Bvc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2YgZGlzcG9zZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IG5vdCBkaXNwb3NhYmxlLlwiKTtcclxuICAgICAgICBpZiAoaW5uZXIpIGRpc3Bvc2UgPSBmdW5jdGlvbigpIHsgdHJ5IHsgaW5uZXIuY2FsbCh0aGlzKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7IH0gfTtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IHZhbHVlOiB2YWx1ZSwgZGlzcG9zZTogZGlzcG9zZSwgYXN5bmM6IGFzeW5jIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoYXN5bmMpIHtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IGFzeW5jOiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG5cclxufVxyXG5cclxudmFyIF9TdXBwcmVzc2VkRXJyb3IgPSB0eXBlb2YgU3VwcHJlc3NlZEVycm9yID09PSBcImZ1bmN0aW9uXCIgPyBTdXBwcmVzc2VkRXJyb3IgOiBmdW5jdGlvbiAoZXJyb3IsIHN1cHByZXNzZWQsIG1lc3NhZ2UpIHtcclxuICAgIHZhciBlID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xyXG4gICAgcmV0dXJuIGUubmFtZSA9IFwiU3VwcHJlc3NlZEVycm9yXCIsIGUuZXJyb3IgPSBlcnJvciwgZS5zdXBwcmVzc2VkID0gc3VwcHJlc3NlZCwgZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2Rpc3Bvc2VSZXNvdXJjZXMoZW52KSB7XHJcbiAgICBmdW5jdGlvbiBmYWlsKGUpIHtcclxuICAgICAgICBlbnYuZXJyb3IgPSBlbnYuaGFzRXJyb3IgPyBuZXcgX1N1cHByZXNzZWRFcnJvcihlLCBlbnYuZXJyb3IsIFwiQW4gZXJyb3Igd2FzIHN1cHByZXNzZWQgZHVyaW5nIGRpc3Bvc2FsLlwiKSA6IGU7XHJcbiAgICAgICAgZW52Lmhhc0Vycm9yID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIHZhciByLCBzID0gMDtcclxuICAgIGZ1bmN0aW9uIG5leHQoKSB7XHJcbiAgICAgICAgd2hpbGUgKHIgPSBlbnYuc3RhY2sucG9wKCkpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmICghci5hc3luYyAmJiBzID09PSAxKSByZXR1cm4gcyA9IDAsIGVudi5zdGFjay5wdXNoKHIpLCBQcm9taXNlLnJlc29sdmUoKS50aGVuKG5leHQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHIuZGlzcG9zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSByLmRpc3Bvc2UuY2FsbChyLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoci5hc3luYykgcmV0dXJuIHMgfD0gMiwgUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCkudGhlbihuZXh0LCBmdW5jdGlvbihlKSB7IGZhaWwoZSk7IHJldHVybiBuZXh0KCk7IH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBzIHw9IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIGZhaWwoZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHMgPT09IDEpIHJldHVybiBlbnYuaGFzRXJyb3IgPyBQcm9taXNlLnJlamVjdChlbnYuZXJyb3IpIDogUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgaWYgKGVudi5oYXNFcnJvcikgdGhyb3cgZW52LmVycm9yO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5leHQoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uKHBhdGgsIHByZXNlcnZlSnN4KSB7XHJcbiAgICBpZiAodHlwZW9mIHBhdGggPT09IFwic3RyaW5nXCIgJiYgL15cXC5cXC4/XFwvLy50ZXN0KHBhdGgpKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhdGgucmVwbGFjZSgvXFwuKHRzeCkkfCgoPzpcXC5kKT8pKCg/OlxcLlteLi9dKz8pPylcXC4oW2NtXT8pdHMkL2ksIGZ1bmN0aW9uIChtLCB0c3gsIGQsIGV4dCwgY20pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRzeCA/IHByZXNlcnZlSnN4ID8gXCIuanN4XCIgOiBcIi5qc1wiIDogZCAmJiAoIWV4dCB8fCAhY20pID8gbSA6IChkICsgZXh0ICsgXCIuXCIgKyBjbS50b0xvd2VyQ2FzZSgpICsgXCJqc1wiKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiBwYXRoO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBfX2V4dGVuZHM6IF9fZXh0ZW5kcyxcclxuICAgIF9fYXNzaWduOiBfX2Fzc2lnbixcclxuICAgIF9fcmVzdDogX19yZXN0LFxyXG4gICAgX19kZWNvcmF0ZTogX19kZWNvcmF0ZSxcclxuICAgIF9fcGFyYW06IF9fcGFyYW0sXHJcbiAgICBfX2VzRGVjb3JhdGU6IF9fZXNEZWNvcmF0ZSxcclxuICAgIF9fcnVuSW5pdGlhbGl6ZXJzOiBfX3J1bkluaXRpYWxpemVycyxcclxuICAgIF9fcHJvcEtleTogX19wcm9wS2V5LFxyXG4gICAgX19zZXRGdW5jdGlvbk5hbWU6IF9fc2V0RnVuY3Rpb25OYW1lLFxyXG4gICAgX19tZXRhZGF0YTogX19tZXRhZGF0YSxcclxuICAgIF9fYXdhaXRlcjogX19hd2FpdGVyLFxyXG4gICAgX19nZW5lcmF0b3I6IF9fZ2VuZXJhdG9yLFxyXG4gICAgX19jcmVhdGVCaW5kaW5nOiBfX2NyZWF0ZUJpbmRpbmcsXHJcbiAgICBfX2V4cG9ydFN0YXI6IF9fZXhwb3J0U3RhcixcclxuICAgIF9fdmFsdWVzOiBfX3ZhbHVlcyxcclxuICAgIF9fcmVhZDogX19yZWFkLFxyXG4gICAgX19zcHJlYWQ6IF9fc3ByZWFkLFxyXG4gICAgX19zcHJlYWRBcnJheXM6IF9fc3ByZWFkQXJyYXlzLFxyXG4gICAgX19zcHJlYWRBcnJheTogX19zcHJlYWRBcnJheSxcclxuICAgIF9fYXdhaXQ6IF9fYXdhaXQsXHJcbiAgICBfX2FzeW5jR2VuZXJhdG9yOiBfX2FzeW5jR2VuZXJhdG9yLFxyXG4gICAgX19hc3luY0RlbGVnYXRvcjogX19hc3luY0RlbGVnYXRvcixcclxuICAgIF9fYXN5bmNWYWx1ZXM6IF9fYXN5bmNWYWx1ZXMsXHJcbiAgICBfX21ha2VUZW1wbGF0ZU9iamVjdDogX19tYWtlVGVtcGxhdGVPYmplY3QsXHJcbiAgICBfX2ltcG9ydFN0YXI6IF9faW1wb3J0U3RhcixcclxuICAgIF9faW1wb3J0RGVmYXVsdDogX19pbXBvcnREZWZhdWx0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldDogX19jbGFzc1ByaXZhdGVGaWVsZEdldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRTZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkSW46IF9fY2xhc3NQcml2YXRlRmllbGRJbixcclxuICAgIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlOiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZSxcclxuICAgIF9fZGlzcG9zZVJlc291cmNlczogX19kaXNwb3NlUmVzb3VyY2VzLFxyXG4gICAgX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb246IF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uLFxyXG59O1xyXG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuaW1wb3J0IEZvb3Rub3RlUGx1Z2luIGZyb20gXCIuL21haW5cIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRm9vdG5vdGVQbHVnaW5TZXR0aW5ncyB7XHJcbiAgICBpbnNlcnRBdEVuZE9mV29yZDogYm9vbGVhbjtcclxuICAgIGVuYWJsZVBvcHVwRWRpdG9yOiBib29sZWFuO1xyXG5cclxuICAgIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IGJvb2xlYW47XHJcbiAgICBGb290bm90ZVNlY3Rpb25IZWFkaW5nOiBzdHJpbmc7XHJcblxyXG4gICAgZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXM6IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBGb290bm90ZVBsdWdpblNldHRpbmdzID0ge1xyXG4gICAgaW5zZXJ0QXRFbmRPZldvcmQ6IHRydWUsXHJcbiAgICBlbmFibGVQb3B1cEVkaXRvcjogdHJ1ZSxcclxuXHJcbiAgICBlbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nOiBmYWxzZSxcclxuICAgIEZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IFwiIyBGb290bm90ZXNcIixcclxuXHJcbiAgICBlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lczogdHJ1ZSxcclxufTtcclxuXHJcbmV4cG9ydCBjbGFzcyBGb290bm90ZVBsdWdpblNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW47XHJcblxyXG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4pIHtcclxuICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XHJcbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcbiAgICB9XHJcblxyXG4gICAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcclxuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcclxuICAgICAgICB0ZXh0OiBcIkZvb3Rub3RlIFNob3J0Y3V0XCIsXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IG1haW5EZXNjID0gY29udGFpbmVyRWwuY3JlYXRlRWwoJ3AnKTtcclxuXHJcbiAgICAgICAgICAgIG1haW5EZXNjLmFwcGVuZFRleHQoJ05lZWQgaGVscD8gQ2hlY2sgdGhlICcpO1xyXG4gICAgICAgICAgICBtYWluRGVzYy5hcHBlbmRDaGlsZChcclxuICAgICAgICAgICAgICAgIGNyZWF0ZUVsKCdhJywge1xyXG4gICAgICAgICAgICAgICAgdGV4dDogXCJSRUFETUVcIixcclxuICAgICAgICAgICAgICAgIGhyZWY6IFwiaHR0cHM6Ly9naXRodWIuY29tL01pY2hhQnJ1Z2dlci9vYnNpZGlhbi1mb290bm90ZXNcIixcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIG1haW5EZXNjLmFwcGVuZFRleHQoJyEnKTtcclxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnYnInKTtcclxuICAgICAgICBcclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkluc2VydCBGb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiQSBuZXcgZm9vdG5vdGUgaXMgb25seSBpbnNlcnRlZCBhdCB0aGUgZW5kIG9mIHRoZSB3b3JkIGFuZCBhZnRlciBhbnkgcHVuY3R1YXRpb24uXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZClcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZCA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkVkaXQgZm9vdG5vdGVzIGluIGEgcG9wdXBcIilcclxuICAgICAgICAuc2V0RGVzYyhcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2UgaXQgYnkgcHJlc3NpbmcgdGhlIGZvb3Rub3RlIGhvdGtleSBhZ2FpbiwgaGl0dGluZyBFc2NhcGUsIG9yIGNsaWNraW5nIG91dHNpZGUuXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVQb3B1cEVkaXRvcilcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVQb3B1cEVkaXRvciA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkVuYWJsZSBUcmltbWluZyBvZiBCbGFuayBMaW5lc1wiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiUmVtb3ZlcyBibGFuayBsaW5lcyBmcm9tIHRoZSBlbmQgb2YgdGhlIGZpbGUgd2hlbiBpbnNlcnRpbmcgYSBuZXcgZm9vdG5vdGUgc2VjdGlvblwiKVxyXG4gICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICAgICAgdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXMpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXMgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7XHJcbiAgICAgICAgICAgIHRleHQ6IFwiRm9vdG5vdGVzIFNlY3Rpb24gQmVoYXZpb3JcIixcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJFbmFibGUgU2VjdGlvbiBIZWFkaW5nXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJBdXRvbWF0aWNhbGx5IGFkZHMgYSBoZWFkaW5nIHNlcGFyYXRpbmcgZm9vdG5vdGVzIGF0IHRoZSBib3R0b20gb2YgdGhlIG5vdGUgZnJvbSB0aGUgcmVzdCBvZiB0aGUgdGV4dC5cIilcclxuICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XHJcbiAgICAgICAgICAgIHRvZ2dsZVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmcpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIlNlY3Rpb24gSGVhZGluZ1wiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiSGVhZGluZyB0byBwbGFjZSBhYm92ZSBmb290bm90ZXMgc2VjdGlvbi4gQWNjZXB0cyBzdGFuZGFyZCBNYXJrZG93biBmb3JtYXR0aW5nLCBpbmNsdWRpbmcgbXVsdGlwbGUgbGluZXMgYW5kIGRpdmlkZXJzLlwiKVxyXG4gICAgICAgIC5hZGRUZXh0QXJlYSgodGV4dCkgPT5cclxuICAgICAgICAgICAgdGV4dFxyXG4gICAgICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiRXg6ICcjIEZvb3Rub3RlcydcIilcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmcgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAudGhlbigodGV4dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHQuaW5wdXRFbC5zdHlsZS53aWR0aCA9ICcxMDAlJztcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwucm93cyA9IDY7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLnJlc2l6ZSA9ICdub25lJztcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCB7IE1hcmtkb3duVmlldyB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuXG4vLyBBIHNtYWxsIHBvcHVwIGFuY2hvcmVkIGF0IHRoZSBjdXJzb3IgY29udGFpbmluZyBPYnNpZGlhbidzIG93biBlZGl0YWJsZVxuLy8gbWFya2Rvd24gZW1iZWQsIGJvdW5kIHRvIGp1c3QgdGhlIGZvb3Rub3RlJ3MgZGV0YWlsIHZpYSB0aGUgYCNbXmlkXWBcbi8vIHN1YnBhdGggKHRoZSBzYW1lIG1hY2hpbmVyeSB0aGUgY29yZSBGb290bm90ZXMgdmlldyB1c2VzKS4gRWRpdGluZyBpbiB0aGVcbi8vIHBvcHVwIHNhdmVzIHN0cmFpZ2h0IGJhY2sgdG8gdGhlIGRldGFpbCBsaW5lIGF0IHRoZSBib3R0b20gb2YgdGhlIG5vdGUsXG4vLyBzbyB0aGUgdXNlcidzIGN1cnNvciBuZXZlciBoYXMgdG8gbGVhdmUgdGhlIHRleHQuXG5cbnR5cGUgQWN0aXZlUG9wdXAgPSB7XG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50O1xuICAgIGNsb3NlOiAoZm9jdXNFZGl0b3I6IGJvb2xlYW4pID0+IHZvaWQ7XG59O1xuXG5sZXQgYWN0aXZlUG9wdXA6IEFjdGl2ZVBvcHVwIHwgbnVsbCA9IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiBwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luOiBGb290bm90ZVBsdWdpbik6IGJvb2xlYW4ge1xuICAgIC8vIGVtYmVkUmVnaXN0cnkgaXMgdW5kb2N1bWVudGVkIEFQSSwgc28gZGVncmFkZSB0byB0aGUgbGVnYWN5XG4gICAgLy8ganVtcC10by1ib3R0b20gYmVoYXZpb3IgaWYgaXQgZXZlciBjaGFuZ2VzIHNoYXBlXG4gICAgY29uc3QgcmVnaXN0cnkgPSAocGx1Z2luLmFwcCBhcyBhbnkpLmVtYmVkUmVnaXN0cnk7XG4gICAgcmV0dXJuIHBsdWdpbi5zZXR0aW5ncy5lbmFibGVQb3B1cEVkaXRvciA9PT0gdHJ1ZVxuICAgICAgICAmJiB0eXBlb2YgcmVnaXN0cnk/LmVtYmVkQnlFeHRlbnNpb24/Lm1kID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbi8vIENsb3NlIGZyb20gdGhlIGZvb3Rub3RlIGhvdGtleTsgcmV0dXJucyB3aGV0aGVyIGEgcG9wdXAgd2FzIG9wZW4sIHNvIHRoZVxuLy8gaG90a2V5IGNhbiB0b2dnbGUgdGhlIHBvcHVwIGluc3RlYWQgb2YgaW5zZXJ0aW5nIGFub3RoZXIgZm9vdG5vdGUuXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlQ2xvc2VGb290bm90ZVBvcHVwKCk6IGJvb2xlYW4ge1xuICAgIGlmIChhY3RpdmVQb3B1cCkge1xuICAgICAgICBhY3RpdmVQb3B1cC5jbG9zZSh0cnVlKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuLy8gQ2xvc2Ugd2l0aG91dCBzdGVhbGluZyBmb2N1cyAobGVhZiBzd2l0Y2hlZCwgcGx1Z2luIHVubG9hZGluZykuXG5leHBvcnQgZnVuY3Rpb24gZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKSB7XG4gICAgaWYgKGFjdGl2ZVBvcHVwKSB7XG4gICAgICAgIGFjdGl2ZVBvcHVwLmNsb3NlKGZhbHNlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuRm9vdG5vdGVQb3B1cChcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxuICAgIGZvb3Rub3RlSWQ6IHN0cmluZyxcbiAgICBvblVuYXZhaWxhYmxlPzogKCkgPT4gdm9pZCxcbikge1xuICAgIGRpc21pc3NGb290bm90ZVBvcHVwKCk7XG5cbiAgICBjb25zdCBtZFZpZXcgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgaWYgKCFtZFZpZXcgfHwgIW1kVmlldy5maWxlKSByZXR1cm47XG5cbiAgICAvLyBhIGp1c3QtaW5zZXJ0ZWQgZGV0YWlsIGlzIG9ubHkgaW5kZXhlZCBvbmNlIHRoZSBmaWxlIHNhdmVzOyBmaW5pc2hpbmdcbiAgICAvLyB0aGUgc2F2ZSAoYW5kIGl0cyBmb2xkLXN0YXRlIGV2ZW50KSBiZWZvcmUgdGhlIGVtYmVkIGV4aXN0cyBhbHNvIGtlZXBzXG4gICAgLy8gaXQgZnJvbSByZWFjaGluZyBhIGhhbGYtaW5pdGlhbGl6ZWQgZW1iZWRcbiAgICBhd2FpdCBtZFZpZXcuc2F2ZSgpO1xuICAgIGNvbnN0IGVkaXRvciA9IG1kVmlldy5lZGl0b3I7XG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmNvbnRhaW5lckVsLm93bmVyRG9jdW1lbnQ7XG4gICAgY29uc3Qgd2luID0gZG9jLmRlZmF1bHRWaWV3IHx8IHdpbmRvdztcblxuICAgIC8vIGFuY2hvciBqdXN0IGJlbG93IHRoZSBjdXJzb3IsIGZsaXBwaW5nIGFib3ZlIGl0IG5lYXIgdGhlIHdpbmRvdyBib3R0b21cbiAgICBjb25zdCBjbSA9IChlZGl0b3IgYXMgYW55KS5jbTtcbiAgICBjb25zdCBjb29yZHMgPSBjbSA/IGNtLmNvb3Jkc0F0UG9zKGNtLnN0YXRlLnNlbGVjdGlvbi5tYWluLmhlYWQpIDogbnVsbDtcbiAgICBjb25zdCB3aWR0aCA9IE1hdGgubWluKDQ4MCwgd2luLmlubmVyV2lkdGggLSAzMik7XG4gICAgY29uc3QgbGVmdCA9IE1hdGgubWF4KDE2LCBNYXRoLm1pbihjb29yZHMgPyBjb29yZHMubGVmdCA6IDEwMCwgd2luLmlubmVyV2lkdGggLSB3aWR0aCAtIDE2KSk7XG4gICAgbGV0IHRvcCA9IChjb29yZHMgPyBjb29yZHMuYm90dG9tIDogMTAwKSArIDY7XG4gICAgaWYgKHRvcCArIDI2MCA+IHdpbi5pbm5lckhlaWdodCkge1xuICAgICAgICB0b3AgPSBNYXRoLm1heCgxNiwgKGNvb3JkcyA/IGNvb3Jkcy50b3AgOiAzMDApIC0gMjY2KTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250YWluZXJFbCA9IGRvYy5ib2R5LmNyZWF0ZURpdihcImZvb3Rub3RlLXNob3J0Y3V0LXBvcHVwXCIpO1xuICAgIGNvbnRhaW5lckVsLnN0eWxlLmxlZnQgPSBgJHtsZWZ0fXB4YDtcbiAgICBjb250YWluZXJFbC5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xuICAgIGNvbnRhaW5lckVsLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuICAgIC8vIHN0YXkgaW52aXNpYmxlIHVudGlsIHRoZSBmb290bm90ZSBkZXRhaWwgaXMgYWN0dWFsbHkgbG9hZGVkXG4gICAgY29udGFpbmVyRWwuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XG5cbiAgICBjb25zdCBzdWJwYXRoID0gYCNbXiR7Zm9vdG5vdGVJZH1dYDtcbiAgICBjb25zdCBidWlsZEVtYmVkID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBidWlsdCA9IChwbHVnaW4uYXBwIGFzIGFueSkuZW1iZWRSZWdpc3RyeS5lbWJlZEJ5RXh0ZW5zaW9uLm1kKFxuICAgICAgICAgICAgeyBhcHA6IHBsdWdpbi5hcHAsIGxpbmt0ZXh0OiBzdWJwYXRoLCBzb3VyY2VQYXRoOiBtZFZpZXcuZmlsZS5wYXRoLCBjb250YWluZXJFbDogY29udGFpbmVyRWwsIGRlcHRoOiAwIH0sXG4gICAgICAgICAgICBtZFZpZXcuZmlsZSxcbiAgICAgICAgICAgIHN1YnBhdGgsXG4gICAgICAgICk7XG4gICAgICAgIGJ1aWx0LmVkaXRhYmxlID0gdHJ1ZTtcbiAgICAgICAgYnVpbHQubG9hZCgpO1xuICAgICAgICByZXR1cm4gYnVpbHQ7XG4gICAgfTtcbiAgICBsZXQgZW1iZWQgPSBidWlsZEVtYmVkKCk7XG5cbiAgICBsZXQgY2xvc2VkID0gZmFsc2U7XG4gICAgY29uc3QgY2xvc2UgPSAoZm9jdXNFZGl0b3I6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgaWYgKGNsb3NlZCkgcmV0dXJuO1xuICAgICAgICBjbG9zZWQgPSB0cnVlO1xuICAgICAgICBhY3RpdmVQb3B1cCA9IG51bGw7XG4gICAgICAgIGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIG9uRG9jTW91c2VEb3duLCB0cnVlKTtcbiAgICAgICAgY29udGFpbmVyRWwuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICBpZiAoZm9jdXNFZGl0b3IpIGVkaXRvci5mb2N1cygpO1xuXG4gICAgICAgIC8vIHRoZSBlbWJlZCBzYXZlcyBlZGl0cyBvbiBpdHMgb3duIGRlYm91bmNlOyBsZXQgdGhhdCBjeWNsZSBmaW5pc2hcbiAgICAgICAgLy8gYmVmb3JlIHVubG9hZGluZywgc2luY2UgdW5sb2FkaW5nIG1pZC1zYXZlIGNsZWFycyB0aGUgc3RhdGUgdGhlXG4gICAgICAgIC8vIHNhdmUgcmVhZHNcbiAgICAgICAgbGV0IGF0dGVtcHRzID0gMDtcbiAgICAgICAgY29uc3QgdGVhcmRvd24gPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoKGVtYmVkLmRpcnR5IHx8IGVtYmVkLnNhdmluZyB8fCBlbWJlZC5zYXZlQWdhaW4pICYmIGF0dGVtcHRzKysgPCA1MCkge1xuICAgICAgICAgICAgICAgIHdpbi5zZXRUaW1lb3V0KHRlYXJkb3duLCAxMDApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVtYmVkLnVubG9hZCgpO1xuICAgICAgICAgICAgY29udGFpbmVyRWwucmVtb3ZlKCk7XG4gICAgICAgIH07XG4gICAgICAgIHRlYXJkb3duKCk7XG4gICAgfTtcblxuICAgIGNvbnN0IG9uRG9jTW91c2VEb3duID0gKGV2dDogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBpZiAoIWNvbnRhaW5lckVsLmNvbnRhaW5zKGV2dC50YXJnZXQgYXMgTm9kZSkpIGNsb3NlKGZhbHNlKTtcbiAgICB9O1xuICAgIGRvYy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIG9uRG9jTW91c2VEb3duLCB0cnVlKTtcblxuICAgIC8vIGJ1YmJsZSBwaGFzZSwgc28gdGhlIGVtYmVkZGVkIGVkaXRvciAoZS5nLiB2aW0gbW9kZSBsZWF2aW5nIGluc2VydFxuICAgIC8vIG1vZGUpIGdldHMgZmlyc3QgY2xhaW0gb24gRXNjYXBlXG4gICAgY29udGFpbmVyRWwuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2dDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgICBpZiAoZXZ0LmtleSA9PT0gXCJFc2NhcGVcIikge1xuICAgICAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICBjbG9zZSh0cnVlKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgYWN0aXZlUG9wdXAgPSB7IGNvbnRhaW5lckVsLCBjbG9zZSB9O1xuXG4gICAgY29uc3QgdHJ5U2hvdyA9IGFzeW5jICgpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcbiAgICAgICAgYXdhaXQgZW1iZWQubG9hZEZpbGUoKTtcbiAgICAgICAgaWYgKGVtYmVkLnN1YnBhdGhOb3RGb3VuZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb250YWluZXJFbC5zdHlsZS52aXNpYmlsaXR5ID0gXCJcIjtcbiAgICAgICAgZW1iZWQuc2hvd0VkaXRvcigpO1xuICAgICAgICBlbWJlZC5lZGl0TW9kZT8uZWRpdG9yPy5mb2N1cygpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4gICAgY29uc3Qgd2FpdEZvckNhY2hlQ2hhbmdlID0gKCkgPT5cbiAgICAgICAgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSB3aW4uc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgcGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLm9mZnJlZihyZWYpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0sIDUwMCk7XG4gICAgICAgICAgICBjb25zdCByZWYgPSBwbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGZpbGUgPT09IG1kVmlldy5maWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHdpbi5jbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgICAgICAgICAgIHBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5vZmZyZWYocmVmKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgIGNvbnN0IHNob3dFZGl0b3IgPSBhc3luYyAoKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XG4gICAgICAgIGlmIChhd2FpdCB0cnlTaG93KCkpIHJldHVybiB0cnVlO1xuXG4gICAgICAgIC8vIHJldHJ5IGFzIHRoZSBtZXRhZGF0YSBjYWNoZSBjYXRjaGVzIHVwIHdpdGggdGhlIHNhdmVkIGZpbGU7IGFcbiAgICAgICAgLy8gbG9hZGVkIGVtYmVkIHdvbid0IHJlLXJlc29sdmUgaXRzIHN1YnBhdGgsIHNvIHJlYnVpbGQgZWFjaCB0aW1lXG4gICAgICAgIGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIDMwMDA7XG4gICAgICAgIHdoaWxlIChEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcbiAgICAgICAgICAgIGF3YWl0IHdhaXRGb3JDYWNoZUNoYW5nZSgpO1xuICAgICAgICAgICAgaWYgKGNsb3NlZCkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBlbWJlZC51bmxvYWQoKTtcbiAgICAgICAgICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgICAgICAgICBlbWJlZCA9IGJ1aWxkRW1iZWQoKTtcbiAgICAgICAgICAgIGlmIChhd2FpdCB0cnlTaG93KCkpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgc2hvd0VkaXRvcigpXG4gICAgICAgIC50aGVuKChzaG93bikgPT4ge1xuICAgICAgICAgICAgaWYgKCFzaG93biAmJiAhY2xvc2VkKSB7XG4gICAgICAgICAgICAgICAgY2xvc2UoZmFsc2UpO1xuICAgICAgICAgICAgICAgIG9uVW5hdmFpbGFibGU/LigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFjbG9zZWQpIHtcbiAgICAgICAgICAgICAgICBjbG9zZShmYWxzZSk7XG4gICAgICAgICAgICAgICAgb25VbmF2YWlsYWJsZT8uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xufVxuIiwiaW1wb3J0IHtcblx0RWRpdG9yLFxuXHRFZGl0b3JQb3NpdGlvbixcblx0TWFya2Rvd25WaWV3XG59IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHsgb3BlbkZvb3Rub3RlUG9wdXAsIHBvcHVwRWRpdGluZ0F2YWlsYWJsZSwgdG9nZ2xlQ2xvc2VGb290bm90ZVBvcHVwIH0gZnJvbSBcIi4vZm9vdG5vdGUtcG9wdXBcIjtcblxuZXhwb3J0IHZhciBBbGxNYXJrZXJzID0gL1xcW1xcXihbXlxcW1xcXV0rKVxcXSg/ITopL2RnO1xudmFyIEFsbE51bWJlcmVkTWFya2VycyA9IC9cXFtcXF4oXFxkKylcXF0vZ2k7XG52YXIgQWxsRGV0YWlsc05hbWVPbmx5ID0gL1xcW1xcXihbXlxcW1xcXV0rKVxcXTovZztcbnZhciBEZXRhaWxJbkxpbmUgPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdOi87XG5leHBvcnQgdmFyIEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlID0gLyhcXFtcXF4pKFteXFxbXFxdXSspKD89XFxdKS87XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhcbiAgICBkb2M6IEVkaXRvclxuKSB7XG4gICAgbGV0IEZvb3Rub3RlRGV0YWlsTGlzdDogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICAvL3NlYXJjaCBlYWNoIGxpbmUgZm9yIGZvb3Rub3RlIGRldGFpbHMgYW5kIGFkZCB0byBsaXN0XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xuICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xuICAgICAgICBsZXQgbGluZU1hdGNoID0gdGhlTGluZS5tYXRjaChBbGxEZXRhaWxzTmFtZU9ubHkpO1xuICAgICAgICBpZiAobGluZU1hdGNoKSB7XG4gICAgICAgICAgICBsZXQgdGVtcCA9IGxpbmVNYXRjaFswXTtcbiAgICAgICAgICAgIHRlbXAgPSB0ZW1wLnJlcGxhY2UoXCJbXlwiLFwiXCIpO1xuICAgICAgICAgICAgdGVtcCA9IHRlbXAucmVwbGFjZShcIl06XCIsXCJcIik7XG5cbiAgICAgICAgICAgIEZvb3Rub3RlRGV0YWlsTGlzdC5wdXNoKHRlbXApO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChGb290bm90ZURldGFpbExpc3QubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gRm9vdG5vdGVEZXRhaWxMaXN0O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RFeGlzdGluZ0Zvb3Rub3RlTWFya2Vyc0FuZExvY2F0aW9ucyhcbiAgICBkb2M6IEVkaXRvclxuKSB7XG4gICAgdHlwZSBtYXJrZXJFbnRyeSA9IHtcbiAgICAgICAgZm9vdG5vdGU6IHN0cmluZztcbiAgICAgICAgbGluZU51bTogbnVtYmVyO1xuICAgICAgICBzdGFydEluZGV4OiBudW1iZXI7XG4gICAgfVxuICAgIGxldCBtYXJrZXJFbnRyeTtcblxuICAgIGxldCBGb290bm90ZU1hcmtlckluZm8gPSBbXTtcbiAgICAvL3NlYXJjaCBlYWNoIGxpbmUgZm9yIGZvb3Rub3RlIG1hcmtlcnNcbiAgICAvL2ZvciBlYWNoLCBhZGQgdGhlaXIgbmFtZSwgbGluZSBudW1iZXIsIGFuZCBzdGFydCBpbmRleCB0byBGb290bm90ZU1hcmtlckluZm9cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XG4gICAgICAgIGxldCB0aGVMaW5lID0gZG9jLmdldExpbmUoaSk7XG4gICAgICAgIGxldCBsaW5lTWF0Y2g7XG5cbiAgICAgICAgd2hpbGUgKChsaW5lTWF0Y2ggPSBBbGxNYXJrZXJzLmV4ZWModGhlTGluZSkpICE9IG51bGwpIHtcbiAgICAgICAgbWFya2VyRW50cnkgPSB7XG4gICAgICAgICAgICBmb290bm90ZTogbGluZU1hdGNoWzBdLFxuICAgICAgICAgICAgbGluZU51bTogaSxcbiAgICAgICAgICAgIHN0YXJ0SW5kZXg6IGxpbmVNYXRjaC5pbmRleFxuICAgICAgICB9XG4gICAgICAgIEZvb3Rub3RlTWFya2VySW5mby5wdXNoKG1hcmtlckVudHJ5KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gRm9vdG5vdGVNYXJrZXJJbmZvO1xufVxuXG5mdW5jdGlvbiBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KFxuICAgIGRvYzogRWRpdG9yLFxuICAgIG9sZEN1cnNvclBvczogRWRpdG9yUG9zaXRpb24sXG4gICAgbmV3Q3Vyc29yUG9zOiBFZGl0b3JQb3NpdGlvbixcbik6IHZvaWQge1xuICAgIGRvYy5zZXRDdXJzb3IobmV3Q3Vyc29yUG9zKTtcblxuICAgIC8vIGlmIHVzZXIgaGFzIHZpbSBtb2RlIGVuYWJsZWQsIHNldCBqdW1wIHBvaW50XG4gICAgaWYgKGFwcC52YXVsdC5nZXRDb25maWcoXCJ2aW1Nb2RlXCIpKSB7XG4gICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgYWN0aXZlV2luZG93LkNvZGVNaXJyb3JBZGFwdGVyLlZpbS5nZXRWaW1HbG9iYWxTdGF0ZV8oKS5qdW1wTGlzdC5hZGQoXG4gICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgICAgICAgICBkb2MuY20uY20sIC8vIFNJQyB0d28gbGV2ZWxzIGRlZXBcbiAgICAgICAgICAgIG9sZEN1cnNvclBvcyxcbiAgICAgICAgICAgIG5ld0N1cnNvclBvcyxcbiAgICAgICAgKTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKFxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxuICAgIGRvYzogRWRpdG9yXG4pIHtcbiAgICAvLyBjaGVjayBpZiB3ZSdyZSBpbiBhIGZvb3Rub3RlIGRldGFpbCBsaW5lIChcIlteMV06IGZvb3Rub3RlXCIpXG4gICAgLy8gaWYgc28sIGp1bXAgY3Vyc29yIGJhY2sgdG8gdGhlIGZvb3Rub3RlIGluIHRoZSB0ZXh0XG5cbiAgICBsZXQgbWF0Y2ggPSBsaW5lVGV4dC5tYXRjaChEZXRhaWxJbkxpbmUpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgICBsZXQgcyA9IG1hdGNoWzBdO1xuICAgICAgICBsZXQgaW5kZXggPSBzLnJlcGxhY2UoXCJbXlwiLCBcIlwiKTtcbiAgICAgICAgaW5kZXggPSBpbmRleC5yZXBsYWNlKFwiXTpcIiwgXCJcIik7XG4gICAgICAgIGxldCBmb290bm90ZSA9IHMucmVwbGFjZShcIjpcIiwgXCJcIik7XG5cbiAgICAgICAgbGV0IHJldHVybkxpbmVJbmRleCA9IGN1cnNvclBvc2l0aW9uLmxpbmU7XG4gICAgICAgIC8vIGZpbmQgdGhlIEZJUlNUIE9DQ1VSRU5DRSB3aGVyZSB0aGlzIGZvb3Rub3RlIGV4aXN0cyBpbiB0aGUgdGV4dFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgc2NhbkxpbmUgPSBkb2MuZ2V0TGluZShpKTtcbiAgICAgICAgICAgIGlmIChzY2FuTGluZS5jb250YWlucyhmb290bm90ZSkpIHtcbiAgICAgICAgICAgICAgICBsZXQgY3Vyc29yTG9jYXRpb25JbmRleCA9IHNjYW5MaW5lLmluZGV4T2YoZm9vdG5vdGUpO1xuICAgICAgICAgICAgICAgIHJldHVybkxpbmVJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiByZXR1cm5MaW5lSW5kZXgsIGNoOiBjdXJzb3JMb2NhdGlvbkluZGV4ICsgZm9vdG5vdGUubGVuZ3RoIH07XG4gICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGp1bXBUb0Zvb3Rub3RlRGV0YWlsKFxuICAgIGZvb3Rub3RlTmFtZTogc3RyaW5nLFxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcbiAgICBkb2M6IEVkaXRvclxuKSB7XG4gICAgLy8gZmluZCB0aGUgZmlyc3QgbGluZSB3aXRoIHRoaXMgZGV0YWlsIG1hcmtlciBuYW1lIGluIGl0LlxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcbiAgICAgICAgbGV0IHRoZUxpbmUgPSBkb2MuZ2V0TGluZShpKTtcbiAgICAgICAgbGV0IGxpbmVNYXRjaCA9IHRoZUxpbmUubWF0Y2goRGV0YWlsSW5MaW5lKTtcbiAgICAgICAgaWYgKGxpbmVNYXRjaCkge1xuICAgICAgICAgICAgLy8gY29tcGFyZSB0byB0aGUgaW5kZXhcbiAgICAgICAgICAgIGxldCBuYW1lTWF0Y2ggPSBsaW5lTWF0Y2hbMV07XG4gICAgICAgICAgICBpZiAobmFtZU1hdGNoID09IGZvb3Rub3RlTmFtZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0N1cnNvclBvcyA9IHsgbGluZTogaSwgY2g6IGxpbmVNYXRjaFswXS5sZW5ndGggKyAxIH07XG4gICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZEp1bXBGcm9tTWFya2VyVG9EZXRhaWwoXG4gICAgbGluZVRleHQ6IHN0cmluZyxcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXG4gICAgZG9jOiBFZGl0b3IsXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxuKSB7XG4gICAgLy8gSnVtcCBjdXJzb3IgVE8gZGV0YWlsIG1hcmtlclxuXG4gICAgLy8gZG9lcyB0aGlzIGxpbmUgaGF2ZSBhIGZvb3Rub3RlIG1hcmtlcj9cbiAgICAvLyBkb2VzIHRoZSBjdXJzb3Igb3ZlcmxhcCB3aXRoIG9uZSBvZiB0aGVtP1xuICAgIC8vIGlmIHNvLCB3aGljaCBvbmU/XG4gICAgLy8gZmluZCB0aGlzIGZvb3Rub3RlIG1hcmtlcidzIGRldGFpbCBsaW5lXG4gICAgLy8gcGxhY2UgY3Vyc29yIHRoZXJlXG4gICAgbGV0IG1hcmtlclRhcmdldCA9IG51bGw7XG5cbiAgICBsZXQgRm9vdG5vdGVNYXJrZXJJbmZvID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVNYXJrZXJzQW5kTG9jYXRpb25zKGRvYyk7XG4gICAgbGV0IGN1cnJlbnRMaW5lID0gY3Vyc29yUG9zaXRpb24ubGluZTtcbiAgICBsZXQgZm9vdG5vdGVzT25MaW5lID0gRm9vdG5vdGVNYXJrZXJJbmZvLmZpbHRlcigobWFya2VyRW50cnk6IHsgbGluZU51bTogbnVtYmVyOyB9KSA9PiBtYXJrZXJFbnRyeS5saW5lTnVtID09PSBjdXJyZW50TGluZSk7XG5cbiAgICBpZiAoZm9vdG5vdGVzT25MaW5lICE9IG51bGwpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gZm9vdG5vdGVzT25MaW5lLmxlbmd0aC0xOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChmb290bm90ZXNPbkxpbmVbaV0uZm9vdG5vdGUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBsZXQgbWFya2VyID0gZm9vdG5vdGVzT25MaW5lW2ldLmZvb3Rub3RlO1xuICAgICAgICAgICAgICAgIGxldCBpbmRleE9mTWFya2VySW5MaW5lID0gZm9vdG5vdGVzT25MaW5lW2ldLnN0YXJ0SW5kZXg7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoID49IGluZGV4T2ZNYXJrZXJJbkxpbmUgJiZcbiAgICAgICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA8PSBpbmRleE9mTWFya2VySW5MaW5lICsgbWFya2VyLmxlbmd0aFxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIG1hcmtlclRhcmdldCA9IG1hcmtlcjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1hcmtlclRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBleHRyYWN0IG5hbWVcbiAgICAgICAgbGV0IG1hdGNoID0gbWFya2VyVGFyZ2V0Lm1hdGNoKEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlKTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICBsZXQgZm9vdG5vdGVOYW1lID0gbWF0Y2hbMl07XG5cbiAgICAgICAgICAgIC8vIG1hcmtlcnMgd2l0aG91dCBhIGRldGFpbCBsaW5lIGZhbGwgdGhyb3VnaCB0byB0aGVcbiAgICAgICAgICAgIC8vIGRldGFpbC1jcmVhdGlvbiBwYXRoc1xuICAgICAgICAgICAgbGV0IGRldGFpbHMgPSBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoZG9jKTtcbiAgICAgICAgICAgIGlmIChkZXRhaWxzID09PSBudWxsIHx8ICFkZXRhaWxzLmluY2x1ZGVzKGZvb3Rub3RlTmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luKSkge1xuICAgICAgICAgICAgICAgIG9wZW5Gb290bm90ZVBvcHVwKHBsdWdpbiwgZm9vdG5vdGVOYW1lLCAoKSA9PlxuICAgICAgICAgICAgICAgICAgICBqdW1wVG9Gb290bm90ZURldGFpbChmb290bm90ZU5hbWUsIGN1cnNvclBvc2l0aW9uLCBkb2MpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBqdW1wVG9Gb290bm90ZURldGFpbChmb290bm90ZU5hbWUsIGN1cnNvclBvc2l0aW9uLCBkb2MpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxuKTogc3RyaW5nIHtcbiAgICAvL2NoZWNrIGlmICdFbmFibGUgRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nJyBpcyB0cnVlXG4gICAgLy9pZiBzbywgcmV0dXJuIHRoZSBcIkZvb3Rub3RlIFNlY3Rpb24gSGVhZGluZ1wiXG4gICAgLy8gZWxzZSwgcmV0dXJuIFwiXCJcblxuICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9PSB0cnVlKSB7XG4gICAgICAgIGxldCByZXR1cm5IZWFkaW5nID0gcGx1Z2luLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmc7XG4gICAgICAgIC8vIHRoZSBzZXR0aW5nIGhvbGRzIGxpdGVyYWwgbWFya2Rvd24gKGxlZ2FjeSBwbGFpbi10ZXh0IHZhbHVlcyBhcmVcbiAgICAgICAgLy8gbWlncmF0ZWQgb24gbG9hZCk7IGEgZGl2aWRlciBkaXJlY3RseSBiZWxvdyBhIHRleHQgbGluZSB3b3VsZCB0dXJuXG4gICAgICAgIC8vIHRoYXQgbGluZSBpbnRvIGEgc2V0ZXh0IGhlYWRpbmcsIHNvIGtlZXAgYSBibGFuayBsaW5lIGluIGJldHdlZW5cbiAgICAgICAgY29uc3QgZGl2aWRlclJlZ2V4ID0gL14oLS0tfFxcKlxcKlxcKnxfX18pLztcbiAgICAgICAgaWYgKGRpdmlkZXJSZWdleC50ZXN0KHJldHVybkhlYWRpbmcpKSB7XG4gICAgICAgICAgICByZXR1cm4gYFxcblxcbiR7cmV0dXJuSGVhZGluZ31gO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBgXFxuJHtyZXR1cm5IZWFkaW5nfWA7XG4gICAgfVxuICAgIHJldHVybiBcIlwiO1xufVxuXG4vKiogYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB0byBpbnNlcnQgYSBmb290bm90ZSBvbmx5IGF0IHRoZSBlbmQgb2Ygd29yZCAqL1xuZnVuY3Rpb24gYWRqdXN0Rm9vdG5vdGVQb3NpdGlvbihcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXG4gICAgZG9jOiBFZGl0b3IsXG4gICAgbGluZVRleHQ6IHN0cmluZyxcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXG4pIHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZCkgcmV0dXJuIGN1cnNvclBvc2l0aW9uO1xuICAgIGNvbnN0IGVuZE9mV29yZFVuZGVyQ3Vyc29yID0gZG9jLndvcmRBdChjdXJzb3JQb3NpdGlvbik/LnRvO1xuICAgIGlmICghZW5kT2ZXb3JkVW5kZXJDdXJzb3IpIHJldHVybiBjdXJzb3JQb3NpdGlvbjsgLy8gbm8gd29yZCB1bmRlciBjdXJzb3JcblxuICAgIC8vIGFkanVzdCBjdXJzb3IgcG9zaXRpb24gdG8gaW5zZXJ0IGEgZm9vdG5vdGUgb25seSBhdCB0aGUgZW5kIG9mIHdvcmRcbiAgICBjb25zdCBuZXh0Q2hhciA9IGxpbmVUZXh0LmNoYXJBdChlbmRPZldvcmRVbmRlckN1cnNvci5jaCk7XG4gICAgaWYgKFtcIi5cIiwgXCIsXCIsIFwiOlwiLCBcIjtcIl0uaW5jbHVkZXMobmV4dENoYXIpKSBlbmRPZldvcmRVbmRlckN1cnNvci5jaCsrO1xuICAgIGN1cnNvclBvc2l0aW9uID0gZW5kT2ZXb3JkVW5kZXJDdXJzb3I7XG4gICAgcmV0dXJuIGN1cnNvclBvc2l0aW9uO1xufVxuXG4vL0ZVTkNUSU9OUyBGT1IgQVVUT05VTUJFUkVEIEZPT1ROT1RFU1xuXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0QXV0b251bUZvb3Rub3RlKHBsdWdpbjogRm9vdG5vdGVQbHVnaW4pIHtcbiAgICAvLyBwcmVzc2luZyB0aGUgaG90a2V5IHdoaWxlIHRoZSBwb3B1cCBlZGl0b3IgaXMgb3BlbiBjbG9zZXMgaXRcbiAgICBpZiAodG9nZ2xlQ2xvc2VGb290bm90ZVBvcHVwKCkpIHJldHVybjtcblxuICAgIGNvbnN0IG1kVmlldyA9IGFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuXG4gICAgaWYgKCFtZFZpZXcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAobWRWaWV3LmVkaXRvciA9PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IGRvYyA9IG1kVmlldy5lZGl0b3I7XG4gICAgY29uc3QgY3Vyc29yUG9zaXRpb24gPSBkb2MuZ2V0Q3Vyc29yKCk7XG4gICAgY29uc3QgbGluZVRleHQgPSBkb2MuZ2V0TGluZShjdXJzb3JQb3NpdGlvbi5saW5lKTtcbiAgICBjb25zdCBtYXJrZG93blRleHQgPSBtZFZpZXcuZGF0YTtcblxuICAgIGlmIChzaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jKSlcbiAgICAgICAgcmV0dXJuO1xuICAgIGlmIChzaG91bGRKdW1wRnJvbU1hcmtlclRvRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxuICAgICAgICByZXR1cm47XG5cbiAgICByZXR1cm4gc2hvdWxkQ3JlYXRlQXV0b251bUZvb3Rub3RlKFxuICAgICAgICBsaW5lVGV4dCxcbiAgICAgICAgY3Vyc29yUG9zaXRpb24sXG4gICAgICAgIHBsdWdpbixcbiAgICAgICAgZG9jLFxuICAgICAgICBtYXJrZG93blRleHRcbiAgICApO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDcmVhdGVBdXRvbnVtRm9vdG5vdGUoXG4gICAgbGluZVRleHQ6IHN0cmluZyxcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcbiAgICBkb2M6IEVkaXRvcixcbiAgICBtYXJrZG93blRleHQ6IHN0cmluZ1xuKSB7XG4gICAgY3Vyc29yUG9zaXRpb24gPSBhZGp1c3RGb290bm90ZVBvc2l0aW9uKGN1cnNvclBvc2l0aW9uLCBkb2MsIGxpbmVUZXh0LCBwbHVnaW4pO1xuXG4gICAgLy8gY3JlYXRlIG5ldyBmb290bm90ZSB3aXRoIHRoZSBuZXh0IG51bWVyaWNhbCBpbmRleFxuICAgIGxldCBtYXRjaGVzID0gbWFya2Rvd25UZXh0Lm1hdGNoKEFsbE51bWJlcmVkTWFya2Vycyk7XG4gICAgbGV0IG51bWJlcnM6IEFycmF5PG51bWJlcj4gPSBbXTtcbiAgICBsZXQgY3VycmVudE1heCA9IDE7XG5cbiAgICBpZiAobWF0Y2hlcyAhPSBudWxsKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IG1hdGNoZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgbWF0Y2ggPSBtYXRjaGVzW2ldO1xuICAgICAgICAgICAgbWF0Y2ggPSBtYXRjaC5yZXBsYWNlKFwiW15cIiwgXCJcIik7XG4gICAgICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoXCJdXCIsIFwiXCIpO1xuICAgICAgICAgICAgbGV0IG1hdGNoTnVtYmVyID0gTnVtYmVyKG1hdGNoKTtcbiAgICAgICAgICAgIG51bWJlcnNbaV0gPSBtYXRjaE51bWJlcjtcbiAgICAgICAgICAgIGlmIChtYXRjaE51bWJlciArIDEgPiBjdXJyZW50TWF4KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudE1heCA9IG1hdGNoTnVtYmVyICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxldCBmb290Tm90ZUlkID0gY3VycmVudE1heDtcbiAgICBsZXQgZm9vdG5vdGVNYXJrZXIgPSBgW14ke2Zvb3ROb3RlSWR9XWA7XG4gICAgbGV0IGxpbmVQYXJ0MSA9IGxpbmVUZXh0LnN1YnN0cigwLCBjdXJzb3JQb3NpdGlvbi5jaCk7XG4gICAgbGV0IGxpbmVQYXJ0MiA9IGxpbmVUZXh0LnN1YnN0cihjdXJzb3JQb3NpdGlvbi5jaCk7XG4gICAgbGV0IG5ld0xpbmUgPSBsaW5lUGFydDEgKyBmb290bm90ZU1hcmtlciArIGxpbmVQYXJ0MjtcblxuICAgIGRvYy5yZXBsYWNlUmFuZ2UoXG4gICAgICAgIG5ld0xpbmUsXG4gICAgICAgIHsgbGluZTogY3Vyc29yUG9zaXRpb24ubGluZSwgY2g6IDAgfSxcbiAgICAgICAgeyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogbGluZVRleHQubGVuZ3RoIH1cbiAgICApO1xuXG4gICAgbGV0IGxhc3RMaW5lSW5kZXggPSBkb2MubGFzdExpbmUoKTtcbiAgICBsZXQgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcblxuICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXMgPT09IHRydWUpIHtcbiAgICAgICAgd2hpbGUgKGxhc3RMaW5lSW5kZXggPiAwKSB7XG4gICAgICAgICAgICBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xuICAgICAgICAgICAgaWYgKGxhc3RMaW5lLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBkb2MucmVwbGFjZVJhbmdlKFxuICAgICAgICAgICAgICAgICAgICBcIlwiLFxuICAgICAgICAgICAgICAgICAgICB7IGxpbmU6IGxhc3RMaW5lSW5kZXgsIGNoOiAwIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiAwIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdExpbmVJbmRleC0tO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGZvb3Rub3RlRGV0YWlsID0gYFxcblteJHtmb290Tm90ZUlkfV06IGA7XG5cbiAgICBsZXQgbGlzdCA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhkb2MpO1xuICAgIFxuICAgIGxldCBuZXdDdXJzb3JQb3M6IEVkaXRvclBvc2l0aW9uO1xuICAgIGlmIChsaXN0PT09bnVsbCAmJiBjdXJyZW50TWF4ID09IDEpIHtcbiAgICAgICAgZm9vdG5vdGVEZXRhaWwgPSBcIlxcblwiICsgZm9vdG5vdGVEZXRhaWw7XG4gICAgICAgIGxldCBIZWFkaW5nID0gYWRkRm9vdG5vdGVTZWN0aW9uSGVhZGVyKHBsdWdpbik7XG4gICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIEhlYWRpbmcgKyBmb290bm90ZURldGFpbCk7XG4gICAgICAgIG5ld0N1cnNvclBvcyA9IHsgbGluZTogZG9jLmxhc3RMaW5lKCkgLSAxLCBjaDogZm9vdG5vdGVEZXRhaWwubGVuZ3RoIC0gMSB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZG9jLnNldExpbmUoZG9jLmxhc3RMaW5lKCksIGxhc3RMaW5lICsgZm9vdG5vdGVEZXRhaWwpO1xuICAgICAgICBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGRvYy5sYXN0TGluZSgpLCBjaDogZm9vdG5vdGVEZXRhaWwubGVuZ3RoIC0gMSB9XG4gICAgfVxuXG4gICAgaWYgKHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW4pKSB7XG4gICAgICAgIC8vIHR5cGUgdGhlIGRldGFpbCBpbiBhIHBvcHVwIGluc3RlYWQgb2YganVtcGluZyB0byB0aGUgYm90dG9tXG4gICAgICAgIGRvYy5zZXRDdXJzb3IoeyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogY3Vyc29yUG9zaXRpb24uY2ggKyBmb290bm90ZU1hcmtlci5sZW5ndGggfSk7XG4gICAgICAgIG9wZW5Gb290bm90ZVBvcHVwKHBsdWdpbiwgU3RyaW5nKGZvb3ROb3RlSWQpLCAoKSA9PlxuICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MpXG4gICAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MpXG4gICAgfVxufVxuXG5cbi8vRlVOQ1RJT05TIEZPUiBOQU1FRCBGT09UTk9URVNcblxuZXhwb3J0IGZ1bmN0aW9uIGluc2VydE5hbWVkRm9vdG5vdGUocGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xuICAgIC8vIHByZXNzaW5nIHRoZSBob3RrZXkgd2hpbGUgdGhlIHBvcHVwIGVkaXRvciBpcyBvcGVuIGNsb3NlcyBpdFxuICAgIGlmICh0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAoKSkgcmV0dXJuO1xuXG4gICAgY29uc3QgbWRWaWV3ID0gYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG5cbiAgICBpZiAoIW1kVmlldykgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChtZFZpZXcuZWRpdG9yID09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmVkaXRvcjtcbiAgICBjb25zdCBjdXJzb3JQb3NpdGlvbiA9IGRvYy5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lVGV4dCA9IGRvYy5nZXRMaW5lKGN1cnNvclBvc2l0aW9uLmxpbmUpO1xuICAgIGNvbnN0IG1hcmtkb3duVGV4dCA9IG1kVmlldy5kYXRhO1xuXG4gICAgaWYgKHNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MpKVxuICAgICAgICByZXR1cm47XG4gICAgaWYgKHNob3VsZEp1bXBGcm9tTWFya2VyVG9EZXRhaWwobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MsIHBsdWdpbikpXG4gICAgICAgIHJldHVybjtcblxuICAgIGlmIChzaG91bGRDcmVhdGVNYXRjaGluZ0Zvb3Rub3RlRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgcGx1Z2luLCBkb2MpKVxuICAgICAgICByZXR1cm47IFxuICAgIHJldHVybiBzaG91bGRDcmVhdGVGb290bm90ZU1hcmtlcihcbiAgICAgICAgbGluZVRleHQsXG4gICAgICAgIGN1cnNvclBvc2l0aW9uLFxuICAgICAgICBkb2MsXG4gICAgICAgIG1hcmtkb3duVGV4dCxcbiAgICAgICAgcGx1Z2luXG4gICAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZU1hdGNoaW5nRm9vdG5vdGVEZXRhaWwoXG4gICAgbGluZVRleHQ6IHN0cmluZyxcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcbiAgICBkb2M6IEVkaXRvclxuKSB7XG4gICAgLy8gQ3JlYXRlIG1hdGNoaW5nIGZvb3Rub3RlIGRldGFpbCBmb3IgZm9vdG5vdGUgbWFya2VyXG4gICAgXG4gICAgLy8gZG9lcyB0aGlzIGxpbmUgaGF2ZSBhIGZvb3Rub3RlIG1hcmtlcj9cbiAgICAvLyBkb2VzIHRoZSBjdXJzb3Igb3ZlcmxhcCB3aXRoIG9uZSBvZiB0aGVtP1xuICAgIC8vIGlmIHNvLCB3aGljaCBvbmU/XG4gICAgLy8gZG9lcyB0aGlzIGZvb3Rub3RlIG1hcmtlciBoYXZlIGEgZGV0YWlsIGxpbmU/XG4gICAgLy8gaWYgbm90LCBjcmVhdGUgaXQgYW5kIHBsYWNlIGN1cnNvciB0aGVyZVxuICAgIGxldCByZU9ubHlNYXJrZXJzTWF0Y2hlcyA9IGxpbmVUZXh0Lm1hdGNoKEFsbE1hcmtlcnMpO1xuXG4gICAgbGV0IG1hcmtlclRhcmdldCA9IG51bGw7XG5cbiAgICBpZiAocmVPbmx5TWFya2Vyc01hdGNoZXMpe1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSByZU9ubHlNYXJrZXJzTWF0Y2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IG1hcmtlciA9IHJlT25seU1hcmtlcnNNYXRjaGVzW2ldO1xuICAgICAgICAgICAgaWYgKG1hcmtlciAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXhPZk1hcmtlckluTGluZSA9IGxpbmVUZXh0LmluZGV4T2YobWFya2VyKTtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoID49IGluZGV4T2ZNYXJrZXJJbkxpbmUgJiZcbiAgICAgICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPD0gaW5kZXhPZk1hcmtlckluTGluZSArIG1hcmtlci5sZW5ndGhcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgbWFya2VyVGFyZ2V0ID0gbWFya2VyO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWFya2VyVGFyZ2V0ICE9IG51bGwpIHtcbiAgICAgICAgLy9leHRyYWN0IGZvb3Rub3RlXG4gICAgICAgIGxldCBtYXRjaCA9IG1hcmtlclRhcmdldC5tYXRjaChFeHRyYWN0TmFtZUZyb21Gb290bm90ZSlcbiAgICAgICAgLy9maW5kIGlmIHRoaXMgZm9vdG5vdGUgZXhpc3RzIGJ5IGxpc3RpbmcgZXhpc3RpbmcgZm9vdG5vdGUgZGV0YWlsc1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIGxldCBmb290bm90ZUlkID0gbWF0Y2hbMl07XG5cbiAgICAgICAgICAgIGxldCBsaXN0OiBzdHJpbmdbXSA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhkb2MpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgbGlzdCBpcyBlbXB0eSBPUiBpZiB0aGUgbGlzdCBkb2Vzbid0IGluY2x1ZGUgY3VycmVudCBmb290bm90ZVxuICAgICAgICAgICAgLy8gaWYgc28sIGFkZCBkZXRhaWwgZm9yIHRoZSBjdXJyZW50IGZvb3Rub3RlXG4gICAgICAgICAgICBpZihsaXN0ID09PSBudWxsIHx8ICFsaXN0LmluY2x1ZGVzKGZvb3Rub3RlSWQpKSB7XG4gICAgICAgICAgICAgICAgbGV0IGxhc3RMaW5lSW5kZXggPSBkb2MubGFzdExpbmUoKTtcbiAgICAgICAgICAgICAgICBsZXQgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcblxuICAgICAgICAgICAgICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXMgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGxhc3RMaW5lSW5kZXggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RMaW5lLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2MucmVwbGFjZVJhbmdlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxpbmU6IGxhc3RMaW5lSW5kZXgsIGNoOiAwIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiAwIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdExpbmVJbmRleC0tO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxldCBmb290bm90ZURldGFpbCA9IGBcXG5bXiR7Zm9vdG5vdGVJZH1dOiBgO1xuXG4gICAgICAgICAgICAgICAgbGV0IG5ld0N1cnNvclBvczogRWRpdG9yUG9zaXRpb247XG4gICAgICAgICAgICAgICAgaWYgKGxpc3Q9PT1udWxsIHx8IGxpc3QubGVuZ3RoIDwgMSkge1xuICAgICAgICAgICAgICAgICAgICBmb290bm90ZURldGFpbCA9IFwiXFxuXCIgKyBmb290bm90ZURldGFpbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IEhlYWRpbmcgPSBhZGRGb290bm90ZVNlY3Rpb25IZWFkZXIocGx1Z2luKTtcbiAgICAgICAgICAgICAgICAgICAgZG9jLnNldExpbmUoZG9jLmxhc3RMaW5lKCksIGxhc3RMaW5lICsgSGVhZGluZyArIGZvb3Rub3RlRGV0YWlsKTtcbiAgICAgICAgICAgICAgICAgICAgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBkb2MubGFzdExpbmUoKSAtIDEsIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkb2Muc2V0TGluZShkb2MubGFzdExpbmUoKSwgbGFzdExpbmUgKyBmb290bm90ZURldGFpbCk7XG4gICAgICAgICAgICAgICAgICAgIG5ld0N1cnNvclBvcyA9IHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocG9wdXBFZGl0aW5nQXZhaWxhYmxlKHBsdWdpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdHlwZSB0aGUgZGV0YWlsIGluIGEgcG9wdXAgaW5zdGVhZCBvZiBqdW1waW5nIHRvIHRoZSBib3R0b21cbiAgICAgICAgICAgICAgICAgICAgb3BlbkZvb3Rub3RlUG9wdXAocGx1Z2luLCBmb290bm90ZUlkLCAoKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MpXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47IFxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ3JlYXRlRm9vdG5vdGVNYXJrZXIoXG4gICAgbGluZVRleHQ6IHN0cmluZyxcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXG4gICAgZG9jOiBFZGl0b3IsXG4gICAgbWFya2Rvd25UZXh0OiBzdHJpbmcsXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxuKSB7XG4gICAgY3Vyc29yUG9zaXRpb24gPSBhZGp1c3RGb290bm90ZVBvc2l0aW9uKGN1cnNvclBvc2l0aW9uLCBkb2MsIGxpbmVUZXh0LCBwbHVnaW4pO1xuXG4gICAgLy9jcmVhdGUgZW1wdHkgZm9vdG5vdGUgbWFya2VyIGZvciBuYW1lIGlucHV0XG4gICAgbGV0IGVtcHR5TWFya2VyID0gYFteXWA7XG4gICAgZG9jLnJlcGxhY2VSYW5nZShlbXB0eU1hcmtlcixjdXJzb3JQb3NpdGlvbik7XG4gICAgLy9tb3ZlIGN1cnNvciBpbiBiZXR3ZWVuIFteIGFuZCBdXG4gICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogY3Vyc29yUG9zaXRpb24uY2ggKyAyIH1cbiAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcylcbiAgICAvL29wZW4gZm9vdG5vdGVQaWNrZXIgcG9wdXBcbiAgICBcbn1cbiIsImltcG9ydCB7XHJcbiAgYWRkSWNvbixcclxuICBNYXJrZG93blZpZXcsXHJcbiAgUGx1Z2luXHJcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5pbXBvcnQgeyBGb290bm90ZVBsdWdpblNldHRpbmdUYWIsIEZvb3Rub3RlUGx1Z2luU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xyXG5pbXBvcnQgeyBkaXNtaXNzRm9vdG5vdGVQb3B1cCB9IGZyb20gXCIuL2Zvb3Rub3RlLXBvcHVwXCI7XHJcbmltcG9ydCB7IGluc2VydEF1dG9udW1Gb290bm90ZSxpbnNlcnROYW1lZEZvb3Rub3RlIH0gZnJvbSBcIi4vaW5zZXJ0LW9yLW5hdmlnYXRlLWZvb3Rub3Rlc1wiO1xyXG5cclxuLy9BZGQgY2hldnJvbi11cC1zcXVhcmUgaWNvbiBmcm9tIGx1Y2lkZSBmb3IgbW9iaWxlIHRvb2xiYXIgKHRlbXBvcmFyeSB1bnRpbCBPYnNpZGlhbiB1cGRhdGVzIHRvIEx1Y2lkZSB2MC4xMzAuMClcclxuYWRkSWNvbihcImNoZXZyb24tdXAtc3F1YXJlXCIsIGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgY2xhc3M9XCJsdWNpZGUgbHVjaWRlLWNoZXZyb24tdXAtc3F1YXJlXCI+PHJlY3Qgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgeD1cIjNcIiB5PVwiM1wiIHJ4PVwiMlwiIHJ5PVwiMlwiPjwvcmVjdD48cG9seWxpbmUgcG9pbnRzPVwiOCwxNCAxMiwxMCAxNiwxNFwiPjwvcG9seWxpbmU+PC9zdmc+YCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBGb290bm90ZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcbiAgcHVibGljIHNldHRpbmdzOiBGb290bm90ZVBsdWdpblNldHRpbmdzO1xyXG5cclxuICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImluc2VydC1hdXRvbnVtYmVyZWQtZm9vdG5vdGVcIixcclxuICAgICAgbmFtZTogXCJJbnNlcnQgLyBOYXZpZ2F0ZSBBdXRvLU51bWJlcmVkIEZvb3Rub3RlXCIsXHJcbiAgICAgIGljb246IFwicGx1cy1zcXVhcmVcIixcclxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgaWYgKGNoZWNraW5nKVxyXG4gICAgICAgICAgcmV0dXJuICEhdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgICAgICBpbnNlcnRBdXRvbnVtRm9vdG5vdGUodGhpcyk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImluc2VydC1uYW1lZC1mb290bm90ZVwiLFxyXG4gICAgICBuYW1lOiBcIkluc2VydCAvIE5hdmlnYXRlIE5hbWVkIEZvb3Rub3RlXCIsXHJcbiAgICAgIGljb246IFwiY2hldnJvbi11cC1zcXVhcmVcIixcclxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgaWYgKGNoZWNraW5nKVxyXG4gICAgICAgICAgcmV0dXJuICEhdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgICAgICBpbnNlcnROYW1lZEZvb3Rub3RlKHRoaXMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICBcclxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgRm9vdG5vdGVQbHVnaW5TZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxyXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJhY3RpdmUtbGVhZi1jaGFuZ2VcIiwgKCkgPT4gZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBvbnVubG9hZCgpIHtcclxuICAgIGRpc21pc3NGb290bm90ZVBvcHVwKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XHJcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcclxuXHJcbiAgICAvLyBtaWdyYXRlIHByZS0xLjAuNCBzZWN0aW9uIGhlYWRpbmcgdmFsdWVzOiB0aGUgb2xkIHRleHQgaW5wdXQgaW1wbGllZFxyXG4gICAgLy8gYW4gSDEsIHRoZSB0ZXh0YXJlYSB0YWtlcyBsaXRlcmFsIG1hcmtkb3duLCBzbyBjb252ZXJ0IG9uY2UgYW5kIHNhdmVcclxuICAgIGNvbnN0IGhlYWRpbmcgPSB0aGlzLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmc7XHJcbiAgICBpZiAoaGVhZGluZyAmJiAhL14oI3sxLDZ9IHwtLS18XFwqXFwqXFwqfF9fXykvLnRlc3QoaGVhZGluZykpIHtcclxuICAgICAgdGhpcy5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nID0gYCMgJHtoZWFkaW5nfWA7XHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZHJvcCB0aGUgc2V0dGluZyBmb3IgdGhlIHJlbW92ZWQgYXV0b3N1Z2dlc3QgZmVhdHVyZSAoT2JzaWRpYW4gbm93XHJcbiAgICAvLyBzdWdnZXN0cyBmb290bm90ZXMgbmF0aXZlbHkpXHJcbiAgICBpZiAoXCJlbmFibGVBdXRvU3VnZ2VzdFwiIGluIHRoaXMuc2V0dGluZ3MpIHtcclxuICAgICAgZGVsZXRlICh0aGlzLnNldHRpbmdzIGFzIGFueSkuZW5hYmxlQXV0b1N1Z2dlc3Q7XHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gIH1cclxufSJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIk1hcmtkb3duVmlldyIsImFkZEljb24iLCJQbHVnaW4iXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBb0dBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUN0RyxRQUFRLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRTtBQUN0SCxRQUFRLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUM5RSxLQUFL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QUEsTUFBTSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDcEIsUUFBQSxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQzdCLFFBQUEsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUM7QUFDN0MsUUFBQSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQzs7QUFHdEMsUUFBQSxNQUFNLEVBQUUsR0FBSSxNQUFjLENBQUMsRUFBRSxDQUFDO1FBQzlCLE1BQU0sTUFBTSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDeEUsUUFBQSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQ2pELFFBQUEsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksR0FBRyxHQUFHLEVBQUUsR0FBRyxDQUFDLFVBQVUsR0FBRyxLQUFLLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM3RixRQUFBLElBQUksR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUM3QyxRQUFBLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsV0FBVyxFQUFFO1lBQzdCLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUN6RCxTQUFBO1FBRUQsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUks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
