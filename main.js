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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9mb290bm90ZS1wb3B1cC50cyIsInNyYy9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlLCBTdXBwcmVzc2VkRXJyb3IsIFN5bWJvbCwgSXRlcmF0b3IgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXNEZWNvcmF0ZShjdG9yLCBkZXNjcmlwdG9ySW4sIGRlY29yYXRvcnMsIGNvbnRleHRJbiwgaW5pdGlhbGl6ZXJzLCBleHRyYUluaXRpYWxpemVycykge1xyXG4gICAgZnVuY3Rpb24gYWNjZXB0KGYpIHsgaWYgKGYgIT09IHZvaWQgMCAmJiB0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRnVuY3Rpb24gZXhwZWN0ZWRcIik7IHJldHVybiBmOyB9XHJcbiAgICB2YXIga2luZCA9IGNvbnRleHRJbi5raW5kLCBrZXkgPSBraW5kID09PSBcImdldHRlclwiID8gXCJnZXRcIiA6IGtpbmQgPT09IFwic2V0dGVyXCIgPyBcInNldFwiIDogXCJ2YWx1ZVwiO1xyXG4gICAgdmFyIHRhcmdldCA9ICFkZXNjcmlwdG9ySW4gJiYgY3RvciA/IGNvbnRleHRJbltcInN0YXRpY1wiXSA/IGN0b3IgOiBjdG9yLnByb3RvdHlwZSA6IG51bGw7XHJcbiAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JJbiB8fCAodGFyZ2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGNvbnRleHRJbi5uYW1lKSA6IHt9KTtcclxuICAgIHZhciBfLCBkb25lID0gZmFsc2U7XHJcbiAgICBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4pIGNvbnRleHRbcF0gPSBwID09PSBcImFjY2Vzc1wiID8ge30gOiBjb250ZXh0SW5bcF07XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4uYWNjZXNzKSBjb250ZXh0LmFjY2Vzc1twXSA9IGNvbnRleHRJbi5hY2Nlc3NbcF07XHJcbiAgICAgICAgY29udGV4dC5hZGRJbml0aWFsaXplciA9IGZ1bmN0aW9uIChmKSB7IGlmIChkb25lKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFkZCBpbml0aWFsaXplcnMgYWZ0ZXIgZGVjb3JhdGlvbiBoYXMgY29tcGxldGVkXCIpOyBleHRyYUluaXRpYWxpemVycy5wdXNoKGFjY2VwdChmIHx8IG51bGwpKTsgfTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gKDAsIGRlY29yYXRvcnNbaV0pKGtpbmQgPT09IFwiYWNjZXNzb3JcIiA/IHsgZ2V0OiBkZXNjcmlwdG9yLmdldCwgc2V0OiBkZXNjcmlwdG9yLnNldCB9IDogZGVzY3JpcHRvcltrZXldLCBjb250ZXh0KTtcclxuICAgICAgICBpZiAoa2luZCA9PT0gXCJhY2Nlc3NvclwiKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHZvaWQgMCkgY29udGludWU7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZFwiKTtcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmdldCkpIGRlc2NyaXB0b3IuZ2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LnNldCkpIGRlc2NyaXB0b3Iuc2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmluaXQpKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoXyA9IGFjY2VwdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIGlmIChraW5kID09PSBcImZpZWxkXCIpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgICAgICBlbHNlIGRlc2NyaXB0b3Jba2V5XSA9IF87XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRhcmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgY29udGV4dEluLm5hbWUsIGRlc2NyaXB0b3IpO1xyXG4gICAgZG9uZSA9IHRydWU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19ydW5Jbml0aWFsaXplcnModGhpc0FyZywgaW5pdGlhbGl6ZXJzLCB2YWx1ZSkge1xyXG4gICAgdmFyIHVzZVZhbHVlID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRpYWxpemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhbHVlID0gdXNlVmFsdWUgPyBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnLCB2YWx1ZSkgOiBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1c2VWYWx1ZSA/IHZhbHVlIDogdm9pZCAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcHJvcEtleSh4KSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwic3ltYm9sXCIgPyB4IDogXCJcIi5jb25jYXQoeCk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zZXRGdW5jdGlvbk5hbWUoZiwgbmFtZSwgcHJlZml4KSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3ltYm9sXCIpIG5hbWUgPSBuYW1lLmRlc2NyaXB0aW9uID8gXCJbXCIuY29uY2F0KG5hbWUuZGVzY3JpcHRpb24sIFwiXVwiKSA6IFwiXCI7XHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGYsIFwibmFtZVwiLCB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHByZWZpeCA/IFwiXCIuY29uY2F0KHByZWZpeCwgXCIgXCIsIG5hbWUpIDogbmFtZSB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGcgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEl0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpO1xyXG4gICAgcmV0dXJuIGcubmV4dCA9IHZlcmIoMCksIGdbXCJ0aHJvd1wiXSA9IHZlcmIoMSksIGdbXCJyZXR1cm5cIl0gPSB2ZXJiKDIpLCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBBc3luY0l0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBBc3luY0l0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpLCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIsIGF3YWl0UmV0dXJuKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gYXdhaXRSZXR1cm4oZikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGYsIHJlamVjdCk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpZiAoZ1tuXSkgeyBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyBpZiAoZikgaVtuXSA9IGYoaVtuXSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IGZhbHNlIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbnZhciBvd25LZXlzID0gZnVuY3Rpb24obykge1xyXG4gICAgb3duS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIHx8IGZ1bmN0aW9uIChvKSB7XHJcbiAgICAgICAgdmFyIGFyID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgayBpbiBvKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIGspKSBhclthci5sZW5ndGhdID0gaztcclxuICAgICAgICByZXR1cm4gYXI7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIG93bktleXMobyk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayA9IG93bktleXMobW9kKSwgaSA9IDA7IGkgPCBrLmxlbmd0aDsgaSsrKSBpZiAoa1tpXSAhPT0gXCJkZWZhdWx0XCIpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwga1tpXSk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4oc3RhdGUsIHJlY2VpdmVyKSB7XHJcbiAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwgfHwgKHR5cGVvZiByZWNlaXZlciAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcmVjZWl2ZXIgIT09IFwiZnVuY3Rpb25cIikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgdXNlICdpbicgb3BlcmF0b3Igb24gbm9uLW9iamVjdFwiKTtcclxuICAgIHJldHVybiB0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyID09PSBzdGF0ZSA6IHN0YXRlLmhhcyhyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZShlbnYsIHZhbHVlLCBhc3luYykge1xyXG4gICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkLlwiKTtcclxuICAgICAgICB2YXIgZGlzcG9zZSwgaW5uZXI7XHJcbiAgICAgICAgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmFzeW5jRGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0Rpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmFzeW5jRGlzcG9zZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkaXNwb3NlID09PSB2b2lkIDApIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuZGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5kaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5kaXNwb3NlXTtcclxuICAgICAgICAgICAgaWYgKGFzeW5jKSBpbm5lciA9IGRpc3Bvc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2YgZGlzcG9zZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IG5vdCBkaXNwb3NhYmxlLlwiKTtcclxuICAgICAgICBpZiAoaW5uZXIpIGRpc3Bvc2UgPSBmdW5jdGlvbigpIHsgdHJ5IHsgaW5uZXIuY2FsbCh0aGlzKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7IH0gfTtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IHZhbHVlOiB2YWx1ZSwgZGlzcG9zZTogZGlzcG9zZSwgYXN5bmM6IGFzeW5jIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoYXN5bmMpIHtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IGFzeW5jOiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG5cclxufVxyXG5cclxudmFyIF9TdXBwcmVzc2VkRXJyb3IgPSB0eXBlb2YgU3VwcHJlc3NlZEVycm9yID09PSBcImZ1bmN0aW9uXCIgPyBTdXBwcmVzc2VkRXJyb3IgOiBmdW5jdGlvbiAoZXJyb3IsIHN1cHByZXNzZWQsIG1lc3NhZ2UpIHtcclxuICAgIHZhciBlID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xyXG4gICAgcmV0dXJuIGUubmFtZSA9IFwiU3VwcHJlc3NlZEVycm9yXCIsIGUuZXJyb3IgPSBlcnJvciwgZS5zdXBwcmVzc2VkID0gc3VwcHJlc3NlZCwgZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2Rpc3Bvc2VSZXNvdXJjZXMoZW52KSB7XHJcbiAgICBmdW5jdGlvbiBmYWlsKGUpIHtcclxuICAgICAgICBlbnYuZXJyb3IgPSBlbnYuaGFzRXJyb3IgPyBuZXcgX1N1cHByZXNzZWRFcnJvcihlLCBlbnYuZXJyb3IsIFwiQW4gZXJyb3Igd2FzIHN1cHByZXNzZWQgZHVyaW5nIGRpc3Bvc2FsLlwiKSA6IGU7XHJcbiAgICAgICAgZW52Lmhhc0Vycm9yID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIHZhciByLCBzID0gMDtcclxuICAgIGZ1bmN0aW9uIG5leHQoKSB7XHJcbiAgICAgICAgd2hpbGUgKHIgPSBlbnYuc3RhY2sucG9wKCkpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmICghci5hc3luYyAmJiBzID09PSAxKSByZXR1cm4gcyA9IDAsIGVudi5zdGFjay5wdXNoKHIpLCBQcm9taXNlLnJlc29sdmUoKS50aGVuKG5leHQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHIuZGlzcG9zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSByLmRpc3Bvc2UuY2FsbChyLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoci5hc3luYykgcmV0dXJuIHMgfD0gMiwgUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCkudGhlbihuZXh0LCBmdW5jdGlvbihlKSB7IGZhaWwoZSk7IHJldHVybiBuZXh0KCk7IH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBzIHw9IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIGZhaWwoZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHMgPT09IDEpIHJldHVybiBlbnYuaGFzRXJyb3IgPyBQcm9taXNlLnJlamVjdChlbnYuZXJyb3IpIDogUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgaWYgKGVudi5oYXNFcnJvcikgdGhyb3cgZW52LmVycm9yO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5leHQoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uKHBhdGgsIHByZXNlcnZlSnN4KSB7XHJcbiAgICBpZiAodHlwZW9mIHBhdGggPT09IFwic3RyaW5nXCIgJiYgL15cXC5cXC4/XFwvLy50ZXN0KHBhdGgpKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhdGgucmVwbGFjZSgvXFwuKHRzeCkkfCgoPzpcXC5kKT8pKCg/OlxcLlteLi9dKz8pPylcXC4oW2NtXT8pdHMkL2ksIGZ1bmN0aW9uIChtLCB0c3gsIGQsIGV4dCwgY20pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRzeCA/IHByZXNlcnZlSnN4ID8gXCIuanN4XCIgOiBcIi5qc1wiIDogZCAmJiAoIWV4dCB8fCAhY20pID8gbSA6IChkICsgZXh0ICsgXCIuXCIgKyBjbS50b0xvd2VyQ2FzZSgpICsgXCJqc1wiKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiBwYXRoO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBfX2V4dGVuZHM6IF9fZXh0ZW5kcyxcclxuICAgIF9fYXNzaWduOiBfX2Fzc2lnbixcclxuICAgIF9fcmVzdDogX19yZXN0LFxyXG4gICAgX19kZWNvcmF0ZTogX19kZWNvcmF0ZSxcclxuICAgIF9fcGFyYW06IF9fcGFyYW0sXHJcbiAgICBfX2VzRGVjb3JhdGU6IF9fZXNEZWNvcmF0ZSxcclxuICAgIF9fcnVuSW5pdGlhbGl6ZXJzOiBfX3J1bkluaXRpYWxpemVycyxcclxuICAgIF9fcHJvcEtleTogX19wcm9wS2V5LFxyXG4gICAgX19zZXRGdW5jdGlvbk5hbWU6IF9fc2V0RnVuY3Rpb25OYW1lLFxyXG4gICAgX19tZXRhZGF0YTogX19tZXRhZGF0YSxcclxuICAgIF9fYXdhaXRlcjogX19hd2FpdGVyLFxyXG4gICAgX19nZW5lcmF0b3I6IF9fZ2VuZXJhdG9yLFxyXG4gICAgX19jcmVhdGVCaW5kaW5nOiBfX2NyZWF0ZUJpbmRpbmcsXHJcbiAgICBfX2V4cG9ydFN0YXI6IF9fZXhwb3J0U3RhcixcclxuICAgIF9fdmFsdWVzOiBfX3ZhbHVlcyxcclxuICAgIF9fcmVhZDogX19yZWFkLFxyXG4gICAgX19zcHJlYWQ6IF9fc3ByZWFkLFxyXG4gICAgX19zcHJlYWRBcnJheXM6IF9fc3ByZWFkQXJyYXlzLFxyXG4gICAgX19zcHJlYWRBcnJheTogX19zcHJlYWRBcnJheSxcclxuICAgIF9fYXdhaXQ6IF9fYXdhaXQsXHJcbiAgICBfX2FzeW5jR2VuZXJhdG9yOiBfX2FzeW5jR2VuZXJhdG9yLFxyXG4gICAgX19hc3luY0RlbGVnYXRvcjogX19hc3luY0RlbGVnYXRvcixcclxuICAgIF9fYXN5bmNWYWx1ZXM6IF9fYXN5bmNWYWx1ZXMsXHJcbiAgICBfX21ha2VUZW1wbGF0ZU9iamVjdDogX19tYWtlVGVtcGxhdGVPYmplY3QsXHJcbiAgICBfX2ltcG9ydFN0YXI6IF9faW1wb3J0U3RhcixcclxuICAgIF9faW1wb3J0RGVmYXVsdDogX19pbXBvcnREZWZhdWx0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldDogX19jbGFzc1ByaXZhdGVGaWVsZEdldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRTZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkSW46IF9fY2xhc3NQcml2YXRlRmllbGRJbixcclxuICAgIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlOiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZSxcclxuICAgIF9fZGlzcG9zZVJlc291cmNlczogX19kaXNwb3NlUmVzb3VyY2VzLFxyXG4gICAgX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb246IF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uLFxyXG59O1xyXG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIFNldHRpbmdEZWZpbml0aW9uSXRlbSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IEZvb3Rub3RlUGx1Z2luIGZyb20gXCIuL21haW5cIjtcblxuZXhwb3J0IGludGVyZmFjZSBGb290bm90ZVBsdWdpblNldHRpbmdzIHtcbiAgICBpbnNlcnRBdEVuZE9mV29yZDogYm9vbGVhbjtcbiAgICBlbmFibGVQb3B1cEVkaXRvcjogYm9vbGVhbjtcblxuICAgIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IGJvb2xlYW47XG4gICAgRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogc3RyaW5nO1xuXG4gICAgZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXM6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBGb290bm90ZVBsdWdpblNldHRpbmdzID0ge1xuICAgIGluc2VydEF0RW5kT2ZXb3JkOiB0cnVlLFxuICAgIGVuYWJsZVBvcHVwRWRpdG9yOiB0cnVlLFxuXG4gICAgZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogZmFsc2UsXG4gICAgRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogXCIjIEZvb3Rub3Rlc1wiLFxuXG4gICAgZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXM6IHRydWUsXG59O1xuXG5leHBvcnQgY2xhc3MgRm9vdG5vdGVQbHVnaW5TZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbjtcblxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IEZvb3Rub3RlUGx1Z2luKSB7XG4gICAgICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgfVxuXG4gICAgLy8gT2JzaWRpYW4gMS4xMy4wKyByZW5kZXJzIHRoZSB0YWIgZnJvbSB0aGVzZSBkZWZpbml0aW9ucyBhbmQgc2tpcHNcbiAgICAvLyBkaXNwbGF5KCk7IGNvbnRyb2xzIGJpbmQgdG8gdGhpcy5wbHVnaW4uc2V0dGluZ3Nba2V5XSBhbmQgYXV0by1zYXZlXG4gICAgZ2V0U2V0dGluZ0RlZmluaXRpb25zKCk6IFNldHRpbmdEZWZpbml0aW9uSXRlbVtdIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiLFxuICAgICAgICAgICAgICAgIGRlc2M6IFwiQSBuZXcgZm9vdG5vdGUgaXMgb25seSBpbnNlcnRlZCBhdCB0aGUgZW5kIG9mIHRoZSB3b3JkIGFuZCBhZnRlciBhbnkgcHVuY3R1YXRpb24uXCIsXG4gICAgICAgICAgICAgICAgY29udHJvbDogeyB0eXBlOiBcInRvZ2dsZVwiLCBrZXk6IFwiaW5zZXJ0QXRFbmRPZldvcmRcIiB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkVkaXQgZm9vdG5vdGVzIGluIGEgcG9wdXBcIixcbiAgICAgICAgICAgICAgICBkZXNjOiBcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCBFc2NhcGUsIG9yIGJ5IGNsaWNraW5nIG91dHNpZGUuXCIsXG4gICAgICAgICAgICAgICAgY29udHJvbDogeyB0eXBlOiBcInRvZ2dsZVwiLCBrZXk6IFwiZW5hYmxlUG9wdXBFZGl0b3JcIiB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcIlRyaW0gYmxhbmsgbGluZXNcIixcbiAgICAgICAgICAgICAgICBkZXNjOiBcIlJlbW92ZSBibGFuayBsaW5lcyBmcm9tIHRoZSBlbmQgb2YgdGhlIG5vdGUgd2hlbiBpbnNlcnRpbmcgYSBuZXcgZm9vdG5vdGUgc2VjdGlvbi5cIixcbiAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lc1wiIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiZ3JvdXBcIixcbiAgICAgICAgICAgICAgICBoZWFkaW5nOiBcIkZvb3Rub3RlcyBzZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgaXRlbXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJFbmFibGUgc2VjdGlvbiBoZWFkaW5nXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjOiBcIkF1dG9tYXRpY2FsbHkgYWRkcyBhIGhlYWRpbmcgc2VwYXJhdGluZyBmb290bm90ZXMgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbm90ZSBmcm9tIHRoZSByZXN0IG9mIHRoZSB0ZXh0LlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udHJvbDogeyB0eXBlOiBcInRvZ2dsZVwiLCBrZXk6IFwiZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZ1wiIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiU2VjdGlvbiBoZWFkaW5nXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjOiBcIkhlYWRpbmcgdG8gcGxhY2UgYWJvdmUgdGhlIGZvb3Rub3RlcyBzZWN0aW9uLiBBY2NlcHRzIHN0YW5kYXJkIG1hcmtkb3duLCBpbmNsdWRpbmcgbXVsdGlwbGUgbGluZXMgYW5kIGRpdmlkZXJzLlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udHJvbDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwidGV4dGFyZWFcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IFwiRm9vdG5vdGVTZWN0aW9uSGVhZGluZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3M6IDYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI6IFwiRXg6ICcjIEZvb3Rub3RlcydcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZDogKCkgPT4gIXRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICBdO1xuICAgIH1cblxuICAgIC8vIE9ic2lkaWFuIDwgMS4xMy4wIGZhbGxzIGJhY2sgdG8gdGhpcyBpbXBlcmF0aXZlIGltcGxlbWVudGF0aW9uO1xuICAgIC8vIGtlZXAgaXQgaW4gc3luYyB3aXRoIGdldFNldHRpbmdEZWZpbml0aW9ucygpIGFib3ZlXG4gICAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qge2NvbnRhaW5lckVsfSA9IHRoaXM7XG4gICAgICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgIC5zZXROYW1lKFwiSW5zZXJ0IGZvb3Rub3RlIGF0IGVuZCBvZiB3b3JkXCIpXG4gICAgICAgIC5zZXREZXNjKFwiQSBuZXcgZm9vdG5vdGUgaXMgb25seSBpbnNlcnRlZCBhdCB0aGUgZW5kIG9mIHRoZSB3b3JkIGFuZCBhZnRlciBhbnkgcHVuY3R1YXRpb24uXCIpXG4gICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgIHRvZ2dsZVxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZClcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmluc2VydEF0RW5kT2ZXb3JkID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgIC5zZXROYW1lKFwiRWRpdCBmb290bm90ZXMgaW4gYSBwb3B1cFwiKVxuICAgICAgICAuc2V0RGVzYyhcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCBFc2NhcGUsIG9yIGJ5IGNsaWNraW5nIG91dHNpZGUuXCIpXG4gICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgIHRvZ2dsZVxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVQb3B1cEVkaXRvcilcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVBvcHVwRWRpdG9yID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgIC5zZXROYW1lKFwiVHJpbSBibGFuayBsaW5lc1wiKVxuICAgICAgICAuc2V0RGVzYyhcIlJlbW92ZSBibGFuayBsaW5lcyBmcm9tIHRoZSBlbmQgb2YgdGhlIG5vdGUgd2hlbiBpbnNlcnRpbmcgYSBuZXcgZm9vdG5vdGUgc2VjdGlvbi5cIilcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVJlbW92ZUJsYW5rTGFzdExpbmVzKVxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXMgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgKTtcblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgLnNldE5hbWUoXCJGb290bm90ZXMgc2VjdGlvblwiKVxuICAgICAgICAuc2V0SGVhZGluZygpO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAuc2V0TmFtZShcIkVuYWJsZSBzZWN0aW9uIGhlYWRpbmdcIilcbiAgICAgICAgLnNldERlc2MoXCJBdXRvbWF0aWNhbGx5IGFkZHMgYSBoZWFkaW5nIHNlcGFyYXRpbmcgZm9vdG5vdGVzIGF0IHRoZSBib3R0b20gb2YgdGhlIG5vdGUgZnJvbSB0aGUgcmVzdCBvZiB0aGUgdGV4dC5cIilcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmcpXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgIC5zZXROYW1lKFwiU2VjdGlvbiBoZWFkaW5nXCIpXG4gICAgICAgIC5zZXREZXNjKFwiSGVhZGluZyB0byBwbGFjZSBhYm92ZSB0aGUgZm9vdG5vdGVzIHNlY3Rpb24uIEFjY2VwdHMgc3RhbmRhcmQgbWFya2Rvd24sIGluY2x1ZGluZyBtdWx0aXBsZSBsaW5lcyBhbmQgZGl2aWRlcnMuXCIpXG4gICAgICAgIC5hZGRUZXh0QXJlYSgodGV4dCkgPT5cbiAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJFeDogJyMgRm9vdG5vdGVzJ1wiKVxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nKVxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC50aGVuKCh0ZXh0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRleHQuaW5wdXRFbC5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICAgICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnJvd3MgPSA2O1xuICAgICAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUucmVzaXplID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgTWFya2Rvd25WaWV3IH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCBGb290bm90ZVBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5cbi8vIEEgc21hbGwgcG9wdXAgYW5jaG9yZWQgYXQgdGhlIGN1cnNvciBjb250YWluaW5nIE9ic2lkaWFuJ3Mgb3duIGVkaXRhYmxlXG4vLyBtYXJrZG93biBlbWJlZCwgYm91bmQgdG8ganVzdCB0aGUgZm9vdG5vdGUncyBkZXRhaWwgdmlhIHRoZSBgI1teaWRdYFxuLy8gc3VicGF0aCAodGhlIHNhbWUgbWFjaGluZXJ5IHRoZSBjb3JlIEZvb3Rub3RlcyB2aWV3IHVzZXMpLiBFZGl0aW5nIGluIHRoZVxuLy8gcG9wdXAgc2F2ZXMgc3RyYWlnaHQgYmFjayB0byB0aGUgZGV0YWlsIGxpbmUgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbm90ZSxcbi8vIHNvIHRoZSB1c2VyJ3MgY3Vyc29yIG5ldmVyIGhhcyB0byBsZWF2ZSB0aGUgdGV4dC5cblxudHlwZSBBY3RpdmVQb3B1cCA9IHtcbiAgICBjb250YWluZXJFbDogSFRNTEVsZW1lbnQ7XG4gICAgY2xvc2U6IChmb2N1c0VkaXRvcjogYm9vbGVhbikgPT4gdm9pZDtcbn07XG5cbmxldCBhY3RpdmVQb3B1cDogQWN0aXZlUG9wdXAgfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKTogYm9vbGVhbiB7XG4gICAgLy8gZW1iZWRSZWdpc3RyeSBpcyB1bmRvY3VtZW50ZWQgQVBJLCBzbyBkZWdyYWRlIHRvIHRoZSBsZWdhY3lcbiAgICAvLyBqdW1wLXRvLWJvdHRvbSBiZWhhdmlvciBpZiBpdCBldmVyIGNoYW5nZXMgc2hhcGVcbiAgICBjb25zdCByZWdpc3RyeSA9IChwbHVnaW4uYXBwIGFzIGFueSkuZW1iZWRSZWdpc3RyeTtcbiAgICByZXR1cm4gcGx1Z2luLnNldHRpbmdzLmVuYWJsZVBvcHVwRWRpdG9yID09PSB0cnVlXG4gICAgICAgICYmIHR5cGVvZiByZWdpc3RyeT8uZW1iZWRCeUV4dGVuc2lvbj8ubWQgPT09IFwiZnVuY3Rpb25cIjtcbn1cblxuLy8gQ2xvc2UgZnJvbSB0aGUgZm9vdG5vdGUgaG90a2V5OyByZXR1cm5zIHdoZXRoZXIgYSBwb3B1cCB3YXMgb3Blbiwgc28gdGhlXG4vLyBob3RrZXkgY2FuIHRvZ2dsZSB0aGUgcG9wdXAgaW5zdGVhZCBvZiBpbnNlcnRpbmcgYW5vdGhlciBmb290bm90ZS5cbmV4cG9ydCBmdW5jdGlvbiB0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAoKTogYm9vbGVhbiB7XG4gICAgaWYgKGFjdGl2ZVBvcHVwKSB7XG4gICAgICAgIGFjdGl2ZVBvcHVwLmNsb3NlKHRydWUpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBDbG9zZSB3aXRob3V0IHN0ZWFsaW5nIGZvY3VzIChsZWFmIHN3aXRjaGVkLCBwbHVnaW4gdW5sb2FkaW5nKS5cbmV4cG9ydCBmdW5jdGlvbiBkaXNtaXNzRm9vdG5vdGVQb3B1cCgpIHtcbiAgICBpZiAoYWN0aXZlUG9wdXApIHtcbiAgICAgICAgYWN0aXZlUG9wdXAuY2xvc2UoZmFsc2UpO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5Gb290bm90ZVBvcHVwKFxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXG4gICAgZm9vdG5vdGVJZDogc3RyaW5nLFxuICAgIG9uVW5hdmFpbGFibGU/OiAoKSA9PiB2b2lkLFxuKSB7XG4gICAgZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKTtcblxuICAgIGNvbnN0IG1kVmlldyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICBpZiAoIW1kVmlldyB8fCAhbWRWaWV3LmZpbGUpIHJldHVybjtcblxuICAgIC8vIGEganVzdC1pbnNlcnRlZCBkZXRhaWwgaXMgb25seSBpbmRleGVkIG9uY2UgdGhlIGZpbGUgc2F2ZXM7IGZpbmlzaGluZ1xuICAgIC8vIHRoZSBzYXZlIChhbmQgaXRzIGZvbGQtc3RhdGUgZXZlbnQpIGJlZm9yZSB0aGUgZW1iZWQgZXhpc3RzIGFsc28ga2VlcHNcbiAgICAvLyBpdCBmcm9tIHJlYWNoaW5nIGEgaGFsZi1pbml0aWFsaXplZCBlbWJlZFxuICAgIGF3YWl0IG1kVmlldy5zYXZlKCk7XG4gICAgY29uc3QgZWRpdG9yID0gbWRWaWV3LmVkaXRvcjtcbiAgICBjb25zdCBkb2MgPSBtZFZpZXcuY29udGFpbmVyRWwub3duZXJEb2N1bWVudDtcbiAgICBjb25zdCB3aW4gPSBkb2MuZGVmYXVsdFZpZXcgfHwgd2luZG93O1xuXG4gICAgLy8gYW5jaG9yIGp1c3QgYmVsb3cgdGhlIGN1cnNvciwgZmxpcHBpbmcgYWJvdmUgaXQgbmVhciB0aGUgd2luZG93IGJvdHRvbVxuICAgIGNvbnN0IGNtID0gKGVkaXRvciBhcyBhbnkpLmNtO1xuICAgIGNvbnN0IGNvb3JkcyA9IGNtID8gY20uY29vcmRzQXRQb3MoY20uc3RhdGUuc2VsZWN0aW9uLm1haW4uaGVhZCkgOiBudWxsO1xuICAgIGNvbnN0IHdpZHRoID0gTWF0aC5taW4oNDgwLCB3aW4uaW5uZXJXaWR0aCAtIDMyKTtcbiAgICBjb25zdCBsZWZ0ID0gTWF0aC5tYXgoMTYsIE1hdGgubWluKGNvb3JkcyA/IGNvb3Jkcy5sZWZ0IDogMTAwLCB3aW4uaW5uZXJXaWR0aCAtIHdpZHRoIC0gMTYpKTtcbiAgICBsZXQgdG9wID0gKGNvb3JkcyA/IGNvb3Jkcy5ib3R0b20gOiAxMDApICsgNjtcbiAgICBpZiAodG9wICsgMjYwID4gd2luLmlubmVySGVpZ2h0KSB7XG4gICAgICAgIHRvcCA9IE1hdGgubWF4KDE2LCAoY29vcmRzID8gY29vcmRzLnRvcCA6IDMwMCkgLSAyNjYpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRhaW5lckVsID0gZG9jLmJvZHkuY3JlYXRlRGl2KFwiZm9vdG5vdGUtc2hvcnRjdXQtcG9wdXBcIik7XG4gICAgY29udGFpbmVyRWwuc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xuICAgIGNvbnRhaW5lckVsLnN0eWxlLnRvcCA9IGAke3RvcH1weGA7XG4gICAgY29udGFpbmVyRWwuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XG4gICAgLy8gc3RheSBpbnZpc2libGUgdW50aWwgdGhlIGZvb3Rub3RlIGRldGFpbCBpcyBhY3R1YWxseSBsb2FkZWRcbiAgICBjb250YWluZXJFbC5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIjtcblxuICAgIGNvbnN0IHN1YnBhdGggPSBgI1teJHtmb290bm90ZUlkfV1gO1xuICAgIGNvbnN0IGJ1aWxkRW1iZWQgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGJ1aWx0ID0gKHBsdWdpbi5hcHAgYXMgYW55KS5lbWJlZFJlZ2lzdHJ5LmVtYmVkQnlFeHRlbnNpb24ubWQoXG4gICAgICAgICAgICB7IGFwcDogcGx1Z2luLmFwcCwgbGlua3RleHQ6IHN1YnBhdGgsIHNvdXJjZVBhdGg6IG1kVmlldy5maWxlLnBhdGgsIGNvbnRhaW5lckVsOiBjb250YWluZXJFbCwgZGVwdGg6IDAgfSxcbiAgICAgICAgICAgIG1kVmlldy5maWxlLFxuICAgICAgICAgICAgc3VicGF0aCxcbiAgICAgICAgKTtcbiAgICAgICAgYnVpbHQuZWRpdGFibGUgPSB0cnVlO1xuICAgICAgICBidWlsdC5sb2FkKCk7XG4gICAgICAgIHJldHVybiBidWlsdDtcbiAgICB9O1xuICAgIGxldCBlbWJlZCA9IGJ1aWxkRW1iZWQoKTtcblxuICAgIGxldCBjbG9zZWQgPSBmYWxzZTtcbiAgICBjb25zdCBjbG9zZSA9IChmb2N1c0VkaXRvcjogYm9vbGVhbikgPT4ge1xuICAgICAgICBpZiAoY2xvc2VkKSByZXR1cm47XG4gICAgICAgIGNsb3NlZCA9IHRydWU7XG4gICAgICAgIGFjdGl2ZVBvcHVwID0gbnVsbDtcbiAgICAgICAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgb25Eb2NNb3VzZURvd24sIHRydWUpO1xuICAgICAgICBjb250YWluZXJFbC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGlmIChmb2N1c0VkaXRvcikgZWRpdG9yLmZvY3VzKCk7XG5cbiAgICAgICAgLy8gdGhlIGVtYmVkIHNhdmVzIGVkaXRzIG9uIGl0cyBvd24gZGVib3VuY2U7IGxldCB0aGF0IGN5Y2xlIGZpbmlzaFxuICAgICAgICAvLyBiZWZvcmUgdW5sb2FkaW5nLCBzaW5jZSB1bmxvYWRpbmcgbWlkLXNhdmUgY2xlYXJzIHRoZSBzdGF0ZSB0aGVcbiAgICAgICAgLy8gc2F2ZSByZWFkc1xuICAgICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuICAgICAgICBjb25zdCB0ZWFyZG93biA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICgoZW1iZWQuZGlydHkgfHwgZW1iZWQuc2F2aW5nIHx8IGVtYmVkLnNhdmVBZ2FpbikgJiYgYXR0ZW1wdHMrKyA8IDUwKSB7XG4gICAgICAgICAgICAgICAgd2luLnNldFRpbWVvdXQodGVhcmRvd24sIDEwMCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZW1iZWQudW5sb2FkKCk7XG4gICAgICAgICAgICBjb250YWluZXJFbC5yZW1vdmUoKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGVhcmRvd24oKTtcbiAgICB9O1xuXG4gICAgY29uc3Qgb25Eb2NNb3VzZURvd24gPSAoZXZ0OiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGlmICghY29udGFpbmVyRWwuY29udGFpbnMoZXZ0LnRhcmdldCBhcyBOb2RlKSkgY2xvc2UoZmFsc2UpO1xuICAgIH07XG4gICAgZG9jLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgb25Eb2NNb3VzZURvd24sIHRydWUpO1xuXG4gICAgLy8gYnViYmxlIHBoYXNlLCBzbyB0aGUgZW1iZWRkZWQgZWRpdG9yIChlLmcuIHZpbSBtb2RlIGxlYXZpbmcgaW5zZXJ0XG4gICAgLy8gbW9kZSkgZ2V0cyBmaXJzdCBjbGFpbSBvbiBFc2NhcGVcbiAgICBjb250YWluZXJFbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZ0OiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChldnQua2V5ID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIGNsb3NlKHRydWUpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBhY3RpdmVQb3B1cCA9IHsgY29udGFpbmVyRWwsIGNsb3NlIH07XG5cbiAgICBjb25zdCB0cnlTaG93ID0gYXN5bmMgKCk6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xuICAgICAgICBhd2FpdCBlbWJlZC5sb2FkRmlsZSgpO1xuICAgICAgICBpZiAoZW1iZWQuc3VicGF0aE5vdEZvdW5kKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnRhaW5lckVsLnN0eWxlLnZpc2liaWxpdHkgPSBcIlwiO1xuICAgICAgICBlbWJlZC5zaG93RWRpdG9yKCk7XG4gICAgICAgIGVtYmVkLmVkaXRNb2RlPy5lZGl0b3I/LmZvY3VzKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBjb25zdCB3YWl0Rm9yQ2FjaGVDaGFuZ2UgPSAoKSA9PlxuICAgICAgICBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdGltZW91dCA9IHdpbi5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICBwbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUub2ZmcmVmKHJlZik7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfSwgNTAwKTtcbiAgICAgICAgICAgIGNvbnN0IHJlZiA9IHBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5vbihcImNoYW5nZWRcIiwgKGZpbGUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZmlsZSA9PT0gbWRWaWV3LmZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgd2luLmNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgICAgICAgICAgICAgcGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLm9mZnJlZihyZWYpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgY29uc3Qgc2hvd0VkaXRvciA9IGFzeW5jICgpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcbiAgICAgICAgaWYgKGF3YWl0IHRyeVNob3coKSkgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgLy8gcmV0cnkgYXMgdGhlIG1ldGFkYXRhIGNhY2hlIGNhdGNoZXMgdXAgd2l0aCB0aGUgc2F2ZWQgZmlsZTsgYVxuICAgICAgICAvLyBsb2FkZWQgZW1iZWQgd29uJ3QgcmUtcmVzb2x2ZSBpdHMgc3VicGF0aCwgc28gcmVidWlsZCBlYWNoIHRpbWVcbiAgICAgICAgY29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgMzAwMDtcbiAgICAgICAgd2hpbGUgKERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckNhY2hlQ2hhbmdlKCk7XG4gICAgICAgICAgICBpZiAoY2xvc2VkKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGVtYmVkLnVubG9hZCgpO1xuICAgICAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICAgICAgICAgIGVtYmVkID0gYnVpbGRFbWJlZCgpO1xuICAgICAgICAgICAgaWYgKGF3YWl0IHRyeVNob3coKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICBzaG93RWRpdG9yKClcbiAgICAgICAgLnRoZW4oKHNob3duKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXNob3duICYmICFjbG9zZWQpIHtcbiAgICAgICAgICAgICAgICBjbG9zZShmYWxzZSk7XG4gICAgICAgICAgICAgICAgb25VbmF2YWlsYWJsZT8uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWNsb3NlZCkge1xuICAgICAgICAgICAgICAgIGNsb3NlKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBvblVuYXZhaWxhYmxlPy4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG59XG4iLCJpbXBvcnQge1xuXHRFZGl0b3IsXG5cdEVkaXRvclBvc2l0aW9uLFxuXHRNYXJrZG93blZpZXdcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCBGb290bm90ZVBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5pbXBvcnQgeyBvcGVuRm9vdG5vdGVQb3B1cCwgcG9wdXBFZGl0aW5nQXZhaWxhYmxlLCB0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAgfSBmcm9tIFwiLi9mb290bm90ZS1wb3B1cFwiO1xuXG5leHBvcnQgdmFyIEFsbE1hcmtlcnMgPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdKD8hOikvZGc7XG52YXIgQWxsTnVtYmVyZWRNYXJrZXJzID0gL1xcW1xcXihcXGQrKVxcXS9naTtcbnZhciBBbGxEZXRhaWxzTmFtZU9ubHkgPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdOi9nO1xudmFyIERldGFpbEluTGluZSA9IC9cXFtcXF4oW15cXFtcXF1dKylcXF06LztcbmV4cG9ydCB2YXIgRXh0cmFjdE5hbWVGcm9tRm9vdG5vdGUgPSAvKFxcW1xcXikoW15cXFtcXF1dKykoPz1cXF0pLztcblxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKFxuICAgIGRvYzogRWRpdG9yXG4pIHtcbiAgICBsZXQgRm9vdG5vdGVEZXRhaWxMaXN0OiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vc2VhcmNoIGVhY2ggbGluZSBmb3IgZm9vdG5vdGUgZGV0YWlscyBhbmQgYWRkIHRvIGxpc3RcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XG4gICAgICAgIGxldCB0aGVMaW5lID0gZG9jLmdldExpbmUoaSk7XG4gICAgICAgIGxldCBsaW5lTWF0Y2ggPSB0aGVMaW5lLm1hdGNoKEFsbERldGFpbHNOYW1lT25seSk7XG4gICAgICAgIGlmIChsaW5lTWF0Y2gpIHtcbiAgICAgICAgICAgIGxldCB0ZW1wID0gbGluZU1hdGNoWzBdO1xuICAgICAgICAgICAgdGVtcCA9IHRlbXAucmVwbGFjZShcIlteXCIsXCJcIik7XG4gICAgICAgICAgICB0ZW1wID0gdGVtcC5yZXBsYWNlKFwiXTpcIixcIlwiKTtcblxuICAgICAgICAgICAgRm9vdG5vdGVEZXRhaWxMaXN0LnB1c2godGVtcCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKEZvb3Rub3RlRGV0YWlsTGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiBGb290bm90ZURldGFpbExpc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdEV4aXN0aW5nRm9vdG5vdGVNYXJrZXJzQW5kTG9jYXRpb25zKFxuICAgIGRvYzogRWRpdG9yXG4pIHtcbiAgICB0eXBlIG1hcmtlckVudHJ5ID0ge1xuICAgICAgICBmb290bm90ZTogc3RyaW5nO1xuICAgICAgICBsaW5lTnVtOiBudW1iZXI7XG4gICAgICAgIHN0YXJ0SW5kZXg6IG51bWJlcjtcbiAgICB9XG4gICAgbGV0IG1hcmtlckVudHJ5O1xuXG4gICAgbGV0IEZvb3Rub3RlTWFya2VySW5mbyA9IFtdO1xuICAgIC8vc2VhcmNoIGVhY2ggbGluZSBmb3IgZm9vdG5vdGUgbWFya2Vyc1xuICAgIC8vZm9yIGVhY2gsIGFkZCB0aGVpciBuYW1lLCBsaW5lIG51bWJlciwgYW5kIHN0YXJ0IGluZGV4IHRvIEZvb3Rub3RlTWFya2VySW5mb1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcbiAgICAgICAgbGV0IHRoZUxpbmUgPSBkb2MuZ2V0TGluZShpKTtcbiAgICAgICAgbGV0IGxpbmVNYXRjaDtcblxuICAgICAgICB3aGlsZSAoKGxpbmVNYXRjaCA9IEFsbE1hcmtlcnMuZXhlYyh0aGVMaW5lKSkgIT0gbnVsbCkge1xuICAgICAgICBtYXJrZXJFbnRyeSA9IHtcbiAgICAgICAgICAgIGZvb3Rub3RlOiBsaW5lTWF0Y2hbMF0sXG4gICAgICAgICAgICBsaW5lTnVtOiBpLFxuICAgICAgICAgICAgc3RhcnRJbmRleDogbGluZU1hdGNoLmluZGV4XG4gICAgICAgIH1cbiAgICAgICAgRm9vdG5vdGVNYXJrZXJJbmZvLnB1c2gobWFya2VyRW50cnkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBGb290bm90ZU1hcmtlckluZm87XG59XG5cbmZ1bmN0aW9uIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoXG4gICAgZG9jOiBFZGl0b3IsXG4gICAgb2xkQ3Vyc29yUG9zOiBFZGl0b3JQb3NpdGlvbixcbiAgICBuZXdDdXJzb3JQb3M6IEVkaXRvclBvc2l0aW9uLFxuKTogdm9pZCB7XG4gICAgZG9jLnNldEN1cnNvcihuZXdDdXJzb3JQb3MpO1xuXG4gICAgLy8gaWYgdXNlciBoYXMgdmltIG1vZGUgZW5hYmxlZCwgc2V0IGp1bXAgcG9pbnRcbiAgICBpZiAoYXBwLnZhdWx0LmdldENvbmZpZyhcInZpbU1vZGVcIikpIHtcbiAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICBhY3RpdmVXaW5kb3cuQ29kZU1pcnJvckFkYXB0ZXIuVmltLmdldFZpbUdsb2JhbFN0YXRlXygpLmp1bXBMaXN0LmFkZChcbiAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgICAgIGRvYy5jbS5jbSwgLy8gU0lDIHR3byBsZXZlbHMgZGVlcFxuICAgICAgICAgICAgb2xkQ3Vyc29yUG9zLFxuICAgICAgICAgICAgbmV3Q3Vyc29yUG9zLFxuICAgICAgICApO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIoXG4gICAgbGluZVRleHQ6IHN0cmluZyxcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXG4gICAgZG9jOiBFZGl0b3Jcbikge1xuICAgIC8vIGNoZWNrIGlmIHdlJ3JlIGluIGEgZm9vdG5vdGUgZGV0YWlsIGxpbmUgKFwiW14xXTogZm9vdG5vdGVcIilcbiAgICAvLyBpZiBzbywganVtcCBjdXJzb3IgYmFjayB0byB0aGUgZm9vdG5vdGUgaW4gdGhlIHRleHRcblxuICAgIGxldCBtYXRjaCA9IGxpbmVUZXh0Lm1hdGNoKERldGFpbEluTGluZSk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGxldCBzID0gbWF0Y2hbMF07XG4gICAgICAgIGxldCBpbmRleCA9IHMucmVwbGFjZShcIlteXCIsIFwiXCIpO1xuICAgICAgICBpbmRleCA9IGluZGV4LnJlcGxhY2UoXCJdOlwiLCBcIlwiKTtcbiAgICAgICAgbGV0IGZvb3Rub3RlID0gcy5yZXBsYWNlKFwiOlwiLCBcIlwiKTtcblxuICAgICAgICBsZXQgcmV0dXJuTGluZUluZGV4ID0gY3Vyc29yUG9zaXRpb24ubGluZTtcbiAgICAgICAgLy8gZmluZCB0aGUgRklSU1QgT0NDVVJFTkNFIHdoZXJlIHRoaXMgZm9vdG5vdGUgZXhpc3RzIGluIHRoZSB0ZXh0XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBzY2FuTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xuICAgICAgICAgICAgaWYgKHNjYW5MaW5lLmNvbnRhaW5zKGZvb3Rub3RlKSkge1xuICAgICAgICAgICAgICAgIGxldCBjdXJzb3JMb2NhdGlvbkluZGV4ID0gc2NhbkxpbmUuaW5kZXhPZihmb290bm90ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuTGluZUluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IHJldHVybkxpbmVJbmRleCwgY2g6IGN1cnNvckxvY2F0aW9uSW5kZXggKyBmb290bm90ZS5sZW5ndGggfTtcbiAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24ganVtcFRvRm9vdG5vdGVEZXRhaWwoXG4gICAgZm9vdG5vdGVOYW1lOiBzdHJpbmcsXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxuICAgIGRvYzogRWRpdG9yXG4pIHtcbiAgICAvLyBmaW5kIHRoZSBmaXJzdCBsaW5lIHdpdGggdGhpcyBkZXRhaWwgbWFya2VyIG5hbWUgaW4gaXQuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xuICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xuICAgICAgICBsZXQgbGluZU1hdGNoID0gdGhlTGluZS5tYXRjaChEZXRhaWxJbkxpbmUpO1xuICAgICAgICBpZiAobGluZU1hdGNoKSB7XG4gICAgICAgICAgICAvLyBjb21wYXJlIHRvIHRoZSBpbmRleFxuICAgICAgICAgICAgbGV0IG5hbWVNYXRjaCA9IGxpbmVNYXRjaFsxXTtcbiAgICAgICAgICAgIGlmIChuYW1lTWF0Y2ggPT0gZm9vdG5vdGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBpLCBjaDogbGluZU1hdGNoWzBdLmxlbmd0aCArIDEgfTtcbiAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcbiAgICBkb2M6IEVkaXRvcixcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXG4pIHtcbiAgICAvLyBKdW1wIGN1cnNvciBUTyBkZXRhaWwgbWFya2VyXG5cbiAgICAvLyBkb2VzIHRoaXMgbGluZSBoYXZlIGEgZm9vdG5vdGUgbWFya2VyP1xuICAgIC8vIGRvZXMgdGhlIGN1cnNvciBvdmVybGFwIHdpdGggb25lIG9mIHRoZW0/XG4gICAgLy8gaWYgc28sIHdoaWNoIG9uZT9cbiAgICAvLyBmaW5kIHRoaXMgZm9vdG5vdGUgbWFya2VyJ3MgZGV0YWlsIGxpbmVcbiAgICAvLyBwbGFjZSBjdXJzb3IgdGhlcmVcbiAgICBsZXQgbWFya2VyVGFyZ2V0ID0gbnVsbDtcblxuICAgIGxldCBGb290bm90ZU1hcmtlckluZm8gPSBsaXN0RXhpc3RpbmdGb290bm90ZU1hcmtlcnNBbmRMb2NhdGlvbnMoZG9jKTtcbiAgICBsZXQgY3VycmVudExpbmUgPSBjdXJzb3JQb3NpdGlvbi5saW5lO1xuICAgIGxldCBmb290bm90ZXNPbkxpbmUgPSBGb290bm90ZU1hcmtlckluZm8uZmlsdGVyKChtYXJrZXJFbnRyeTogeyBsaW5lTnVtOiBudW1iZXI7IH0pID0+IG1hcmtlckVudHJ5LmxpbmVOdW0gPT09IGN1cnJlbnRMaW5lKTtcblxuICAgIGlmIChmb290bm90ZXNPbkxpbmUgIT0gbnVsbCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBmb290bm90ZXNPbkxpbmUubGVuZ3RoLTE7IGkrKykge1xuICAgICAgICAgICAgaWYgKGZvb3Rub3Rlc09uTGluZVtpXS5mb290bm90ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGxldCBtYXJrZXIgPSBmb290bm90ZXNPbkxpbmVbaV0uZm9vdG5vdGU7XG4gICAgICAgICAgICAgICAgbGV0IGluZGV4T2ZNYXJrZXJJbkxpbmUgPSBmb290bm90ZXNPbkxpbmVbaV0uc3RhcnRJbmRleDtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPj0gaW5kZXhPZk1hcmtlckluTGluZSAmJlxuICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoIDw9IGluZGV4T2ZNYXJrZXJJbkxpbmUgKyBtYXJrZXIubGVuZ3RoXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgbWFya2VyVGFyZ2V0ID0gbWFya2VyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAobWFya2VyVGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICAgIC8vIGV4dHJhY3QgbmFtZVxuICAgICAgICBsZXQgbWF0Y2ggPSBtYXJrZXJUYXJnZXQubWF0Y2goRXh0cmFjdE5hbWVGcm9tRm9vdG5vdGUpO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIGxldCBmb290bm90ZU5hbWUgPSBtYXRjaFsyXTtcblxuICAgICAgICAgICAgLy8gbWFya2VycyB3aXRob3V0IGEgZGV0YWlsIGxpbmUgZmFsbCB0aHJvdWdoIHRvIHRoZVxuICAgICAgICAgICAgLy8gZGV0YWlsLWNyZWF0aW9uIHBhdGhzXG4gICAgICAgICAgICBsZXQgZGV0YWlscyA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhkb2MpO1xuICAgICAgICAgICAgaWYgKGRldGFpbHMgPT09IG51bGwgfHwgIWRldGFpbHMuaW5jbHVkZXMoZm9vdG5vdGVOYW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW4pKSB7XG4gICAgICAgICAgICAgICAgb3BlbkZvb3Rub3RlUG9wdXAocGx1Z2luLCBmb290bm90ZU5hbWUsICgpID0+XG4gICAgICAgICAgICAgICAgICAgIGp1bXBUb0Zvb3Rub3RlRGV0YWlsKGZvb3Rub3RlTmFtZSwgY3Vyc29yUG9zaXRpb24sIGRvYylcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGp1bXBUb0Zvb3Rub3RlRGV0YWlsKGZvb3Rub3RlTmFtZSwgY3Vyc29yUG9zaXRpb24sIGRvYyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkRm9vdG5vdGVTZWN0aW9uSGVhZGVyKFxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXG4pOiBzdHJpbmcge1xuICAgIC8vY2hlY2sgaWYgJ0VuYWJsZSBGb290bm90ZSBTZWN0aW9uIEhlYWRpbmcnIGlzIHRydWVcbiAgICAvL2lmIHNvLCByZXR1cm4gdGhlIFwiRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nXCJcbiAgICAvLyBlbHNlLCByZXR1cm4gXCJcIlxuXG4gICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nID09IHRydWUpIHtcbiAgICAgICAgbGV0IHJldHVybkhlYWRpbmcgPSBwbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZztcbiAgICAgICAgLy8gdGhlIHNldHRpbmcgaG9sZHMgbGl0ZXJhbCBtYXJrZG93biAobGVnYWN5IHBsYWluLXRleHQgdmFsdWVzIGFyZVxuICAgICAgICAvLyBtaWdyYXRlZCBvbiBsb2FkKTsgYSBkaXZpZGVyIGRpcmVjdGx5IGJlbG93IGEgdGV4dCBsaW5lIHdvdWxkIHR1cm5cbiAgICAgICAgLy8gdGhhdCBsaW5lIGludG8gYSBzZXRleHQgaGVhZGluZywgc28ga2VlcCBhIGJsYW5rIGxpbmUgaW4gYmV0d2VlblxuICAgICAgICBjb25zdCBkaXZpZGVyUmVnZXggPSAvXigtLS18XFwqXFwqXFwqfF9fXykvO1xuICAgICAgICBpZiAoZGl2aWRlclJlZ2V4LnRlc3QocmV0dXJuSGVhZGluZykpIHtcbiAgICAgICAgICAgIHJldHVybiBgXFxuXFxuJHtyZXR1cm5IZWFkaW5nfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGBcXG4ke3JldHVybkhlYWRpbmd9YDtcbiAgICB9XG4gICAgcmV0dXJuIFwiXCI7XG59XG5cbi8qKiBhZGp1c3QgY3Vyc29yIHBvc2l0aW9uIHRvIGluc2VydCBhIGZvb3Rub3RlIG9ubHkgYXQgdGhlIGVuZCBvZiB3b3JkICovXG5mdW5jdGlvbiBhZGp1c3RGb290bm90ZVBvc2l0aW9uKFxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcbiAgICBkb2M6IEVkaXRvcixcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW5cbikge1xuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLmluc2VydEF0RW5kT2ZXb3JkKSByZXR1cm4gY3Vyc29yUG9zaXRpb247XG4gICAgY29uc3QgZW5kT2ZXb3JkVW5kZXJDdXJzb3IgPSBkb2Mud29yZEF0KGN1cnNvclBvc2l0aW9uKT8udG87XG4gICAgaWYgKCFlbmRPZldvcmRVbmRlckN1cnNvcikgcmV0dXJuIGN1cnNvclBvc2l0aW9uOyAvLyBubyB3b3JkIHVuZGVyIGN1cnNvclxuXG4gICAgLy8gYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB0byBpbnNlcnQgYSBmb290bm90ZSBvbmx5IGF0IHRoZSBlbmQgb2Ygd29yZFxuICAgIGNvbnN0IG5leHRDaGFyID0gbGluZVRleHQuY2hhckF0KGVuZE9mV29yZFVuZGVyQ3Vyc29yLmNoKTtcbiAgICBpZiAoW1wiLlwiLCBcIixcIiwgXCI6XCIsIFwiO1wiXS5pbmNsdWRlcyhuZXh0Q2hhcikpIGVuZE9mV29yZFVuZGVyQ3Vyc29yLmNoKys7XG4gICAgY3Vyc29yUG9zaXRpb24gPSBlbmRPZldvcmRVbmRlckN1cnNvcjtcbiAgICByZXR1cm4gY3Vyc29yUG9zaXRpb247XG59XG5cbi8vRlVOQ1RJT05TIEZPUiBBVVRPTlVNQkVSRUQgRk9PVE5PVEVTXG5cbmV4cG9ydCBmdW5jdGlvbiBpbnNlcnRBdXRvbnVtRm9vdG5vdGUocGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xuICAgIC8vIHByZXNzaW5nIHRoZSBob3RrZXkgd2hpbGUgdGhlIHBvcHVwIGVkaXRvciBpcyBvcGVuIGNsb3NlcyBpdFxuICAgIGlmICh0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAoKSkgcmV0dXJuO1xuXG4gICAgY29uc3QgbWRWaWV3ID0gYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG5cbiAgICBpZiAoIW1kVmlldykgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChtZFZpZXcuZWRpdG9yID09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmVkaXRvcjtcbiAgICBjb25zdCBjdXJzb3JQb3NpdGlvbiA9IGRvYy5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lVGV4dCA9IGRvYy5nZXRMaW5lKGN1cnNvclBvc2l0aW9uLmxpbmUpO1xuICAgIGNvbnN0IG1hcmtkb3duVGV4dCA9IG1kVmlldy5kYXRhO1xuXG4gICAgaWYgKHNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MpKVxuICAgICAgICByZXR1cm47XG4gICAgaWYgKHNob3VsZEp1bXBGcm9tTWFya2VyVG9EZXRhaWwobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MsIHBsdWdpbikpXG4gICAgICAgIHJldHVybjtcblxuICAgIHJldHVybiBzaG91bGRDcmVhdGVBdXRvbnVtRm9vdG5vdGUoXG4gICAgICAgIGxpbmVUZXh0LFxuICAgICAgICBjdXJzb3JQb3NpdGlvbixcbiAgICAgICAgcGx1Z2luLFxuICAgICAgICBkb2MsXG4gICAgICAgIG1hcmtkb3duVGV4dFxuICAgICk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZUF1dG9udW1Gb290bm90ZShcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxuICAgIGRvYzogRWRpdG9yLFxuICAgIG1hcmtkb3duVGV4dDogc3RyaW5nXG4pIHtcbiAgICBjdXJzb3JQb3NpdGlvbiA9IGFkanVzdEZvb3Rub3RlUG9zaXRpb24oY3Vyc29yUG9zaXRpb24sIGRvYywgbGluZVRleHQsIHBsdWdpbik7XG5cbiAgICAvLyBjcmVhdGUgbmV3IGZvb3Rub3RlIHdpdGggdGhlIG5leHQgbnVtZXJpY2FsIGluZGV4XG4gICAgbGV0IG1hdGNoZXMgPSBtYXJrZG93blRleHQubWF0Y2goQWxsTnVtYmVyZWRNYXJrZXJzKTtcbiAgICBsZXQgbnVtYmVyczogQXJyYXk8bnVtYmVyPiA9IFtdO1xuICAgIGxldCBjdXJyZW50TWF4ID0gMTtcblxuICAgIGlmIChtYXRjaGVzICE9IG51bGwpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gbWF0Y2hlcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBtYXRjaCA9IG1hdGNoZXNbaV07XG4gICAgICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoXCJbXlwiLCBcIlwiKTtcbiAgICAgICAgICAgIG1hdGNoID0gbWF0Y2gucmVwbGFjZShcIl1cIiwgXCJcIik7XG4gICAgICAgICAgICBsZXQgbWF0Y2hOdW1iZXIgPSBOdW1iZXIobWF0Y2gpO1xuICAgICAgICAgICAgbnVtYmVyc1tpXSA9IG1hdGNoTnVtYmVyO1xuICAgICAgICAgICAgaWYgKG1hdGNoTnVtYmVyICsgMSA+IGN1cnJlbnRNYXgpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50TWF4ID0gbWF0Y2hOdW1iZXIgKyAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGZvb3ROb3RlSWQgPSBjdXJyZW50TWF4O1xuICAgIGxldCBmb290bm90ZU1hcmtlciA9IGBbXiR7Zm9vdE5vdGVJZH1dYDtcbiAgICBsZXQgbGluZVBhcnQxID0gbGluZVRleHQuc3Vic3RyKDAsIGN1cnNvclBvc2l0aW9uLmNoKTtcbiAgICBsZXQgbGluZVBhcnQyID0gbGluZVRleHQuc3Vic3RyKGN1cnNvclBvc2l0aW9uLmNoKTtcbiAgICBsZXQgbmV3TGluZSA9IGxpbmVQYXJ0MSArIGZvb3Rub3RlTWFya2VyICsgbGluZVBhcnQyO1xuXG4gICAgZG9jLnJlcGxhY2VSYW5nZShcbiAgICAgICAgbmV3TGluZSxcbiAgICAgICAgeyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogMCB9LFxuICAgICAgICB7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiBsaW5lVGV4dC5sZW5ndGggfVxuICAgICk7XG5cbiAgICBsZXQgbGFzdExpbmVJbmRleCA9IGRvYy5sYXN0TGluZSgpO1xuICAgIGxldCBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xuXG4gICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9PT0gdHJ1ZSkge1xuICAgICAgICB3aGlsZSAobGFzdExpbmVJbmRleCA+IDApIHtcbiAgICAgICAgICAgIGxhc3RMaW5lID0gZG9jLmdldExpbmUobGFzdExpbmVJbmRleCk7XG4gICAgICAgICAgICBpZiAobGFzdExpbmUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGRvYy5yZXBsYWNlUmFuZ2UoXG4gICAgICAgICAgICAgICAgICAgIFwiXCIsXG4gICAgICAgICAgICAgICAgICAgIHsgbGluZTogbGFzdExpbmVJbmRleCwgY2g6IDAgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBsaW5lOiBkb2MubGFzdExpbmUoKSwgY2g6IDAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0TGluZUluZGV4LS07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgZm9vdG5vdGVEZXRhaWwgPSBgXFxuW14ke2Zvb3ROb3RlSWR9XTogYDtcblxuICAgIGxldCBsaXN0ID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKGRvYyk7XG4gICAgXG4gICAgbGV0IG5ld0N1cnNvclBvczogRWRpdG9yUG9zaXRpb247XG4gICAgaWYgKGxpc3Q9PT1udWxsICYmIGN1cnJlbnRNYXggPT0gMSkge1xuICAgICAgICBmb290bm90ZURldGFpbCA9IFwiXFxuXCIgKyBmb290bm90ZURldGFpbDtcbiAgICAgICAgbGV0IEhlYWRpbmcgPSBhZGRGb290bm90ZVNlY3Rpb25IZWFkZXIocGx1Z2luKTtcbiAgICAgICAgZG9jLnNldExpbmUoZG9jLmxhc3RMaW5lKCksIGxhc3RMaW5lICsgSGVhZGluZyArIGZvb3Rub3RlRGV0YWlsKTtcbiAgICAgICAgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBkb2MubGFzdExpbmUoKSAtIDEsIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBkb2Muc2V0TGluZShkb2MubGFzdExpbmUoKSwgbGFzdExpbmUgKyBmb290bm90ZURldGFpbCk7XG4gICAgICAgIG5ld0N1cnNvclBvcyA9IHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cbiAgICB9XG5cbiAgICBpZiAocG9wdXBFZGl0aW5nQXZhaWxhYmxlKHBsdWdpbikpIHtcbiAgICAgICAgLy8gdHlwZSB0aGUgZGV0YWlsIGluIGEgcG9wdXAgaW5zdGVhZCBvZiBqdW1waW5nIHRvIHRoZSBib3R0b21cbiAgICAgICAgZG9jLnNldEN1cnNvcih7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiBjdXJzb3JQb3NpdGlvbi5jaCArIGZvb3Rub3RlTWFya2VyLmxlbmd0aCB9KTtcbiAgICAgICAgb3BlbkZvb3Rub3RlUG9wdXAocGx1Z2luLCBTdHJpbmcoZm9vdE5vdGVJZCksICgpID0+XG4gICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcylcbiAgICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcylcbiAgICB9XG59XG5cblxuLy9GVU5DVElPTlMgRk9SIE5BTUVEIEZPT1ROT1RFU1xuXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0TmFtZWRGb290bm90ZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKSB7XG4gICAgLy8gcHJlc3NpbmcgdGhlIGhvdGtleSB3aGlsZSB0aGUgcG9wdXAgZWRpdG9yIGlzIG9wZW4gY2xvc2VzIGl0XG4gICAgaWYgKHRvZ2dsZUNsb3NlRm9vdG5vdGVQb3B1cCgpKSByZXR1cm47XG5cbiAgICBjb25zdCBtZFZpZXcgPSBhcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcblxuICAgIGlmICghbWRWaWV3KSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG1kVmlldy5lZGl0b3IgPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBkb2MgPSBtZFZpZXcuZWRpdG9yO1xuICAgIGNvbnN0IGN1cnNvclBvc2l0aW9uID0gZG9jLmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVUZXh0ID0gZG9jLmdldExpbmUoY3Vyc29yUG9zaXRpb24ubGluZSk7XG4gICAgY29uc3QgbWFya2Rvd25UZXh0ID0gbWRWaWV3LmRhdGE7XG5cbiAgICBpZiAoc2hvdWxkSnVtcEZyb21EZXRhaWxUb01hcmtlcihsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYykpXG4gICAgICAgIHJldHVybjtcbiAgICBpZiAoc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYywgcGx1Z2luKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKHNob3VsZENyZWF0ZU1hdGNoaW5nRm9vdG5vdGVEZXRhaWwobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBwbHVnaW4sIGRvYykpXG4gICAgICAgIHJldHVybjsgXG4gICAgcmV0dXJuIHNob3VsZENyZWF0ZUZvb3Rub3RlTWFya2VyKFxuICAgICAgICBsaW5lVGV4dCxcbiAgICAgICAgY3Vyc29yUG9zaXRpb24sXG4gICAgICAgIGRvYyxcbiAgICAgICAgbWFya2Rvd25UZXh0LFxuICAgICAgICBwbHVnaW5cbiAgICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ3JlYXRlTWF0Y2hpbmdGb290bm90ZURldGFpbChcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxuICAgIGRvYzogRWRpdG9yXG4pIHtcbiAgICAvLyBDcmVhdGUgbWF0Y2hpbmcgZm9vdG5vdGUgZGV0YWlsIGZvciBmb290bm90ZSBtYXJrZXJcbiAgICBcbiAgICAvLyBkb2VzIHRoaXMgbGluZSBoYXZlIGEgZm9vdG5vdGUgbWFya2VyP1xuICAgIC8vIGRvZXMgdGhlIGN1cnNvciBvdmVybGFwIHdpdGggb25lIG9mIHRoZW0/XG4gICAgLy8gaWYgc28sIHdoaWNoIG9uZT9cbiAgICAvLyBkb2VzIHRoaXMgZm9vdG5vdGUgbWFya2VyIGhhdmUgYSBkZXRhaWwgbGluZT9cbiAgICAvLyBpZiBub3QsIGNyZWF0ZSBpdCBhbmQgcGxhY2UgY3Vyc29yIHRoZXJlXG4gICAgbGV0IHJlT25seU1hcmtlcnNNYXRjaGVzID0gbGluZVRleHQubWF0Y2goQWxsTWFya2Vycyk7XG5cbiAgICBsZXQgbWFya2VyVGFyZ2V0ID0gbnVsbDtcblxuICAgIGlmIChyZU9ubHlNYXJrZXJzTWF0Y2hlcyl7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IHJlT25seU1hcmtlcnNNYXRjaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgbWFya2VyID0gcmVPbmx5TWFya2Vyc01hdGNoZXNbaV07XG4gICAgICAgICAgICBpZiAobWFya2VyICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGxldCBpbmRleE9mTWFya2VySW5MaW5lID0gbGluZVRleHQuaW5kZXhPZihtYXJrZXIpO1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPj0gaW5kZXhPZk1hcmtlckluTGluZSAmJlxuICAgICAgICAgICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA8PSBpbmRleE9mTWFya2VySW5MaW5lICsgbWFya2VyLmxlbmd0aFxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICBtYXJrZXJUYXJnZXQgPSBtYXJrZXI7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXJrZXJUYXJnZXQgIT0gbnVsbCkge1xuICAgICAgICAvL2V4dHJhY3QgZm9vdG5vdGVcbiAgICAgICAgbGV0IG1hdGNoID0gbWFya2VyVGFyZ2V0Lm1hdGNoKEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlKVxuICAgICAgICAvL2ZpbmQgaWYgdGhpcyBmb290bm90ZSBleGlzdHMgYnkgbGlzdGluZyBleGlzdGluZyBmb290bm90ZSBkZXRhaWxzXG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgbGV0IGZvb3Rub3RlSWQgPSBtYXRjaFsyXTtcblxuICAgICAgICAgICAgbGV0IGxpc3Q6IHN0cmluZ1tdID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKGRvYyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBsaXN0IGlzIGVtcHR5IE9SIGlmIHRoZSBsaXN0IGRvZXNuJ3QgaW5jbHVkZSBjdXJyZW50IGZvb3Rub3RlXG4gICAgICAgICAgICAvLyBpZiBzbywgYWRkIGRldGFpbCBmb3IgdGhlIGN1cnJlbnQgZm9vdG5vdGVcbiAgICAgICAgICAgIGlmKGxpc3QgPT09IG51bGwgfHwgIWxpc3QuaW5jbHVkZXMoZm9vdG5vdGVJZCkpIHtcbiAgICAgICAgICAgICAgICBsZXQgbGFzdExpbmVJbmRleCA9IGRvYy5sYXN0TGluZSgpO1xuICAgICAgICAgICAgICAgIGxldCBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAobGFzdExpbmVJbmRleCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RMaW5lID0gZG9jLmdldExpbmUobGFzdExpbmVJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFzdExpbmUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvYy5yZXBsYWNlUmFuZ2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGluZTogbGFzdExpbmVJbmRleCwgY2g6IDAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsaW5lOiBkb2MubGFzdExpbmUoKSwgY2g6IDAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0TGluZUluZGV4LS07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbGV0IGZvb3Rub3RlRGV0YWlsID0gYFxcblteJHtmb290bm90ZUlkfV06IGA7XG5cbiAgICAgICAgICAgICAgICBsZXQgbmV3Q3Vyc29yUG9zOiBFZGl0b3JQb3NpdGlvbjtcbiAgICAgICAgICAgICAgICBpZiAobGlzdD09PW51bGwgfHwgbGlzdC5sZW5ndGggPCAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvb3Rub3RlRGV0YWlsID0gXCJcXG5cIiArIGZvb3Rub3RlRGV0YWlsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgSGVhZGluZyA9IGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihwbHVnaW4pO1xuICAgICAgICAgICAgICAgICAgICBkb2Muc2V0TGluZShkb2MubGFzdExpbmUoKSwgbGFzdExpbmUgKyBIZWFkaW5nICsgZm9vdG5vdGVEZXRhaWwpO1xuICAgICAgICAgICAgICAgICAgICBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGRvYy5sYXN0TGluZSgpIC0gMSwgY2g6IGZvb3Rub3RlRGV0YWlsLmxlbmd0aCAtIDEgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIGZvb3Rub3RlRGV0YWlsKTtcbiAgICAgICAgICAgICAgICAgICAgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBkb2MubGFzdExpbmUoKSwgY2g6IGZvb3Rub3RlRGV0YWlsLmxlbmd0aCAtIDEgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyB0eXBlIHRoZSBkZXRhaWwgaW4gYSBwb3B1cCBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbVxuICAgICAgICAgICAgICAgICAgICBvcGVuRm9vdG5vdGVQb3B1cChwbHVnaW4sIGZvb3Rub3RlSWQsICgpID0+XG4gICAgICAgICAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcylcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcylcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjsgXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDcmVhdGVGb290bm90ZU1hcmtlcihcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcbiAgICBkb2M6IEVkaXRvcixcbiAgICBtYXJrZG93blRleHQ6IHN0cmluZyxcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXG4pIHtcbiAgICBjdXJzb3JQb3NpdGlvbiA9IGFkanVzdEZvb3Rub3RlUG9zaXRpb24oY3Vyc29yUG9zaXRpb24sIGRvYywgbGluZVRleHQsIHBsdWdpbik7XG5cbiAgICAvL2NyZWF0ZSBlbXB0eSBmb290bm90ZSBtYXJrZXIgZm9yIG5hbWUgaW5wdXRcbiAgICBsZXQgZW1wdHlNYXJrZXIgPSBgW15dYDtcbiAgICBkb2MucmVwbGFjZVJhbmdlKGVtcHR5TWFya2VyLGN1cnNvclBvc2l0aW9uKTtcbiAgICAvL21vdmUgY3Vyc29yIGluIGJldHdlZW4gW14gYW5kIF1cbiAgICBjb25zdCBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiBjdXJzb3JQb3NpdGlvbi5jaCArIDIgfVxuICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zKVxuICAgIC8vb3BlbiBmb290bm90ZVBpY2tlciBwb3B1cFxuICAgIFxufVxuIiwiaW1wb3J0IHtcclxuICBhZGRJY29uLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBQbHVnaW5cclxufSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmltcG9ydCB7IEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYiwgRm9vdG5vdGVQbHVnaW5TZXR0aW5ncywgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XHJcbmltcG9ydCB7IGRpc21pc3NGb290bm90ZVBvcHVwIH0gZnJvbSBcIi4vZm9vdG5vdGUtcG9wdXBcIjtcclxuaW1wb3J0IHsgaW5zZXJ0QXV0b251bUZvb3Rub3RlLGluc2VydE5hbWVkRm9vdG5vdGUgfSBmcm9tIFwiLi9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzXCI7XHJcblxyXG4vL0FkZCBjaGV2cm9uLXVwLXNxdWFyZSBpY29uIGZyb20gbHVjaWRlIGZvciBtb2JpbGUgdG9vbGJhciAodGVtcG9yYXJ5IHVudGlsIE9ic2lkaWFuIHVwZGF0ZXMgdG8gTHVjaWRlIHYwLjEzMC4wKVxyXG5hZGRJY29uKFwiY2hldnJvbi11cC1zcXVhcmVcIiwgYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBjbGFzcz1cImx1Y2lkZSBsdWNpZGUtY2hldnJvbi11cC1zcXVhcmVcIj48cmVjdCB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB4PVwiM1wiIHk9XCIzXCIgcng9XCIyXCIgcnk9XCIyXCI+PC9yZWN0Pjxwb2x5bGluZSBwb2ludHM9XCI4LDE0IDEyLDEwIDE2LDE0XCI+PC9wb2x5bGluZT48L3N2Zz5gKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvb3Rub3RlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICBwdWJsaWMgc2V0dGluZ3M6IEZvb3Rub3RlUGx1Z2luU2V0dGluZ3M7XHJcblxyXG4gIGFzeW5jIG9ubG9hZCgpIHtcclxuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiaW5zZXJ0LWF1dG9udW1iZXJlZC1mb290bm90ZVwiLFxyXG4gICAgICBuYW1lOiBcIkluc2VydCAvIE5hdmlnYXRlIEF1dG8tTnVtYmVyZWQgRm9vdG5vdGVcIixcclxuICAgICAgaWNvbjogXCJwbHVzLXNxdWFyZVwiLFxyXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcclxuICAgICAgICBpZiAoY2hlY2tpbmcpXHJcbiAgICAgICAgICByZXR1cm4gISF0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgICAgIGluc2VydEF1dG9udW1Gb290bm90ZSh0aGlzKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiaW5zZXJ0LW5hbWVkLWZvb3Rub3RlXCIsXHJcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IC8gTmF2aWdhdGUgTmFtZWQgRm9vdG5vdGVcIixcclxuICAgICAgaWNvbjogXCJjaGV2cm9uLXVwLXNxdWFyZVwiLFxyXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcclxuICAgICAgICBpZiAoY2hlY2tpbmcpXHJcbiAgICAgICAgICByZXR1cm4gISF0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgICAgIGluc2VydE5hbWVkRm9vdG5vdGUodGhpcyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIFxyXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBGb290bm90ZVBsdWdpblNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiBkaXNtaXNzRm9vdG5vdGVQb3B1cCgpKVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIG9udW5sb2FkKCkge1xyXG4gICAgZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xyXG5cclxuICAgIC8vIG1pZ3JhdGUgcHJlLTEuMC40IHNlY3Rpb24gaGVhZGluZyB2YWx1ZXM6IHRoZSBvbGQgdGV4dCBpbnB1dCBpbXBsaWVkXHJcbiAgICAvLyBhbiBIMSwgdGhlIHRleHRhcmVhIHRha2VzIGxpdGVyYWwgbWFya2Rvd24sIHNvIGNvbnZlcnQgb25jZSBhbmQgc2F2ZVxyXG4gICAgY29uc3QgaGVhZGluZyA9IHRoaXMuc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZztcclxuICAgIGlmIChoZWFkaW5nICYmICEvXigjezEsNn0gfC0tLXxcXCpcXCpcXCp8X19fKS8udGVzdChoZWFkaW5nKSkge1xyXG4gICAgICB0aGlzLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmcgPSBgIyAke2hlYWRpbmd9YDtcclxuICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBkcm9wIHRoZSBzZXR0aW5nIGZvciB0aGUgcmVtb3ZlZCBhdXRvc3VnZ2VzdCBmZWF0dXJlIChPYnNpZGlhbiBub3dcclxuICAgIC8vIHN1Z2dlc3RzIGZvb3Rub3RlcyBuYXRpdmVseSlcclxuICAgIGlmIChcImVuYWJsZUF1dG9TdWdnZXN0XCIgaW4gdGhpcy5zZXR0aW5ncykge1xyXG4gICAgICBkZWxldGUgKHRoaXMuc2V0dGluZ3MgYXMgYW55KS5lbmFibGVBdXRvU3VnZ2VzdDtcclxuICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcclxuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XHJcbiAgfVxyXG59Il0sIm5hbWVzIjpbIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwiTWFya2Rvd25WaWV3IiwiYWRkSWNvbiIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFvR0E7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FB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
