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
    // Obsidian 1.13.0+ renders the tab from these definitions and skips
    // display(); controls bind to this.plugin.settings[key] and auto-save
    getSettingDefinitions() {
        return [
            {
                name: "Insert footnote at end of word",
                desc: "A new footnote is only inserted at the end of the word and after any punctuation.",
                control: { type: "toggle", key: "insertAtEndOfWord" },
            },
            {
                name: "Edit footnotes in a popup",
                desc: "Open the footnote detail in a small editor at your cursor instead of jumping to the bottom of the note. Close with the footnote hotkey, Escape, or by clicking outside.",
                control: { type: "toggle", key: "enablePopupEditor" },
            },
            {
                name: "Trim blank lines",
                desc: "Remove blank lines from the end of the note when inserting a new footnote section.",
                control: { type: "toggle", key: "enableRemoveBlankLastLines" },
            },
            {
                type: "group",
                heading: "Footnotes section",
                items: [
                    {
                        name: "Enable section heading",
                        desc: "Automatically adds a heading separating footnotes at the bottom of the note from the rest of the text.",
                        control: { type: "toggle", key: "enableFootnoteSectionHeading" },
                    },
                    {
                        name: "Section heading",
                        desc: "Heading to place above the footnotes section. Accepts standard markdown, including multiple lines and dividers.",
                        control: {
                            type: "textarea",
                            key: "FootnoteSectionHeading",
                            rows: 6,
                            placeholder: "Ex: '# Footnotes'",
                            disabled: () => !this.plugin.settings.enableFootnoteSectionHeading,
                        },
                    },
                ],
            },
        ];
    }
    // Obsidian < 1.13.0 falls back to this imperative implementation;
    // keep it in sync with getSettingDefinitions() above
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName("Insert footnote at end of word")
            .setDesc("A new footnote is only inserted at the end of the word and after any punctuation.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.insertAtEndOfWord)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.insertAtEndOfWord = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Edit footnotes in a popup")
            .setDesc("Open the footnote detail in a small editor at your cursor instead of jumping to the bottom of the note. Close with the footnote hotkey, Escape, or by clicking outside.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enablePopupEditor)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enablePopupEditor = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Trim blank lines")
            .setDesc("Remove blank lines from the end of the note when inserting a new footnote section.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enableRemoveBlankLastLines)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enableRemoveBlankLastLines = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Footnotes section")
            .setHeading();
        new obsidian.Setting(containerEl)
            .setName("Enable section heading")
            .setDesc("Automatically adds a heading separating footnotes at the bottom of the note from the rest of the text.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enableFootnoteSectionHeading)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enableFootnoteSectionHeading = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Section heading")
            .setDesc("Heading to place above the footnotes section. Accepts standard markdown, including multiple lines and dividers.")
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
        // a just-inserted detail is only indexed once the file saves — but
        // mdView.data lags a tick behind editor API changes, so saving too early
        // would write pre-insertion content to disk; wait for the buffer to
        // catch up first. Finishing the save (and its fold-state event) before
        // the embed exists also keeps it from reaching a half-initialized embed.
        const detailToken = `[^${footnoteId}]:`;
        const dataDeadline = Date.now() + 2000;
        while (!mdView.data.includes(detailToken) && Date.now() < dataDeadline) {
            yield new Promise((resolve) => setTimeout(resolve, 50));
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9mb290bm90ZS1wb3B1cC50cyIsInNyYy9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlLCBTdXBwcmVzc2VkRXJyb3IsIFN5bWJvbCwgSXRlcmF0b3IgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXNEZWNvcmF0ZShjdG9yLCBkZXNjcmlwdG9ySW4sIGRlY29yYXRvcnMsIGNvbnRleHRJbiwgaW5pdGlhbGl6ZXJzLCBleHRyYUluaXRpYWxpemVycykge1xyXG4gICAgZnVuY3Rpb24gYWNjZXB0KGYpIHsgaWYgKGYgIT09IHZvaWQgMCAmJiB0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRnVuY3Rpb24gZXhwZWN0ZWRcIik7IHJldHVybiBmOyB9XHJcbiAgICB2YXIga2luZCA9IGNvbnRleHRJbi5raW5kLCBrZXkgPSBraW5kID09PSBcImdldHRlclwiID8gXCJnZXRcIiA6IGtpbmQgPT09IFwic2V0dGVyXCIgPyBcInNldFwiIDogXCJ2YWx1ZVwiO1xyXG4gICAgdmFyIHRhcmdldCA9ICFkZXNjcmlwdG9ySW4gJiYgY3RvciA/IGNvbnRleHRJbltcInN0YXRpY1wiXSA/IGN0b3IgOiBjdG9yLnByb3RvdHlwZSA6IG51bGw7XHJcbiAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JJbiB8fCAodGFyZ2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGNvbnRleHRJbi5uYW1lKSA6IHt9KTtcclxuICAgIHZhciBfLCBkb25lID0gZmFsc2U7XHJcbiAgICBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4pIGNvbnRleHRbcF0gPSBwID09PSBcImFjY2Vzc1wiID8ge30gOiBjb250ZXh0SW5bcF07XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4uYWNjZXNzKSBjb250ZXh0LmFjY2Vzc1twXSA9IGNvbnRleHRJbi5hY2Nlc3NbcF07XHJcbiAgICAgICAgY29udGV4dC5hZGRJbml0aWFsaXplciA9IGZ1bmN0aW9uIChmKSB7IGlmIChkb25lKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFkZCBpbml0aWFsaXplcnMgYWZ0ZXIgZGVjb3JhdGlvbiBoYXMgY29tcGxldGVkXCIpOyBleHRyYUluaXRpYWxpemVycy5wdXNoKGFjY2VwdChmIHx8IG51bGwpKTsgfTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gKDAsIGRlY29yYXRvcnNbaV0pKGtpbmQgPT09IFwiYWNjZXNzb3JcIiA/IHsgZ2V0OiBkZXNjcmlwdG9yLmdldCwgc2V0OiBkZXNjcmlwdG9yLnNldCB9IDogZGVzY3JpcHRvcltrZXldLCBjb250ZXh0KTtcclxuICAgICAgICBpZiAoa2luZCA9PT0gXCJhY2Nlc3NvclwiKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHZvaWQgMCkgY29udGludWU7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZFwiKTtcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmdldCkpIGRlc2NyaXB0b3IuZ2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LnNldCkpIGRlc2NyaXB0b3Iuc2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmluaXQpKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoXyA9IGFjY2VwdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIGlmIChraW5kID09PSBcImZpZWxkXCIpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgICAgICBlbHNlIGRlc2NyaXB0b3Jba2V5XSA9IF87XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRhcmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgY29udGV4dEluLm5hbWUsIGRlc2NyaXB0b3IpO1xyXG4gICAgZG9uZSA9IHRydWU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19ydW5Jbml0aWFsaXplcnModGhpc0FyZywgaW5pdGlhbGl6ZXJzLCB2YWx1ZSkge1xyXG4gICAgdmFyIHVzZVZhbHVlID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRpYWxpemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhbHVlID0gdXNlVmFsdWUgPyBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnLCB2YWx1ZSkgOiBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1c2VWYWx1ZSA/IHZhbHVlIDogdm9pZCAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcHJvcEtleSh4KSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwic3ltYm9sXCIgPyB4IDogXCJcIi5jb25jYXQoeCk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zZXRGdW5jdGlvbk5hbWUoZiwgbmFtZSwgcHJlZml4KSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3ltYm9sXCIpIG5hbWUgPSBuYW1lLmRlc2NyaXB0aW9uID8gXCJbXCIuY29uY2F0KG5hbWUuZGVzY3JpcHRpb24sIFwiXVwiKSA6IFwiXCI7XHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGYsIFwibmFtZVwiLCB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHByZWZpeCA/IFwiXCIuY29uY2F0KHByZWZpeCwgXCIgXCIsIG5hbWUpIDogbmFtZSB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGcgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEl0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpO1xyXG4gICAgcmV0dXJuIGcubmV4dCA9IHZlcmIoMCksIGdbXCJ0aHJvd1wiXSA9IHZlcmIoMSksIGdbXCJyZXR1cm5cIl0gPSB2ZXJiKDIpLCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBBc3luY0l0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBBc3luY0l0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpLCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIsIGF3YWl0UmV0dXJuKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gYXdhaXRSZXR1cm4oZikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGYsIHJlamVjdCk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpZiAoZ1tuXSkgeyBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyBpZiAoZikgaVtuXSA9IGYoaVtuXSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IGZhbHNlIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbnZhciBvd25LZXlzID0gZnVuY3Rpb24obykge1xyXG4gICAgb3duS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIHx8IGZ1bmN0aW9uIChvKSB7XHJcbiAgICAgICAgdmFyIGFyID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgayBpbiBvKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIGspKSBhclthci5sZW5ndGhdID0gaztcclxuICAgICAgICByZXR1cm4gYXI7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIG93bktleXMobyk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayA9IG93bktleXMobW9kKSwgaSA9IDA7IGkgPCBrLmxlbmd0aDsgaSsrKSBpZiAoa1tpXSAhPT0gXCJkZWZhdWx0XCIpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwga1tpXSk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4oc3RhdGUsIHJlY2VpdmVyKSB7XHJcbiAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwgfHwgKHR5cGVvZiByZWNlaXZlciAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcmVjZWl2ZXIgIT09IFwiZnVuY3Rpb25cIikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgdXNlICdpbicgb3BlcmF0b3Igb24gbm9uLW9iamVjdFwiKTtcclxuICAgIHJldHVybiB0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyID09PSBzdGF0ZSA6IHN0YXRlLmhhcyhyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZShlbnYsIHZhbHVlLCBhc3luYykge1xyXG4gICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkLlwiKTtcclxuICAgICAgICB2YXIgZGlzcG9zZSwgaW5uZXI7XHJcbiAgICAgICAgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmFzeW5jRGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0Rpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmFzeW5jRGlzcG9zZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkaXNwb3NlID09PSB2b2lkIDApIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuZGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5kaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5kaXNwb3NlXTtcclxuICAgICAgICAgICAgaWYgKGFzeW5jKSBpbm5lciA9IGRpc3Bvc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2YgZGlzcG9zZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IG5vdCBkaXNwb3NhYmxlLlwiKTtcclxuICAgICAgICBpZiAoaW5uZXIpIGRpc3Bvc2UgPSBmdW5jdGlvbigpIHsgdHJ5IHsgaW5uZXIuY2FsbCh0aGlzKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7IH0gfTtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IHZhbHVlOiB2YWx1ZSwgZGlzcG9zZTogZGlzcG9zZSwgYXN5bmM6IGFzeW5jIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoYXN5bmMpIHtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IGFzeW5jOiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG5cclxufVxyXG5cclxudmFyIF9TdXBwcmVzc2VkRXJyb3IgPSB0eXBlb2YgU3VwcHJlc3NlZEVycm9yID09PSBcImZ1bmN0aW9uXCIgPyBTdXBwcmVzc2VkRXJyb3IgOiBmdW5jdGlvbiAoZXJyb3IsIHN1cHByZXNzZWQsIG1lc3NhZ2UpIHtcclxuICAgIHZhciBlID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xyXG4gICAgcmV0dXJuIGUubmFtZSA9IFwiU3VwcHJlc3NlZEVycm9yXCIsIGUuZXJyb3IgPSBlcnJvciwgZS5zdXBwcmVzc2VkID0gc3VwcHJlc3NlZCwgZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2Rpc3Bvc2VSZXNvdXJjZXMoZW52KSB7XHJcbiAgICBmdW5jdGlvbiBmYWlsKGUpIHtcclxuICAgICAgICBlbnYuZXJyb3IgPSBlbnYuaGFzRXJyb3IgPyBuZXcgX1N1cHByZXNzZWRFcnJvcihlLCBlbnYuZXJyb3IsIFwiQW4gZXJyb3Igd2FzIHN1cHByZXNzZWQgZHVyaW5nIGRpc3Bvc2FsLlwiKSA6IGU7XHJcbiAgICAgICAgZW52Lmhhc0Vycm9yID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIHZhciByLCBzID0gMDtcclxuICAgIGZ1bmN0aW9uIG5leHQoKSB7XHJcbiAgICAgICAgd2hpbGUgKHIgPSBlbnYuc3RhY2sucG9wKCkpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmICghci5hc3luYyAmJiBzID09PSAxKSByZXR1cm4gcyA9IDAsIGVudi5zdGFjay5wdXNoKHIpLCBQcm9taXNlLnJlc29sdmUoKS50aGVuKG5leHQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHIuZGlzcG9zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSByLmRpc3Bvc2UuY2FsbChyLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoci5hc3luYykgcmV0dXJuIHMgfD0gMiwgUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCkudGhlbihuZXh0LCBmdW5jdGlvbihlKSB7IGZhaWwoZSk7IHJldHVybiBuZXh0KCk7IH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBzIHw9IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIGZhaWwoZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHMgPT09IDEpIHJldHVybiBlbnYuaGFzRXJyb3IgPyBQcm9taXNlLnJlamVjdChlbnYuZXJyb3IpIDogUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgaWYgKGVudi5oYXNFcnJvcikgdGhyb3cgZW52LmVycm9yO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5leHQoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uKHBhdGgsIHByZXNlcnZlSnN4KSB7XHJcbiAgICBpZiAodHlwZW9mIHBhdGggPT09IFwic3RyaW5nXCIgJiYgL15cXC5cXC4/XFwvLy50ZXN0KHBhdGgpKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhdGgucmVwbGFjZSgvXFwuKHRzeCkkfCgoPzpcXC5kKT8pKCg/OlxcLlteLi9dKz8pPylcXC4oW2NtXT8pdHMkL2ksIGZ1bmN0aW9uIChtLCB0c3gsIGQsIGV4dCwgY20pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRzeCA/IHByZXNlcnZlSnN4ID8gXCIuanN4XCIgOiBcIi5qc1wiIDogZCAmJiAoIWV4dCB8fCAhY20pID8gbSA6IChkICsgZXh0ICsgXCIuXCIgKyBjbS50b0xvd2VyQ2FzZSgpICsgXCJqc1wiKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiBwYXRoO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBfX2V4dGVuZHM6IF9fZXh0ZW5kcyxcclxuICAgIF9fYXNzaWduOiBfX2Fzc2lnbixcclxuICAgIF9fcmVzdDogX19yZXN0LFxyXG4gICAgX19kZWNvcmF0ZTogX19kZWNvcmF0ZSxcclxuICAgIF9fcGFyYW06IF9fcGFyYW0sXHJcbiAgICBfX2VzRGVjb3JhdGU6IF9fZXNEZWNvcmF0ZSxcclxuICAgIF9fcnVuSW5pdGlhbGl6ZXJzOiBfX3J1bkluaXRpYWxpemVycyxcclxuICAgIF9fcHJvcEtleTogX19wcm9wS2V5LFxyXG4gICAgX19zZXRGdW5jdGlvbk5hbWU6IF9fc2V0RnVuY3Rpb25OYW1lLFxyXG4gICAgX19tZXRhZGF0YTogX19tZXRhZGF0YSxcclxuICAgIF9fYXdhaXRlcjogX19hd2FpdGVyLFxyXG4gICAgX19nZW5lcmF0b3I6IF9fZ2VuZXJhdG9yLFxyXG4gICAgX19jcmVhdGVCaW5kaW5nOiBfX2NyZWF0ZUJpbmRpbmcsXHJcbiAgICBfX2V4cG9ydFN0YXI6IF9fZXhwb3J0U3RhcixcclxuICAgIF9fdmFsdWVzOiBfX3ZhbHVlcyxcclxuICAgIF9fcmVhZDogX19yZWFkLFxyXG4gICAgX19zcHJlYWQ6IF9fc3ByZWFkLFxyXG4gICAgX19zcHJlYWRBcnJheXM6IF9fc3ByZWFkQXJyYXlzLFxyXG4gICAgX19zcHJlYWRBcnJheTogX19zcHJlYWRBcnJheSxcclxuICAgIF9fYXdhaXQ6IF9fYXdhaXQsXHJcbiAgICBfX2FzeW5jR2VuZXJhdG9yOiBfX2FzeW5jR2VuZXJhdG9yLFxyXG4gICAgX19hc3luY0RlbGVnYXRvcjogX19hc3luY0RlbGVnYXRvcixcclxuICAgIF9fYXN5bmNWYWx1ZXM6IF9fYXN5bmNWYWx1ZXMsXHJcbiAgICBfX21ha2VUZW1wbGF0ZU9iamVjdDogX19tYWtlVGVtcGxhdGVPYmplY3QsXHJcbiAgICBfX2ltcG9ydFN0YXI6IF9faW1wb3J0U3RhcixcclxuICAgIF9faW1wb3J0RGVmYXVsdDogX19pbXBvcnREZWZhdWx0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldDogX19jbGFzc1ByaXZhdGVGaWVsZEdldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRTZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkSW46IF9fY2xhc3NQcml2YXRlRmllbGRJbixcclxuICAgIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlOiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZSxcclxuICAgIF9fZGlzcG9zZVJlc291cmNlczogX19kaXNwb3NlUmVzb3VyY2VzLFxyXG4gICAgX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb246IF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uLFxyXG59O1xyXG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIFNldHRpbmdEZWZpbml0aW9uSXRlbSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBGb290bm90ZVBsdWdpblNldHRpbmdzIHtcclxuICAgIGluc2VydEF0RW5kT2ZXb3JkOiBib29sZWFuO1xyXG4gICAgZW5hYmxlUG9wdXBFZGl0b3I6IGJvb2xlYW47XHJcblxyXG4gICAgZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogYm9vbGVhbjtcclxuICAgIEZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IHN0cmluZztcclxuXHJcbiAgICBlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lczogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEZvb3Rub3RlUGx1Z2luU2V0dGluZ3MgPSB7XHJcbiAgICBpbnNlcnRBdEVuZE9mV29yZDogdHJ1ZSxcclxuICAgIGVuYWJsZVBvcHVwRWRpdG9yOiB0cnVlLFxyXG5cclxuICAgIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IGZhbHNlLFxyXG4gICAgRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogXCIjIEZvb3Rub3Rlc1wiLFxyXG5cclxuICAgIGVuYWJsZVJlbW92ZUJsYW5rTGFzdExpbmVzOiB0cnVlLFxyXG59O1xyXG5cclxuZXhwb3J0IGNsYXNzIEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xyXG4gICAgICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBPYnNpZGlhbiAxLjEzLjArIHJlbmRlcnMgdGhlIHRhYiBmcm9tIHRoZXNlIGRlZmluaXRpb25zIGFuZCBza2lwc1xyXG4gICAgLy8gZGlzcGxheSgpOyBjb250cm9scyBiaW5kIHRvIHRoaXMucGx1Z2luLnNldHRpbmdzW2tleV0gYW5kIGF1dG8tc2F2ZVxyXG4gICAgZ2V0U2V0dGluZ0RlZmluaXRpb25zKCk6IFNldHRpbmdEZWZpbml0aW9uSXRlbVtdIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiLFxyXG4gICAgICAgICAgICAgICAgZGVzYzogXCJBIG5ldyBmb290bm90ZSBpcyBvbmx5IGluc2VydGVkIGF0IHRoZSBlbmQgb2YgdGhlIHdvcmQgYW5kIGFmdGVyIGFueSBwdW5jdHVhdGlvbi5cIixcclxuICAgICAgICAgICAgICAgIGNvbnRyb2w6IHsgdHlwZTogXCJ0b2dnbGVcIiwga2V5OiBcImluc2VydEF0RW5kT2ZXb3JkXCIgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJFZGl0IGZvb3Rub3RlcyBpbiBhIHBvcHVwXCIsXHJcbiAgICAgICAgICAgICAgICBkZXNjOiBcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCBFc2NhcGUsIG9yIGJ5IGNsaWNraW5nIG91dHNpZGUuXCIsXHJcbiAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVQb3B1cEVkaXRvclwiIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IFwiVHJpbSBibGFuayBsaW5lc1wiLFxyXG4gICAgICAgICAgICAgICAgZGVzYzogXCJSZW1vdmUgYmxhbmsgbGluZXMgZnJvbSB0aGUgZW5kIG9mIHRoZSBub3RlIHdoZW4gaW5zZXJ0aW5nIGEgbmV3IGZvb3Rub3RlIHNlY3Rpb24uXCIsXHJcbiAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lc1wiIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiZ3JvdXBcIixcclxuICAgICAgICAgICAgICAgIGhlYWRpbmc6IFwiRm9vdG5vdGVzIHNlY3Rpb25cIixcclxuICAgICAgICAgICAgICAgIGl0ZW1zOiBbXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIkVuYWJsZSBzZWN0aW9uIGhlYWRpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzYzogXCJBdXRvbWF0aWNhbGx5IGFkZHMgYSBoZWFkaW5nIHNlcGFyYXRpbmcgZm9vdG5vdGVzIGF0IHRoZSBib3R0b20gb2YgdGhlIG5vdGUgZnJvbSB0aGUgcmVzdCBvZiB0aGUgdGV4dC5cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udHJvbDogeyB0eXBlOiBcInRvZ2dsZVwiLCBrZXk6IFwiZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZ1wiIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiU2VjdGlvbiBoZWFkaW5nXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2M6IFwiSGVhZGluZyB0byBwbGFjZSBhYm92ZSB0aGUgZm9vdG5vdGVzIHNlY3Rpb24uIEFjY2VwdHMgc3RhbmRhcmQgbWFya2Rvd24sIGluY2x1ZGluZyBtdWx0aXBsZSBsaW5lcyBhbmQgZGl2aWRlcnMuXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRyb2w6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwidGV4dGFyZWFcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleTogXCJGb290bm90ZVNlY3Rpb25IZWFkaW5nXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dzOiA2LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI6IFwiRXg6ICcjIEZvb3Rub3RlcydcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkOiAoKSA9PiAhdGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICBdO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIE9ic2lkaWFuIDwgMS4xMy4wIGZhbGxzIGJhY2sgdG8gdGhpcyBpbXBlcmF0aXZlIGltcGxlbWVudGF0aW9uO1xyXG4gICAgLy8ga2VlcCBpdCBpbiBzeW5jIHdpdGggZ2V0U2V0dGluZ0RlZmluaXRpb25zKCkgYWJvdmVcclxuICAgIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3Qge2NvbnRhaW5lckVsfSA9IHRoaXM7XHJcbiAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJJbnNlcnQgZm9vdG5vdGUgYXQgZW5kIG9mIHdvcmRcIilcclxuICAgICAgICAuc2V0RGVzYyhcIkEgbmV3IGZvb3Rub3RlIGlzIG9ubHkgaW5zZXJ0ZWQgYXQgdGhlIGVuZCBvZiB0aGUgd29yZCBhbmQgYWZ0ZXIgYW55IHB1bmN0dWF0aW9uLlwiKVxyXG4gICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICAgICAgdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5zZXJ0QXRFbmRPZldvcmQpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5zZXJ0QXRFbmRPZldvcmQgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJFZGl0IGZvb3Rub3RlcyBpbiBhIHBvcHVwXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJPcGVuIHRoZSBmb290bm90ZSBkZXRhaWwgaW4gYSBzbWFsbCBlZGl0b3IgYXQgeW91ciBjdXJzb3IgaW5zdGVhZCBvZiBqdW1waW5nIHRvIHRoZSBib3R0b20gb2YgdGhlIG5vdGUuIENsb3NlIHdpdGggdGhlIGZvb3Rub3RlIGhvdGtleSwgRXNjYXBlLCBvciBieSBjbGlja2luZyBvdXRzaWRlLlwiKVxyXG4gICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICAgICAgdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlUG9wdXBFZGl0b3IpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlUG9wdXBFZGl0b3IgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJUcmltIGJsYW5rIGxpbmVzXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJSZW1vdmUgYmxhbmsgbGluZXMgZnJvbSB0aGUgZW5kIG9mIHRoZSBub3RlIHdoZW4gaW5zZXJ0aW5nIGEgbmV3IGZvb3Rub3RlIHNlY3Rpb24uXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkZvb3Rub3RlcyBzZWN0aW9uXCIpXHJcbiAgICAgICAgLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJFbmFibGUgc2VjdGlvbiBoZWFkaW5nXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJBdXRvbWF0aWNhbGx5IGFkZHMgYSBoZWFkaW5nIHNlcGFyYXRpbmcgZm9vdG5vdGVzIGF0IHRoZSBib3R0b20gb2YgdGhlIG5vdGUgZnJvbSB0aGUgcmVzdCBvZiB0aGUgdGV4dC5cIilcclxuICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XHJcbiAgICAgICAgICAgIHRvZ2dsZVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmcpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIlNlY3Rpb24gaGVhZGluZ1wiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiSGVhZGluZyB0byBwbGFjZSBhYm92ZSB0aGUgZm9vdG5vdGVzIHNlY3Rpb24uIEFjY2VwdHMgc3RhbmRhcmQgbWFya2Rvd24sIGluY2x1ZGluZyBtdWx0aXBsZSBsaW5lcyBhbmQgZGl2aWRlcnMuXCIpXHJcbiAgICAgICAgLmFkZFRleHRBcmVhKCh0ZXh0KSA9PlxyXG4gICAgICAgICAgICB0ZXh0XHJcbiAgICAgICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJFeDogJyMgRm9vdG5vdGVzJ1wiKVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmcpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgIC50aGVuKCh0ZXh0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLndpZHRoID0gJzEwMCUnO1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHQuaW5wdXRFbC5yb3dzID0gNjtcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUucmVzaXplID0gJ25vbmUnO1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHQuaW5wdXRFbC5zdHlsZS5mb250RmFtaWx5ID0gJ21vbm9zcGFjZSc7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgTWFya2Rvd25WaWV3IH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xyXG5cclxuLy8gQSBzbWFsbCBwb3B1cCBhbmNob3JlZCBhdCB0aGUgY3Vyc29yIGNvbnRhaW5pbmcgT2JzaWRpYW4ncyBvd24gZWRpdGFibGVcclxuLy8gbWFya2Rvd24gZW1iZWQsIGJvdW5kIHRvIGp1c3QgdGhlIGZvb3Rub3RlJ3MgZGV0YWlsIHZpYSB0aGUgYCNbXmlkXWBcclxuLy8gc3VicGF0aCAodGhlIHNhbWUgbWFjaGluZXJ5IHRoZSBjb3JlIEZvb3Rub3RlcyB2aWV3IHVzZXMpLiBFZGl0aW5nIGluIHRoZVxyXG4vLyBwb3B1cCBzYXZlcyBzdHJhaWdodCBiYWNrIHRvIHRoZSBkZXRhaWwgbGluZSBhdCB0aGUgYm90dG9tIG9mIHRoZSBub3RlLFxyXG4vLyBzbyB0aGUgdXNlcidzIGN1cnNvciBuZXZlciBoYXMgdG8gbGVhdmUgdGhlIHRleHQuXHJcblxyXG50eXBlIEFjdGl2ZVBvcHVwID0ge1xyXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50O1xyXG4gICAgY2xvc2U6IChmb2N1c0VkaXRvcjogYm9vbGVhbikgPT4gdm9pZDtcclxufTtcclxuXHJcbmxldCBhY3RpdmVQb3B1cDogQWN0aXZlUG9wdXAgfCBudWxsID0gbnVsbDtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luOiBGb290bm90ZVBsdWdpbik6IGJvb2xlYW4ge1xyXG4gICAgLy8gZW1iZWRSZWdpc3RyeSBpcyB1bmRvY3VtZW50ZWQgQVBJLCBzbyBkZWdyYWRlIHRvIHRoZSBsZWdhY3lcclxuICAgIC8vIGp1bXAtdG8tYm90dG9tIGJlaGF2aW9yIGlmIGl0IGV2ZXIgY2hhbmdlcyBzaGFwZVxyXG4gICAgY29uc3QgcmVnaXN0cnkgPSAocGx1Z2luLmFwcCBhcyBhbnkpLmVtYmVkUmVnaXN0cnk7XHJcbiAgICByZXR1cm4gcGx1Z2luLnNldHRpbmdzLmVuYWJsZVBvcHVwRWRpdG9yID09PSB0cnVlXHJcbiAgICAgICAgJiYgdHlwZW9mIHJlZ2lzdHJ5Py5lbWJlZEJ5RXh0ZW5zaW9uPy5tZCA9PT0gXCJmdW5jdGlvblwiO1xyXG59XHJcblxyXG4vLyBDbG9zZSBmcm9tIHRoZSBmb290bm90ZSBob3RrZXk7IHJldHVybnMgd2hldGhlciBhIHBvcHVwIHdhcyBvcGVuLCBzbyB0aGVcclxuLy8gaG90a2V5IGNhbiB0b2dnbGUgdGhlIHBvcHVwIGluc3RlYWQgb2YgaW5zZXJ0aW5nIGFub3RoZXIgZm9vdG5vdGUuXHJcbmV4cG9ydCBmdW5jdGlvbiB0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoYWN0aXZlUG9wdXApIHtcclxuICAgICAgICBhY3RpdmVQb3B1cC5jbG9zZSh0cnVlKTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuLy8gQ2xvc2Ugd2l0aG91dCBzdGVhbGluZyBmb2N1cyAobGVhZiBzd2l0Y2hlZCwgcGx1Z2luIHVubG9hZGluZykuXHJcbmV4cG9ydCBmdW5jdGlvbiBkaXNtaXNzRm9vdG5vdGVQb3B1cCgpIHtcclxuICAgIGlmIChhY3RpdmVQb3B1cCkge1xyXG4gICAgICAgIGFjdGl2ZVBvcHVwLmNsb3NlKGZhbHNlKTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5Gb290bm90ZVBvcHVwKFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcclxuICAgIGZvb3Rub3RlSWQ6IHN0cmluZyxcclxuICAgIG9uVW5hdmFpbGFibGU/OiAoKSA9PiB2b2lkLFxyXG4pIHtcclxuICAgIGRpc21pc3NGb290bm90ZVBvcHVwKCk7XHJcblxyXG4gICAgY29uc3QgbWRWaWV3ID0gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgaWYgKCFtZFZpZXcgfHwgIW1kVmlldy5maWxlKSByZXR1cm47XHJcblxyXG4gICAgLy8gYSBqdXN0LWluc2VydGVkIGRldGFpbCBpcyBvbmx5IGluZGV4ZWQgb25jZSB0aGUgZmlsZSBzYXZlcyDigJQgYnV0XHJcbiAgICAvLyBtZFZpZXcuZGF0YSBsYWdzIGEgdGljayBiZWhpbmQgZWRpdG9yIEFQSSBjaGFuZ2VzLCBzbyBzYXZpbmcgdG9vIGVhcmx5XHJcbiAgICAvLyB3b3VsZCB3cml0ZSBwcmUtaW5zZXJ0aW9uIGNvbnRlbnQgdG8gZGlzazsgd2FpdCBmb3IgdGhlIGJ1ZmZlciB0b1xyXG4gICAgLy8gY2F0Y2ggdXAgZmlyc3QuIEZpbmlzaGluZyB0aGUgc2F2ZSAoYW5kIGl0cyBmb2xkLXN0YXRlIGV2ZW50KSBiZWZvcmVcclxuICAgIC8vIHRoZSBlbWJlZCBleGlzdHMgYWxzbyBrZWVwcyBpdCBmcm9tIHJlYWNoaW5nIGEgaGFsZi1pbml0aWFsaXplZCBlbWJlZC5cclxuICAgIGNvbnN0IGRldGFpbFRva2VuID0gYFteJHtmb290bm90ZUlkfV06YDtcclxuICAgIGNvbnN0IGRhdGFEZWFkbGluZSA9IERhdGUubm93KCkgKyAyMDAwO1xyXG4gICAgd2hpbGUgKCFtZFZpZXcuZGF0YS5pbmNsdWRlcyhkZXRhaWxUb2tlbikgJiYgRGF0ZS5ub3coKSA8IGRhdGFEZWFkbGluZSkge1xyXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDUwKSk7XHJcbiAgICB9XHJcbiAgICBhd2FpdCBtZFZpZXcuc2F2ZSgpO1xyXG4gICAgY29uc3QgZWRpdG9yID0gbWRWaWV3LmVkaXRvcjtcclxuICAgIGNvbnN0IGRvYyA9IG1kVmlldy5jb250YWluZXJFbC5vd25lckRvY3VtZW50O1xyXG4gICAgY29uc3Qgd2luID0gZG9jLmRlZmF1bHRWaWV3IHx8IHdpbmRvdztcclxuXHJcbiAgICAvLyBhbmNob3IganVzdCBiZWxvdyB0aGUgY3Vyc29yLCBmbGlwcGluZyBhYm92ZSBpdCBuZWFyIHRoZSB3aW5kb3cgYm90dG9tXHJcbiAgICBjb25zdCBjbSA9IChlZGl0b3IgYXMgYW55KS5jbTtcclxuICAgIGNvbnN0IGNvb3JkcyA9IGNtID8gY20uY29vcmRzQXRQb3MoY20uc3RhdGUuc2VsZWN0aW9uLm1haW4uaGVhZCkgOiBudWxsO1xyXG4gICAgY29uc3Qgd2lkdGggPSBNYXRoLm1pbig0ODAsIHdpbi5pbm5lcldpZHRoIC0gMzIpO1xyXG4gICAgY29uc3QgbGVmdCA9IE1hdGgubWF4KDE2LCBNYXRoLm1pbihjb29yZHMgPyBjb29yZHMubGVmdCA6IDEwMCwgd2luLmlubmVyV2lkdGggLSB3aWR0aCAtIDE2KSk7XHJcbiAgICBsZXQgdG9wID0gKGNvb3JkcyA/IGNvb3Jkcy5ib3R0b20gOiAxMDApICsgNjtcclxuICAgIGlmICh0b3AgKyAyNjAgPiB3aW4uaW5uZXJIZWlnaHQpIHtcclxuICAgICAgICB0b3AgPSBNYXRoLm1heCgxNiwgKGNvb3JkcyA/IGNvb3Jkcy50b3AgOiAzMDApIC0gMjY2KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb250YWluZXJFbCA9IGRvYy5ib2R5LmNyZWF0ZURpdihcImZvb3Rub3RlLXNob3J0Y3V0LXBvcHVwXCIpO1xyXG4gICAgY29udGFpbmVyRWwuc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xyXG4gICAgY29udGFpbmVyRWwuc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcclxuICAgIGNvbnRhaW5lckVsLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xyXG4gICAgLy8gc3RheSBpbnZpc2libGUgdW50aWwgdGhlIGZvb3Rub3RlIGRldGFpbCBpcyBhY3R1YWxseSBsb2FkZWRcclxuICAgIGNvbnRhaW5lckVsLnN0eWxlLnZpc2liaWxpdHkgPSBcImhpZGRlblwiO1xyXG5cclxuICAgIGNvbnN0IHN1YnBhdGggPSBgI1teJHtmb290bm90ZUlkfV1gO1xyXG4gICAgY29uc3QgYnVpbGRFbWJlZCA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCBidWlsdCA9IChwbHVnaW4uYXBwIGFzIGFueSkuZW1iZWRSZWdpc3RyeS5lbWJlZEJ5RXh0ZW5zaW9uLm1kKFxyXG4gICAgICAgICAgICB7IGFwcDogcGx1Z2luLmFwcCwgbGlua3RleHQ6IHN1YnBhdGgsIHNvdXJjZVBhdGg6IG1kVmlldy5maWxlLnBhdGgsIGNvbnRhaW5lckVsOiBjb250YWluZXJFbCwgZGVwdGg6IDAgfSxcclxuICAgICAgICAgICAgbWRWaWV3LmZpbGUsXHJcbiAgICAgICAgICAgIHN1YnBhdGgsXHJcbiAgICAgICAgKTtcclxuICAgICAgICBidWlsdC5lZGl0YWJsZSA9IHRydWU7XHJcbiAgICAgICAgYnVpbHQubG9hZCgpO1xyXG4gICAgICAgIHJldHVybiBidWlsdDtcclxuICAgIH07XHJcbiAgICBsZXQgZW1iZWQgPSBidWlsZEVtYmVkKCk7XHJcblxyXG4gICAgbGV0IGNsb3NlZCA9IGZhbHNlO1xyXG4gICAgY29uc3QgY2xvc2UgPSAoZm9jdXNFZGl0b3I6IGJvb2xlYW4pID0+IHtcclxuICAgICAgICBpZiAoY2xvc2VkKSByZXR1cm47XHJcbiAgICAgICAgY2xvc2VkID0gdHJ1ZTtcclxuICAgICAgICBhY3RpdmVQb3B1cCA9IG51bGw7XHJcbiAgICAgICAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgb25Eb2NNb3VzZURvd24sIHRydWUpO1xyXG4gICAgICAgIGNvbnRhaW5lckVsLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICAgICAgICBpZiAoZm9jdXNFZGl0b3IpIGVkaXRvci5mb2N1cygpO1xyXG5cclxuICAgICAgICAvLyB0aGUgZW1iZWQgc2F2ZXMgZWRpdHMgb24gaXRzIG93biBkZWJvdW5jZTsgbGV0IHRoYXQgY3ljbGUgZmluaXNoXHJcbiAgICAgICAgLy8gYmVmb3JlIHVubG9hZGluZywgc2luY2UgdW5sb2FkaW5nIG1pZC1zYXZlIGNsZWFycyB0aGUgc3RhdGUgdGhlXHJcbiAgICAgICAgLy8gc2F2ZSByZWFkc1xyXG4gICAgICAgIGxldCBhdHRlbXB0cyA9IDA7XHJcbiAgICAgICAgY29uc3QgdGVhcmRvd24gPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICgoZW1iZWQuZGlydHkgfHwgZW1iZWQuc2F2aW5nIHx8IGVtYmVkLnNhdmVBZ2FpbikgJiYgYXR0ZW1wdHMrKyA8IDUwKSB7XHJcbiAgICAgICAgICAgICAgICB3aW4uc2V0VGltZW91dCh0ZWFyZG93biwgMTAwKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbWJlZC51bmxvYWQoKTtcclxuICAgICAgICAgICAgY29udGFpbmVyRWwucmVtb3ZlKCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICB0ZWFyZG93bigpO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBvbkRvY01vdXNlRG93biA9IChldnQ6IE1vdXNlRXZlbnQpID0+IHtcclxuICAgICAgICBpZiAoIWNvbnRhaW5lckVsLmNvbnRhaW5zKGV2dC50YXJnZXQgYXMgTm9kZSkpIGNsb3NlKGZhbHNlKTtcclxuICAgIH07XHJcbiAgICBkb2MuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBvbkRvY01vdXNlRG93biwgdHJ1ZSk7XHJcblxyXG4gICAgLy8gYnViYmxlIHBoYXNlLCBzbyB0aGUgZW1iZWRkZWQgZWRpdG9yIChlLmcuIHZpbSBtb2RlIGxlYXZpbmcgaW5zZXJ0XHJcbiAgICAvLyBtb2RlKSBnZXRzIGZpcnN0IGNsYWltIG9uIEVzY2FwZVxyXG4gICAgY29udGFpbmVyRWwuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2dDogS2V5Ym9hcmRFdmVudCkgPT4ge1xyXG4gICAgICAgIGlmIChldnQua2V5ID09PSBcIkVzY2FwZVwiKSB7XHJcbiAgICAgICAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBjbG9zZSh0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBhY3RpdmVQb3B1cCA9IHsgY29udGFpbmVyRWwsIGNsb3NlIH07XHJcblxyXG4gICAgY29uc3QgdHJ5U2hvdyA9IGFzeW5jICgpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcclxuICAgICAgICBhd2FpdCBlbWJlZC5sb2FkRmlsZSgpO1xyXG4gICAgICAgIGlmIChlbWJlZC5zdWJwYXRoTm90Rm91bmQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb250YWluZXJFbC5zdHlsZS52aXNpYmlsaXR5ID0gXCJcIjtcclxuICAgICAgICBlbWJlZC5zaG93RWRpdG9yKCk7XHJcbiAgICAgICAgZW1iZWQuZWRpdE1vZGU/LmVkaXRvcj8uZm9jdXMoKTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3Qgd2FpdEZvckNhY2hlQ2hhbmdlID0gKCkgPT5cclxuICAgICAgICBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB0aW1lb3V0ID0gd2luLnNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLm9mZnJlZihyZWYpO1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9LCA1MDApO1xyXG4gICAgICAgICAgICBjb25zdCByZWYgPSBwbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZmlsZSA9PT0gbWRWaWV3LmZpbGUpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW4uY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5vZmZyZWYocmVmKTtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHNob3dFZGl0b3IgPSBhc3luYyAoKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XHJcbiAgICAgICAgaWYgKGF3YWl0IHRyeVNob3coKSkgcmV0dXJuIHRydWU7XHJcblxyXG4gICAgICAgIC8vIHJldHJ5IGFzIHRoZSBtZXRhZGF0YSBjYWNoZSBjYXRjaGVzIHVwIHdpdGggdGhlIHNhdmVkIGZpbGU7IGFcclxuICAgICAgICAvLyBsb2FkZWQgZW1iZWQgd29uJ3QgcmUtcmVzb2x2ZSBpdHMgc3VicGF0aCwgc28gcmVidWlsZCBlYWNoIHRpbWVcclxuICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyAzMDAwO1xyXG4gICAgICAgIHdoaWxlIChEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcclxuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckNhY2hlQ2hhbmdlKCk7XHJcbiAgICAgICAgICAgIGlmIChjbG9zZWQpIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICBlbWJlZC51bmxvYWQoKTtcclxuICAgICAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuICAgICAgICAgICAgZW1iZWQgPSBidWlsZEVtYmVkKCk7XHJcbiAgICAgICAgICAgIGlmIChhd2FpdCB0cnlTaG93KCkpIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG5cclxuICAgIHNob3dFZGl0b3IoKVxyXG4gICAgICAgIC50aGVuKChzaG93bikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIXNob3duICYmICFjbG9zZWQpIHtcclxuICAgICAgICAgICAgICAgIGNsb3NlKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIG9uVW5hdmFpbGFibGU/LigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2goKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWNsb3NlZCkge1xyXG4gICAgICAgICAgICAgICAgY2xvc2UoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgb25VbmF2YWlsYWJsZT8uKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxufVxyXG4iLCJpbXBvcnQge1xyXG5cdEVkaXRvcixcclxuXHRFZGl0b3JQb3NpdGlvbixcclxuXHRNYXJrZG93blZpZXdcclxufSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmltcG9ydCBGb290bm90ZVBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcbmltcG9ydCB7IG9wZW5Gb290bm90ZVBvcHVwLCBwb3B1cEVkaXRpbmdBdmFpbGFibGUsIHRvZ2dsZUNsb3NlRm9vdG5vdGVQb3B1cCB9IGZyb20gXCIuL2Zvb3Rub3RlLXBvcHVwXCI7XHJcblxyXG5leHBvcnQgdmFyIEFsbE1hcmtlcnMgPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdKD8hOikvZGc7XHJcbnZhciBBbGxOdW1iZXJlZE1hcmtlcnMgPSAvXFxbXFxeKFxcZCspXFxdL2dpO1xyXG52YXIgQWxsRGV0YWlsc05hbWVPbmx5ID0gL1xcW1xcXihbXlxcW1xcXV0rKVxcXTovZztcclxudmFyIERldGFpbEluTGluZSA9IC9cXFtcXF4oW15cXFtcXF1dKylcXF06LztcclxuZXhwb3J0IHZhciBFeHRyYWN0TmFtZUZyb21Gb290bm90ZSA9IC8oXFxbXFxeKShbXlxcW1xcXV0rKSg/PVxcXSkvO1xyXG5cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoXHJcbiAgICBkb2M6IEVkaXRvclxyXG4pIHtcclxuICAgIGxldCBGb290bm90ZURldGFpbExpc3Q6IHN0cmluZ1tdID0gW107XHJcbiAgICBcclxuICAgIC8vc2VhcmNoIGVhY2ggbGluZSBmb3IgZm9vdG5vdGUgZGV0YWlscyBhbmQgYWRkIHRvIGxpc3RcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xyXG4gICAgICAgIGxldCBsaW5lTWF0Y2ggPSB0aGVMaW5lLm1hdGNoKEFsbERldGFpbHNOYW1lT25seSk7XHJcbiAgICAgICAgaWYgKGxpbmVNYXRjaCkge1xyXG4gICAgICAgICAgICBsZXQgdGVtcCA9IGxpbmVNYXRjaFswXTtcclxuICAgICAgICAgICAgdGVtcCA9IHRlbXAucmVwbGFjZShcIlteXCIsXCJcIik7XHJcbiAgICAgICAgICAgIHRlbXAgPSB0ZW1wLnJlcGxhY2UoXCJdOlwiLFwiXCIpO1xyXG5cclxuICAgICAgICAgICAgRm9vdG5vdGVEZXRhaWxMaXN0LnB1c2godGVtcCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKEZvb3Rub3RlRGV0YWlsTGlzdC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgcmV0dXJuIEZvb3Rub3RlRGV0YWlsTGlzdDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsaXN0RXhpc3RpbmdGb290bm90ZU1hcmtlcnNBbmRMb2NhdGlvbnMoXHJcbiAgICBkb2M6IEVkaXRvclxyXG4pIHtcclxuICAgIHR5cGUgbWFya2VyRW50cnkgPSB7XHJcbiAgICAgICAgZm9vdG5vdGU6IHN0cmluZztcclxuICAgICAgICBsaW5lTnVtOiBudW1iZXI7XHJcbiAgICAgICAgc3RhcnRJbmRleDogbnVtYmVyO1xyXG4gICAgfVxyXG4gICAgbGV0IG1hcmtlckVudHJ5O1xyXG5cclxuICAgIGxldCBGb290bm90ZU1hcmtlckluZm8gPSBbXTtcclxuICAgIC8vc2VhcmNoIGVhY2ggbGluZSBmb3IgZm9vdG5vdGUgbWFya2Vyc1xyXG4gICAgLy9mb3IgZWFjaCwgYWRkIHRoZWlyIG5hbWUsIGxpbmUgbnVtYmVyLCBhbmQgc3RhcnQgaW5kZXggdG8gRm9vdG5vdGVNYXJrZXJJbmZvXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XHJcbiAgICAgICAgbGV0IHRoZUxpbmUgPSBkb2MuZ2V0TGluZShpKTtcclxuICAgICAgICBsZXQgbGluZU1hdGNoO1xyXG5cclxuICAgICAgICB3aGlsZSAoKGxpbmVNYXRjaCA9IEFsbE1hcmtlcnMuZXhlYyh0aGVMaW5lKSkgIT0gbnVsbCkge1xyXG4gICAgICAgIG1hcmtlckVudHJ5ID0ge1xyXG4gICAgICAgICAgICBmb290bm90ZTogbGluZU1hdGNoWzBdLFxyXG4gICAgICAgICAgICBsaW5lTnVtOiBpLFxyXG4gICAgICAgICAgICBzdGFydEluZGV4OiBsaW5lTWF0Y2guaW5kZXhcclxuICAgICAgICB9XHJcbiAgICAgICAgRm9vdG5vdGVNYXJrZXJJbmZvLnB1c2gobWFya2VyRW50cnkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBGb290bm90ZU1hcmtlckluZm87XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoXHJcbiAgICBkb2M6IEVkaXRvcixcclxuICAgIG9sZEN1cnNvclBvczogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBuZXdDdXJzb3JQb3M6IEVkaXRvclBvc2l0aW9uLFxyXG4pOiB2b2lkIHtcclxuICAgIGRvYy5zZXRDdXJzb3IobmV3Q3Vyc29yUG9zKTtcclxuXHJcbiAgICAvLyBpZiB1c2VyIGhhcyB2aW0gbW9kZSBlbmFibGVkLCBzZXQganVtcCBwb2ludFxyXG4gICAgaWYgKGFwcC52YXVsdC5nZXRDb25maWcoXCJ2aW1Nb2RlXCIpKSB7XHJcbiAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxyXG4gICAgICAgIGFjdGl2ZVdpbmRvdy5Db2RlTWlycm9yQWRhcHRlci5WaW0uZ2V0VmltR2xvYmFsU3RhdGVfKCkuanVtcExpc3QuYWRkKFxyXG4gICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXHJcbiAgICAgICAgICAgIGRvYy5jbS5jbSwgLy8gU0lDIHR3byBsZXZlbHMgZGVlcFxyXG4gICAgICAgICAgICBvbGRDdXJzb3JQb3MsXHJcbiAgICAgICAgICAgIG5ld0N1cnNvclBvcyxcclxuICAgICAgICApO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkSnVtcEZyb21EZXRhaWxUb01hcmtlcihcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBkb2M6IEVkaXRvclxyXG4pIHtcclxuICAgIC8vIGNoZWNrIGlmIHdlJ3JlIGluIGEgZm9vdG5vdGUgZGV0YWlsIGxpbmUgKFwiW14xXTogZm9vdG5vdGVcIilcclxuICAgIC8vIGlmIHNvLCBqdW1wIGN1cnNvciBiYWNrIHRvIHRoZSBmb290bm90ZSBpbiB0aGUgdGV4dFxyXG5cclxuICAgIGxldCBtYXRjaCA9IGxpbmVUZXh0Lm1hdGNoKERldGFpbEluTGluZSk7XHJcbiAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICBsZXQgcyA9IG1hdGNoWzBdO1xyXG4gICAgICAgIGxldCBpbmRleCA9IHMucmVwbGFjZShcIlteXCIsIFwiXCIpO1xyXG4gICAgICAgIGluZGV4ID0gaW5kZXgucmVwbGFjZShcIl06XCIsIFwiXCIpO1xyXG4gICAgICAgIGxldCBmb290bm90ZSA9IHMucmVwbGFjZShcIjpcIiwgXCJcIik7XHJcblxyXG4gICAgICAgIGxldCByZXR1cm5MaW5lSW5kZXggPSBjdXJzb3JQb3NpdGlvbi5saW5lO1xyXG4gICAgICAgIC8vIGZpbmQgdGhlIEZJUlNUIE9DQ1VSRU5DRSB3aGVyZSB0aGlzIGZvb3Rub3RlIGV4aXN0cyBpbiB0aGUgdGV4dFxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IHNjYW5MaW5lID0gZG9jLmdldExpbmUoaSk7XHJcbiAgICAgICAgICAgIGlmIChzY2FuTGluZS5jb250YWlucyhmb290bm90ZSkpIHtcclxuICAgICAgICAgICAgICAgIGxldCBjdXJzb3JMb2NhdGlvbkluZGV4ID0gc2NhbkxpbmUuaW5kZXhPZihmb290bm90ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm5MaW5lSW5kZXggPSBpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiByZXR1cm5MaW5lSW5kZXgsIGNoOiBjdXJzb3JMb2NhdGlvbkluZGV4ICsgZm9vdG5vdGUubGVuZ3RoIH07XHJcbiAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGp1bXBUb0Zvb3Rub3RlRGV0YWlsKFxyXG4gICAgZm9vdG5vdGVOYW1lOiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBkb2M6IEVkaXRvclxyXG4pIHtcclxuICAgIC8vIGZpbmQgdGhlIGZpcnN0IGxpbmUgd2l0aCB0aGlzIGRldGFpbCBtYXJrZXIgbmFtZSBpbiBpdC5cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xyXG4gICAgICAgIGxldCBsaW5lTWF0Y2ggPSB0aGVMaW5lLm1hdGNoKERldGFpbEluTGluZSk7XHJcbiAgICAgICAgaWYgKGxpbmVNYXRjaCkge1xyXG4gICAgICAgICAgICAvLyBjb21wYXJlIHRvIHRoZSBpbmRleFxyXG4gICAgICAgICAgICBsZXQgbmFtZU1hdGNoID0gbGluZU1hdGNoWzFdO1xyXG4gICAgICAgICAgICBpZiAobmFtZU1hdGNoID09IGZvb3Rub3RlTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBpLCBjaDogbGluZU1hdGNoWzBdLmxlbmd0aCArIDEgfTtcclxuICAgICAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBkb2M6IEVkaXRvcixcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW5cclxuKSB7XHJcbiAgICAvLyBKdW1wIGN1cnNvciBUTyBkZXRhaWwgbWFya2VyXHJcblxyXG4gICAgLy8gZG9lcyB0aGlzIGxpbmUgaGF2ZSBhIGZvb3Rub3RlIG1hcmtlcj9cclxuICAgIC8vIGRvZXMgdGhlIGN1cnNvciBvdmVybGFwIHdpdGggb25lIG9mIHRoZW0/XHJcbiAgICAvLyBpZiBzbywgd2hpY2ggb25lP1xyXG4gICAgLy8gZmluZCB0aGlzIGZvb3Rub3RlIG1hcmtlcidzIGRldGFpbCBsaW5lXHJcbiAgICAvLyBwbGFjZSBjdXJzb3IgdGhlcmVcclxuICAgIGxldCBtYXJrZXJUYXJnZXQgPSBudWxsO1xyXG5cclxuICAgIGxldCBGb290bm90ZU1hcmtlckluZm8gPSBsaXN0RXhpc3RpbmdGb290bm90ZU1hcmtlcnNBbmRMb2NhdGlvbnMoZG9jKTtcclxuICAgIGxldCBjdXJyZW50TGluZSA9IGN1cnNvclBvc2l0aW9uLmxpbmU7XHJcbiAgICBsZXQgZm9vdG5vdGVzT25MaW5lID0gRm9vdG5vdGVNYXJrZXJJbmZvLmZpbHRlcigobWFya2VyRW50cnk6IHsgbGluZU51bTogbnVtYmVyOyB9KSA9PiBtYXJrZXJFbnRyeS5saW5lTnVtID09PSBjdXJyZW50TGluZSk7XHJcblxyXG4gICAgaWYgKGZvb3Rub3Rlc09uTGluZSAhPSBudWxsKSB7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gZm9vdG5vdGVzT25MaW5lLmxlbmd0aC0xOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGZvb3Rub3Rlc09uTGluZVtpXS5mb290bm90ZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IG1hcmtlciA9IGZvb3Rub3Rlc09uTGluZVtpXS5mb290bm90ZTtcclxuICAgICAgICAgICAgICAgIGxldCBpbmRleE9mTWFya2VySW5MaW5lID0gZm9vdG5vdGVzT25MaW5lW2ldLnN0YXJ0SW5kZXg7XHJcbiAgICAgICAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA+PSBpbmRleE9mTWFya2VySW5MaW5lICYmXHJcbiAgICAgICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA8PSBpbmRleE9mTWFya2VySW5MaW5lICsgbWFya2VyLmxlbmd0aFxyXG4gICAgICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgICAgICBtYXJrZXJUYXJnZXQgPSBtYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChtYXJrZXJUYXJnZXQgIT09IG51bGwpIHtcclxuICAgICAgICAvLyBleHRyYWN0IG5hbWVcclxuICAgICAgICBsZXQgbWF0Y2ggPSBtYXJrZXJUYXJnZXQubWF0Y2goRXh0cmFjdE5hbWVGcm9tRm9vdG5vdGUpO1xyXG4gICAgICAgIGlmIChtYXRjaCkge1xyXG4gICAgICAgICAgICBsZXQgZm9vdG5vdGVOYW1lID0gbWF0Y2hbMl07XHJcblxyXG4gICAgICAgICAgICAvLyBtYXJrZXJzIHdpdGhvdXQgYSBkZXRhaWwgbGluZSBmYWxsIHRocm91Z2ggdG8gdGhlXHJcbiAgICAgICAgICAgIC8vIGRldGFpbC1jcmVhdGlvbiBwYXRoc1xyXG4gICAgICAgICAgICBsZXQgZGV0YWlscyA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhkb2MpO1xyXG4gICAgICAgICAgICBpZiAoZGV0YWlscyA9PT0gbnVsbCB8fCAhZGV0YWlscy5pbmNsdWRlcyhmb290bm90ZU5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luKSkge1xyXG4gICAgICAgICAgICAgICAgb3BlbkZvb3Rub3RlUG9wdXAocGx1Z2luLCBmb290bm90ZU5hbWUsICgpID0+XHJcbiAgICAgICAgICAgICAgICAgICAganVtcFRvRm9vdG5vdGVEZXRhaWwoZm9vdG5vdGVOYW1lLCBjdXJzb3JQb3NpdGlvbiwgZG9jKVxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBqdW1wVG9Gb290bm90ZURldGFpbChmb290bm90ZU5hbWUsIGN1cnNvclBvc2l0aW9uLCBkb2MpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXHJcbik6IHN0cmluZyB7XHJcbiAgICAvL2NoZWNrIGlmICdFbmFibGUgRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nJyBpcyB0cnVlXHJcbiAgICAvL2lmIHNvLCByZXR1cm4gdGhlIFwiRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nXCJcclxuICAgIC8vIGVsc2UsIHJldHVybiBcIlwiXHJcblxyXG4gICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nID09IHRydWUpIHtcclxuICAgICAgICBsZXQgcmV0dXJuSGVhZGluZyA9IHBsdWdpbi5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nO1xyXG4gICAgICAgIC8vIHRoZSBzZXR0aW5nIGhvbGRzIGxpdGVyYWwgbWFya2Rvd24gKGxlZ2FjeSBwbGFpbi10ZXh0IHZhbHVlcyBhcmVcclxuICAgICAgICAvLyBtaWdyYXRlZCBvbiBsb2FkKTsgYSBkaXZpZGVyIGRpcmVjdGx5IGJlbG93IGEgdGV4dCBsaW5lIHdvdWxkIHR1cm5cclxuICAgICAgICAvLyB0aGF0IGxpbmUgaW50byBhIHNldGV4dCBoZWFkaW5nLCBzbyBrZWVwIGEgYmxhbmsgbGluZSBpbiBiZXR3ZWVuXHJcbiAgICAgICAgY29uc3QgZGl2aWRlclJlZ2V4ID0gL14oLS0tfFxcKlxcKlxcKnxfX18pLztcclxuICAgICAgICBpZiAoZGl2aWRlclJlZ2V4LnRlc3QocmV0dXJuSGVhZGluZykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGBcXG5cXG4ke3JldHVybkhlYWRpbmd9YDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGBcXG4ke3JldHVybkhlYWRpbmd9YDtcclxuICAgIH1cclxuICAgIHJldHVybiBcIlwiO1xyXG59XHJcblxyXG4vKiogYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB0byBpbnNlcnQgYSBmb290bm90ZSBvbmx5IGF0IHRoZSBlbmQgb2Ygd29yZCAqL1xyXG5mdW5jdGlvbiBhZGp1c3RGb290bm90ZVBvc2l0aW9uKFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLmluc2VydEF0RW5kT2ZXb3JkKSByZXR1cm4gY3Vyc29yUG9zaXRpb247XHJcbiAgICBjb25zdCBlbmRPZldvcmRVbmRlckN1cnNvciA9IGRvYy53b3JkQXQoY3Vyc29yUG9zaXRpb24pPy50bztcclxuICAgIGlmICghZW5kT2ZXb3JkVW5kZXJDdXJzb3IpIHJldHVybiBjdXJzb3JQb3NpdGlvbjsgLy8gbm8gd29yZCB1bmRlciBjdXJzb3JcclxuXHJcbiAgICAvLyBhZGp1c3QgY3Vyc29yIHBvc2l0aW9uIHRvIGluc2VydCBhIGZvb3Rub3RlIG9ubHkgYXQgdGhlIGVuZCBvZiB3b3JkXHJcbiAgICBjb25zdCBuZXh0Q2hhciA9IGxpbmVUZXh0LmNoYXJBdChlbmRPZldvcmRVbmRlckN1cnNvci5jaCk7XHJcbiAgICBpZiAoW1wiLlwiLCBcIixcIiwgXCI6XCIsIFwiO1wiXS5pbmNsdWRlcyhuZXh0Q2hhcikpIGVuZE9mV29yZFVuZGVyQ3Vyc29yLmNoKys7XHJcbiAgICBjdXJzb3JQb3NpdGlvbiA9IGVuZE9mV29yZFVuZGVyQ3Vyc29yO1xyXG4gICAgcmV0dXJuIGN1cnNvclBvc2l0aW9uO1xyXG59XHJcblxyXG4vL0ZVTkNUSU9OUyBGT1IgQVVUT05VTUJFUkVEIEZPT1ROT1RFU1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGluc2VydEF1dG9udW1Gb290bm90ZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKSB7XHJcbiAgICAvLyBwcmVzc2luZyB0aGUgaG90a2V5IHdoaWxlIHRoZSBwb3B1cCBlZGl0b3IgaXMgb3BlbiBjbG9zZXMgaXRcclxuICAgIGlmICh0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAoKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG1kVmlldyA9IGFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG5cclxuICAgIGlmICghbWRWaWV3KSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAobWRWaWV3LmVkaXRvciA9PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICBjb25zdCBkb2MgPSBtZFZpZXcuZWRpdG9yO1xyXG4gICAgY29uc3QgY3Vyc29yUG9zaXRpb24gPSBkb2MuZ2V0Q3Vyc29yKCk7XHJcbiAgICBjb25zdCBsaW5lVGV4dCA9IGRvYy5nZXRMaW5lKGN1cnNvclBvc2l0aW9uLmxpbmUpO1xyXG4gICAgY29uc3QgbWFya2Rvd25UZXh0ID0gbWRWaWV3LmRhdGE7XHJcblxyXG4gICAgaWYgKHNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MpKVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIGlmIChzaG91bGRKdW1wRnJvbU1hcmtlclRvRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxyXG4gICAgICAgIHJldHVybjtcclxuXHJcbiAgICByZXR1cm4gc2hvdWxkQ3JlYXRlQXV0b251bUZvb3Rub3RlKFxyXG4gICAgICAgIGxpbmVUZXh0LFxyXG4gICAgICAgIGN1cnNvclBvc2l0aW9uLFxyXG4gICAgICAgIHBsdWdpbixcclxuICAgICAgICBkb2MsXHJcbiAgICAgICAgbWFya2Rvd25UZXh0XHJcbiAgICApO1xyXG59XHJcblxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZUF1dG9udW1Gb290bm90ZShcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBtYXJrZG93blRleHQ6IHN0cmluZ1xyXG4pIHtcclxuICAgIGN1cnNvclBvc2l0aW9uID0gYWRqdXN0Rm9vdG5vdGVQb3NpdGlvbihjdXJzb3JQb3NpdGlvbiwgZG9jLCBsaW5lVGV4dCwgcGx1Z2luKTtcclxuXHJcbiAgICAvLyBjcmVhdGUgbmV3IGZvb3Rub3RlIHdpdGggdGhlIG5leHQgbnVtZXJpY2FsIGluZGV4XHJcbiAgICBsZXQgbWF0Y2hlcyA9IG1hcmtkb3duVGV4dC5tYXRjaChBbGxOdW1iZXJlZE1hcmtlcnMpO1xyXG4gICAgbGV0IG51bWJlcnM6IEFycmF5PG51bWJlcj4gPSBbXTtcclxuICAgIGxldCBjdXJyZW50TWF4ID0gMTtcclxuXHJcbiAgICBpZiAobWF0Y2hlcyAhPSBudWxsKSB7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gbWF0Y2hlcy5sZW5ndGggLSAxOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IG1hdGNoID0gbWF0Y2hlc1tpXTtcclxuICAgICAgICAgICAgbWF0Y2ggPSBtYXRjaC5yZXBsYWNlKFwiW15cIiwgXCJcIik7XHJcbiAgICAgICAgICAgIG1hdGNoID0gbWF0Y2gucmVwbGFjZShcIl1cIiwgXCJcIik7XHJcbiAgICAgICAgICAgIGxldCBtYXRjaE51bWJlciA9IE51bWJlcihtYXRjaCk7XHJcbiAgICAgICAgICAgIG51bWJlcnNbaV0gPSBtYXRjaE51bWJlcjtcclxuICAgICAgICAgICAgaWYgKG1hdGNoTnVtYmVyICsgMSA+IGN1cnJlbnRNYXgpIHtcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRNYXggPSBtYXRjaE51bWJlciArIDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGZvb3ROb3RlSWQgPSBjdXJyZW50TWF4O1xyXG4gICAgbGV0IGZvb3Rub3RlTWFya2VyID0gYFteJHtmb290Tm90ZUlkfV1gO1xyXG4gICAgbGV0IGxpbmVQYXJ0MSA9IGxpbmVUZXh0LnN1YnN0cigwLCBjdXJzb3JQb3NpdGlvbi5jaCk7XHJcbiAgICBsZXQgbGluZVBhcnQyID0gbGluZVRleHQuc3Vic3RyKGN1cnNvclBvc2l0aW9uLmNoKTtcclxuICAgIGxldCBuZXdMaW5lID0gbGluZVBhcnQxICsgZm9vdG5vdGVNYXJrZXIgKyBsaW5lUGFydDI7XHJcblxyXG4gICAgZG9jLnJlcGxhY2VSYW5nZShcclxuICAgICAgICBuZXdMaW5lLFxyXG4gICAgICAgIHsgbGluZTogY3Vyc29yUG9zaXRpb24ubGluZSwgY2g6IDAgfSxcclxuICAgICAgICB7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiBsaW5lVGV4dC5sZW5ndGggfVxyXG4gICAgKTtcclxuXHJcbiAgICBsZXQgbGFzdExpbmVJbmRleCA9IGRvYy5sYXN0TGluZSgpO1xyXG4gICAgbGV0IGxhc3RMaW5lID0gZG9jLmdldExpbmUobGFzdExpbmVJbmRleCk7XHJcblxyXG4gICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9PT0gdHJ1ZSkge1xyXG4gICAgICAgIHdoaWxlIChsYXN0TGluZUluZGV4ID4gMCkge1xyXG4gICAgICAgICAgICBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xyXG4gICAgICAgICAgICBpZiAobGFzdExpbmUubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgZG9jLnJlcGxhY2VSYW5nZShcclxuICAgICAgICAgICAgICAgICAgICBcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgIHsgbGluZTogbGFzdExpbmVJbmRleCwgY2g6IDAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7IGxpbmU6IGRvYy5sYXN0TGluZSgpLCBjaDogMCB9XHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGFzdExpbmVJbmRleC0tO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBsZXQgZm9vdG5vdGVEZXRhaWwgPSBgXFxuW14ke2Zvb3ROb3RlSWR9XTogYDtcclxuXHJcbiAgICBsZXQgbGlzdCA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhkb2MpO1xyXG4gICAgXHJcbiAgICBsZXQgbmV3Q3Vyc29yUG9zOiBFZGl0b3JQb3NpdGlvbjtcclxuICAgIGlmIChsaXN0PT09bnVsbCAmJiBjdXJyZW50TWF4ID09IDEpIHtcclxuICAgICAgICBmb290bm90ZURldGFpbCA9IFwiXFxuXCIgKyBmb290bm90ZURldGFpbDtcclxuICAgICAgICBsZXQgSGVhZGluZyA9IGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihwbHVnaW4pO1xyXG4gICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIEhlYWRpbmcgKyBmb290bm90ZURldGFpbCk7XHJcbiAgICAgICAgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBkb2MubGFzdExpbmUoKSAtIDEsIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZG9jLnNldExpbmUoZG9jLmxhc3RMaW5lKCksIGxhc3RMaW5lICsgZm9vdG5vdGVEZXRhaWwpO1xyXG4gICAgICAgIG5ld0N1cnNvclBvcyA9IHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAocG9wdXBFZGl0aW5nQXZhaWxhYmxlKHBsdWdpbikpIHtcclxuICAgICAgICAvLyB0eXBlIHRoZSBkZXRhaWwgaW4gYSBwb3B1cCBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbVxyXG4gICAgICAgIGRvYy5zZXRDdXJzb3IoeyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogY3Vyc29yUG9zaXRpb24uY2ggKyBmb290bm90ZU1hcmtlci5sZW5ndGggfSk7XHJcbiAgICAgICAgb3BlbkZvb3Rub3RlUG9wdXAocGx1Z2luLCBTdHJpbmcoZm9vdE5vdGVJZCksICgpID0+XHJcbiAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zKVxyXG4gICAgICAgICk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zKVxyXG4gICAgfVxyXG59XHJcblxyXG5cclxuLy9GVU5DVElPTlMgRk9SIE5BTUVEIEZPT1ROT1RFU1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGluc2VydE5hbWVkRm9vdG5vdGUocGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xyXG4gICAgLy8gcHJlc3NpbmcgdGhlIGhvdGtleSB3aGlsZSB0aGUgcG9wdXAgZWRpdG9yIGlzIG9wZW4gY2xvc2VzIGl0XHJcbiAgICBpZiAodG9nZ2xlQ2xvc2VGb290bm90ZVBvcHVwKCkpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBtZFZpZXcgPSBhcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHJcbiAgICBpZiAoIW1kVmlldykgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKG1kVmlldy5lZGl0b3IgPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmVkaXRvcjtcclxuICAgIGNvbnN0IGN1cnNvclBvc2l0aW9uID0gZG9jLmdldEN1cnNvcigpO1xyXG4gICAgY29uc3QgbGluZVRleHQgPSBkb2MuZ2V0TGluZShjdXJzb3JQb3NpdGlvbi5saW5lKTtcclxuICAgIGNvbnN0IG1hcmtkb3duVGV4dCA9IG1kVmlldy5kYXRhO1xyXG5cclxuICAgIGlmIChzaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jKSlcclxuICAgICAgICByZXR1cm47XHJcbiAgICBpZiAoc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYywgcGx1Z2luKSlcclxuICAgICAgICByZXR1cm47XHJcblxyXG4gICAgaWYgKHNob3VsZENyZWF0ZU1hdGNoaW5nRm9vdG5vdGVEZXRhaWwobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBwbHVnaW4sIGRvYykpXHJcbiAgICAgICAgcmV0dXJuOyBcclxuICAgIHJldHVybiBzaG91bGRDcmVhdGVGb290bm90ZU1hcmtlcihcclxuICAgICAgICBsaW5lVGV4dCxcclxuICAgICAgICBjdXJzb3JQb3NpdGlvbixcclxuICAgICAgICBkb2MsXHJcbiAgICAgICAgbWFya2Rvd25UZXh0LFxyXG4gICAgICAgIHBsdWdpblxyXG4gICAgKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZU1hdGNoaW5nRm9vdG5vdGVEZXRhaWwoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcclxuICAgIGRvYzogRWRpdG9yXHJcbikge1xyXG4gICAgLy8gQ3JlYXRlIG1hdGNoaW5nIGZvb3Rub3RlIGRldGFpbCBmb3IgZm9vdG5vdGUgbWFya2VyXHJcbiAgICBcclxuICAgIC8vIGRvZXMgdGhpcyBsaW5lIGhhdmUgYSBmb290bm90ZSBtYXJrZXI/XHJcbiAgICAvLyBkb2VzIHRoZSBjdXJzb3Igb3ZlcmxhcCB3aXRoIG9uZSBvZiB0aGVtP1xyXG4gICAgLy8gaWYgc28sIHdoaWNoIG9uZT9cclxuICAgIC8vIGRvZXMgdGhpcyBmb290bm90ZSBtYXJrZXIgaGF2ZSBhIGRldGFpbCBsaW5lP1xyXG4gICAgLy8gaWYgbm90LCBjcmVhdGUgaXQgYW5kIHBsYWNlIGN1cnNvciB0aGVyZVxyXG4gICAgbGV0IHJlT25seU1hcmtlcnNNYXRjaGVzID0gbGluZVRleHQubWF0Y2goQWxsTWFya2Vycyk7XHJcblxyXG4gICAgbGV0IG1hcmtlclRhcmdldCA9IG51bGw7XHJcblxyXG4gICAgaWYgKHJlT25seU1hcmtlcnNNYXRjaGVzKXtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSByZU9ubHlNYXJrZXJzTWF0Y2hlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgbWFya2VyID0gcmVPbmx5TWFya2Vyc01hdGNoZXNbaV07XHJcbiAgICAgICAgICAgIGlmIChtYXJrZXIgIT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXhPZk1hcmtlckluTGluZSA9IGxpbmVUZXh0LmluZGV4T2YobWFya2VyKTtcclxuICAgICAgICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA+PSBpbmRleE9mTWFya2VySW5MaW5lICYmXHJcbiAgICAgICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPD0gaW5kZXhPZk1hcmtlckluTGluZSArIG1hcmtlci5sZW5ndGhcclxuICAgICAgICAgICAgICAgICkge1xyXG4gICAgICAgICAgICAgICAgICAgIG1hcmtlclRhcmdldCA9IG1hcmtlcjtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAobWFya2VyVGFyZ2V0ICE9IG51bGwpIHtcclxuICAgICAgICAvL2V4dHJhY3QgZm9vdG5vdGVcclxuICAgICAgICBsZXQgbWF0Y2ggPSBtYXJrZXJUYXJnZXQubWF0Y2goRXh0cmFjdE5hbWVGcm9tRm9vdG5vdGUpXHJcbiAgICAgICAgLy9maW5kIGlmIHRoaXMgZm9vdG5vdGUgZXhpc3RzIGJ5IGxpc3RpbmcgZXhpc3RpbmcgZm9vdG5vdGUgZGV0YWlsc1xyXG4gICAgICAgIGlmIChtYXRjaCkge1xyXG4gICAgICAgICAgICBsZXQgZm9vdG5vdGVJZCA9IG1hdGNoWzJdO1xyXG5cclxuICAgICAgICAgICAgbGV0IGxpc3Q6IHN0cmluZ1tdID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKGRvYyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgbGlzdCBpcyBlbXB0eSBPUiBpZiB0aGUgbGlzdCBkb2Vzbid0IGluY2x1ZGUgY3VycmVudCBmb290bm90ZVxyXG4gICAgICAgICAgICAvLyBpZiBzbywgYWRkIGRldGFpbCBmb3IgdGhlIGN1cnJlbnQgZm9vdG5vdGVcclxuICAgICAgICAgICAgaWYobGlzdCA9PT0gbnVsbCB8fCAhbGlzdC5pbmNsdWRlcyhmb290bm90ZUlkKSkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGxhc3RMaW5lSW5kZXggPSBkb2MubGFzdExpbmUoKTtcclxuICAgICAgICAgICAgICAgIGxldCBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXMgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAobGFzdExpbmVJbmRleCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RMaW5lLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvYy5yZXBsYWNlUmFuZ2UoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxpbmU6IGxhc3RMaW5lSW5kZXgsIGNoOiAwIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsaW5lOiBkb2MubGFzdExpbmUoKSwgY2g6IDAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RMaW5lSW5kZXgtLTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGxldCBmb290bm90ZURldGFpbCA9IGBcXG5bXiR7Zm9vdG5vdGVJZH1dOiBgO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBuZXdDdXJzb3JQb3M6IEVkaXRvclBvc2l0aW9uO1xyXG4gICAgICAgICAgICAgICAgaWYgKGxpc3Q9PT1udWxsIHx8IGxpc3QubGVuZ3RoIDwgMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvb3Rub3RlRGV0YWlsID0gXCJcXG5cIiArIGZvb3Rub3RlRGV0YWlsO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBIZWFkaW5nID0gYWRkRm9vdG5vdGVTZWN0aW9uSGVhZGVyKHBsdWdpbik7XHJcbiAgICAgICAgICAgICAgICAgICAgZG9jLnNldExpbmUoZG9jLmxhc3RMaW5lKCksIGxhc3RMaW5lICsgSGVhZGluZyArIGZvb3Rub3RlRGV0YWlsKTtcclxuICAgICAgICAgICAgICAgICAgICBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGRvYy5sYXN0TGluZSgpIC0gMSwgY2g6IGZvb3Rub3RlRGV0YWlsLmxlbmd0aCAtIDEgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBkb2Muc2V0TGluZShkb2MubGFzdExpbmUoKSwgbGFzdExpbmUgKyBmb290bm90ZURldGFpbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBkb2MubGFzdExpbmUoKSwgY2g6IGZvb3Rub3RlRGV0YWlsLmxlbmd0aCAtIDEgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHR5cGUgdGhlIGRldGFpbCBpbiBhIHBvcHVwIGluc3RlYWQgb2YganVtcGluZyB0byB0aGUgYm90dG9tXHJcbiAgICAgICAgICAgICAgICAgICAgb3BlbkZvb3Rub3RlUG9wdXAocGx1Z2luLCBmb290bm90ZUlkLCAoKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcylcclxuICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcylcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47IFxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZUZvb3Rub3RlTWFya2VyKFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgbWFya2Rvd25UZXh0OiBzdHJpbmcsXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXHJcbikge1xyXG4gICAgY3Vyc29yUG9zaXRpb24gPSBhZGp1c3RGb290bm90ZVBvc2l0aW9uKGN1cnNvclBvc2l0aW9uLCBkb2MsIGxpbmVUZXh0LCBwbHVnaW4pO1xyXG5cclxuICAgIC8vY3JlYXRlIGVtcHR5IGZvb3Rub3RlIG1hcmtlciBmb3IgbmFtZSBpbnB1dFxyXG4gICAgbGV0IGVtcHR5TWFya2VyID0gYFteXWA7XHJcbiAgICBkb2MucmVwbGFjZVJhbmdlKGVtcHR5TWFya2VyLGN1cnNvclBvc2l0aW9uKTtcclxuICAgIC8vbW92ZSBjdXJzb3IgaW4gYmV0d2VlbiBbXiBhbmQgXVxyXG4gICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogY3Vyc29yUG9zaXRpb24uY2ggKyAyIH1cclxuICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zKVxyXG4gICAgLy9vcGVuIGZvb3Rub3RlUGlja2VyIHBvcHVwXHJcbiAgICBcclxufVxyXG4iLCJpbXBvcnQge1xyXG4gIGFkZEljb24sXHJcbiAgTWFya2Rvd25WaWV3LFxyXG4gIFBsdWdpblxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuaW1wb3J0IHsgRm9vdG5vdGVQbHVnaW5TZXR0aW5nVGFiLCBGb290bm90ZVBsdWdpblNldHRpbmdzLCBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuaW1wb3J0IHsgZGlzbWlzc0Zvb3Rub3RlUG9wdXAgfSBmcm9tIFwiLi9mb290bm90ZS1wb3B1cFwiO1xyXG5pbXBvcnQgeyBpbnNlcnRBdXRvbnVtRm9vdG5vdGUsaW5zZXJ0TmFtZWRGb290bm90ZSB9IGZyb20gXCIuL2luc2VydC1vci1uYXZpZ2F0ZS1mb290bm90ZXNcIjtcclxuXHJcbi8vQWRkIGNoZXZyb24tdXAtc3F1YXJlIGljb24gZnJvbSBsdWNpZGUgZm9yIG1vYmlsZSB0b29sYmFyICh0ZW1wb3JhcnkgdW50aWwgT2JzaWRpYW4gdXBkYXRlcyB0byBMdWNpZGUgdjAuMTMwLjApXHJcbmFkZEljb24oXCJjaGV2cm9uLXVwLXNxdWFyZVwiLCBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIGNsYXNzPVwibHVjaWRlIGx1Y2lkZS1jaGV2cm9uLXVwLXNxdWFyZVwiPjxyZWN0IHdpZHRoPVwiMThcIiBoZWlnaHQ9XCIxOFwiIHg9XCIzXCIgeT1cIjNcIiByeD1cIjJcIiByeT1cIjJcIj48L3JlY3Q+PHBvbHlsaW5lIHBvaW50cz1cIjgsMTQgMTIsMTAgMTYsMTRcIj48L3BvbHlsaW5lPjwvc3ZnPmApO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRm9vdG5vdGVQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gIHB1YmxpYyBzZXR0aW5nczogRm9vdG5vdGVQbHVnaW5TZXR0aW5ncztcclxuXHJcbiAgYXN5bmMgb25sb2FkKCkge1xyXG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJpbnNlcnQtYXV0b251bWJlcmVkLWZvb3Rub3RlXCIsXHJcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IC8gTmF2aWdhdGUgQXV0by1OdW1iZXJlZCBGb290bm90ZVwiLFxyXG4gICAgICBpY29uOiBcInBsdXMtc3F1YXJlXCIsXHJcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgIGlmIChjaGVja2luZylcclxuICAgICAgICAgIHJldHVybiAhIXRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICAgICAgaW5zZXJ0QXV0b251bUZvb3Rub3RlKHRoaXMpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJpbnNlcnQtbmFtZWQtZm9vdG5vdGVcIixcclxuICAgICAgbmFtZTogXCJJbnNlcnQgLyBOYXZpZ2F0ZSBOYW1lZCBGb290bm90ZVwiLFxyXG4gICAgICBpY29uOiBcImNoZXZyb24tdXAtc3F1YXJlXCIsXHJcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgIGlmIChjaGVja2luZylcclxuICAgICAgICAgIHJldHVybiAhIXRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICAgICAgaW5zZXJ0TmFtZWRGb290bm90ZSh0aGlzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgXHJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cclxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcclxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsICgpID0+IGRpc21pc3NGb290bm90ZVBvcHVwKCkpXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgb251bmxvYWQoKSB7XHJcbiAgICBkaXNtaXNzRm9vdG5vdGVQb3B1cCgpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xyXG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XHJcblxyXG4gICAgLy8gbWlncmF0ZSBwcmUtMS4wLjQgc2VjdGlvbiBoZWFkaW5nIHZhbHVlczogdGhlIG9sZCB0ZXh0IGlucHV0IGltcGxpZWRcclxuICAgIC8vIGFuIEgxLCB0aGUgdGV4dGFyZWEgdGFrZXMgbGl0ZXJhbCBtYXJrZG93biwgc28gY29udmVydCBvbmNlIGFuZCBzYXZlXHJcbiAgICBjb25zdCBoZWFkaW5nID0gdGhpcy5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nO1xyXG4gICAgaWYgKGhlYWRpbmcgJiYgIS9eKCN7MSw2fSB8LS0tfFxcKlxcKlxcKnxfX18pLy50ZXN0KGhlYWRpbmcpKSB7XHJcbiAgICAgIHRoaXMuc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9IGAjICR7aGVhZGluZ31gO1xyXG4gICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGRyb3AgdGhlIHNldHRpbmcgZm9yIHRoZSByZW1vdmVkIGF1dG9zdWdnZXN0IGZlYXR1cmUgKE9ic2lkaWFuIG5vd1xyXG4gICAgLy8gc3VnZ2VzdHMgZm9vdG5vdGVzIG5hdGl2ZWx5KVxyXG4gICAgaWYgKFwiZW5hYmxlQXV0b1N1Z2dlc3RcIiBpbiB0aGlzLnNldHRpbmdzKSB7XHJcbiAgICAgIGRlbGV0ZSAodGhpcy5zZXR0aW5ncyBhcyBhbnkpLmVuYWJsZUF1dG9TdWdnZXN0O1xyXG4gICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xyXG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICB9XHJcbn0iXSwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJNYXJrZG93blZpZXciLCJhZGRJY29uIiwiUGx1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
