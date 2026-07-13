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
                type: "group",
                heading: "Footnotes Section",
                items: [
                    {
                        name: "Trim blank lines",
                        desc: "Remove blank lines from the end of the note when inserting a new footnotes section.",
                        control: { type: "toggle", key: "enableRemoveBlankLastLines" },
                    },
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
            .setName("Footnotes Section")
            .setHeading();
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

var AllMarkers = /\[\^([^\[\]]+)\](?!:)/g;
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
    return FootnoteDetailList;
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
function moveCursorAndSetJumpPoint(doc, oldCursorPos, newCursorPos, plugin) {
    doc.setCursor(newCursorPos);
    // if user has vim mode enabled, set jump point
    // getConfig is private API, like the vim internals below
    if (plugin.app.vault.getConfig("vimMode")) {
        // @ts-expect-error
        activeWindow.CodeMirrorAdapter.Vim.getVimGlobalState_().jumpList.add(
        // @ts-expect-error
        doc.cm.cm, // SIC two levels deep
        oldCursorPos, newCursorPos);
    }
}
function shouldJumpFromDetailToMarker(lineText, cursorPosition, doc, plugin) {
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
                moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin);
                return true;
            }
        }
    }
    return false;
}
function jumpToFootnoteDetail(footnoteName, cursorPosition, doc, plugin) {
    // find the first line with this detail marker name in it.
    for (let i = 0; i < doc.lineCount(); i++) {
        let theLine = doc.getLine(i);
        let lineMatch = theLine.match(DetailInLine);
        if (lineMatch) {
            // compare to the index
            let nameMatch = lineMatch[1];
            if (nameMatch == footnoteName) {
                const newCursorPos = { line: i, ch: lineMatch[0].length + 1 };
                moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin);
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
            if (!details.includes(footnoteName)) {
                return false;
            }
            if (popupEditingAvailable(plugin)) {
                openFootnotePopup(plugin, footnoteName, () => jumpToFootnoteDetail(footnoteName, cursorPosition, doc, plugin));
                return true;
            }
            return jumpToFootnoteDetail(footnoteName, cursorPosition, doc, plugin);
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
    const mdView = plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!mdView)
        return false;
    if (mdView.editor == undefined)
        return false;
    const doc = mdView.editor;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;
    if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc, plugin))
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
    if (list.length === 0 && currentMax == 1) {
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
        openFootnotePopup(plugin, String(footNoteId), () => moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin));
    }
    else {
        moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin);
    }
}
//FUNCTIONS FOR NAMED FOOTNOTES
function insertNamedFootnote(plugin) {
    // pressing the hotkey while the popup editor is open closes it
    if (toggleCloseFootnotePopup())
        return;
    const mdView = plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!mdView)
        return false;
    if (mdView.editor == undefined)
        return false;
    const doc = mdView.editor;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;
    if (shouldJumpFromDetailToMarker(lineText, cursorPosition, doc, plugin))
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
            // Check if the list doesn't include current footnote
            // if so, add detail for the current footnote
            if (!list.includes(footnoteId)) {
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
                if (list.length === 0) {
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
                    openFootnotePopup(plugin, footnoteId, () => moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin));
                }
                else {
                    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin);
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
    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9mb290bm90ZS1wb3B1cC50cyIsInNyYy9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlLCBTdXBwcmVzc2VkRXJyb3IsIFN5bWJvbCwgSXRlcmF0b3IgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXNEZWNvcmF0ZShjdG9yLCBkZXNjcmlwdG9ySW4sIGRlY29yYXRvcnMsIGNvbnRleHRJbiwgaW5pdGlhbGl6ZXJzLCBleHRyYUluaXRpYWxpemVycykge1xyXG4gICAgZnVuY3Rpb24gYWNjZXB0KGYpIHsgaWYgKGYgIT09IHZvaWQgMCAmJiB0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRnVuY3Rpb24gZXhwZWN0ZWRcIik7IHJldHVybiBmOyB9XHJcbiAgICB2YXIga2luZCA9IGNvbnRleHRJbi5raW5kLCBrZXkgPSBraW5kID09PSBcImdldHRlclwiID8gXCJnZXRcIiA6IGtpbmQgPT09IFwic2V0dGVyXCIgPyBcInNldFwiIDogXCJ2YWx1ZVwiO1xyXG4gICAgdmFyIHRhcmdldCA9ICFkZXNjcmlwdG9ySW4gJiYgY3RvciA/IGNvbnRleHRJbltcInN0YXRpY1wiXSA/IGN0b3IgOiBjdG9yLnByb3RvdHlwZSA6IG51bGw7XHJcbiAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JJbiB8fCAodGFyZ2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGNvbnRleHRJbi5uYW1lKSA6IHt9KTtcclxuICAgIHZhciBfLCBkb25lID0gZmFsc2U7XHJcbiAgICBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4pIGNvbnRleHRbcF0gPSBwID09PSBcImFjY2Vzc1wiID8ge30gOiBjb250ZXh0SW5bcF07XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4uYWNjZXNzKSBjb250ZXh0LmFjY2Vzc1twXSA9IGNvbnRleHRJbi5hY2Nlc3NbcF07XHJcbiAgICAgICAgY29udGV4dC5hZGRJbml0aWFsaXplciA9IGZ1bmN0aW9uIChmKSB7IGlmIChkb25lKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFkZCBpbml0aWFsaXplcnMgYWZ0ZXIgZGVjb3JhdGlvbiBoYXMgY29tcGxldGVkXCIpOyBleHRyYUluaXRpYWxpemVycy5wdXNoKGFjY2VwdChmIHx8IG51bGwpKTsgfTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gKDAsIGRlY29yYXRvcnNbaV0pKGtpbmQgPT09IFwiYWNjZXNzb3JcIiA/IHsgZ2V0OiBkZXNjcmlwdG9yLmdldCwgc2V0OiBkZXNjcmlwdG9yLnNldCB9IDogZGVzY3JpcHRvcltrZXldLCBjb250ZXh0KTtcclxuICAgICAgICBpZiAoa2luZCA9PT0gXCJhY2Nlc3NvclwiKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHZvaWQgMCkgY29udGludWU7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZFwiKTtcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmdldCkpIGRlc2NyaXB0b3IuZ2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LnNldCkpIGRlc2NyaXB0b3Iuc2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmluaXQpKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoXyA9IGFjY2VwdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIGlmIChraW5kID09PSBcImZpZWxkXCIpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgICAgICBlbHNlIGRlc2NyaXB0b3Jba2V5XSA9IF87XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRhcmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgY29udGV4dEluLm5hbWUsIGRlc2NyaXB0b3IpO1xyXG4gICAgZG9uZSA9IHRydWU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19ydW5Jbml0aWFsaXplcnModGhpc0FyZywgaW5pdGlhbGl6ZXJzLCB2YWx1ZSkge1xyXG4gICAgdmFyIHVzZVZhbHVlID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRpYWxpemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhbHVlID0gdXNlVmFsdWUgPyBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnLCB2YWx1ZSkgOiBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1c2VWYWx1ZSA/IHZhbHVlIDogdm9pZCAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcHJvcEtleSh4KSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwic3ltYm9sXCIgPyB4IDogXCJcIi5jb25jYXQoeCk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zZXRGdW5jdGlvbk5hbWUoZiwgbmFtZSwgcHJlZml4KSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3ltYm9sXCIpIG5hbWUgPSBuYW1lLmRlc2NyaXB0aW9uID8gXCJbXCIuY29uY2F0KG5hbWUuZGVzY3JpcHRpb24sIFwiXVwiKSA6IFwiXCI7XHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGYsIFwibmFtZVwiLCB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHByZWZpeCA/IFwiXCIuY29uY2F0KHByZWZpeCwgXCIgXCIsIG5hbWUpIDogbmFtZSB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGcgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEl0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpO1xyXG4gICAgcmV0dXJuIGcubmV4dCA9IHZlcmIoMCksIGdbXCJ0aHJvd1wiXSA9IHZlcmIoMSksIGdbXCJyZXR1cm5cIl0gPSB2ZXJiKDIpLCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBBc3luY0l0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBBc3luY0l0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpLCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIsIGF3YWl0UmV0dXJuKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gYXdhaXRSZXR1cm4oZikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGYsIHJlamVjdCk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpZiAoZ1tuXSkgeyBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyBpZiAoZikgaVtuXSA9IGYoaVtuXSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IGZhbHNlIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbnZhciBvd25LZXlzID0gZnVuY3Rpb24obykge1xyXG4gICAgb3duS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIHx8IGZ1bmN0aW9uIChvKSB7XHJcbiAgICAgICAgdmFyIGFyID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgayBpbiBvKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIGspKSBhclthci5sZW5ndGhdID0gaztcclxuICAgICAgICByZXR1cm4gYXI7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIG93bktleXMobyk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayA9IG93bktleXMobW9kKSwgaSA9IDA7IGkgPCBrLmxlbmd0aDsgaSsrKSBpZiAoa1tpXSAhPT0gXCJkZWZhdWx0XCIpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwga1tpXSk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4oc3RhdGUsIHJlY2VpdmVyKSB7XHJcbiAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwgfHwgKHR5cGVvZiByZWNlaXZlciAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcmVjZWl2ZXIgIT09IFwiZnVuY3Rpb25cIikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgdXNlICdpbicgb3BlcmF0b3Igb24gbm9uLW9iamVjdFwiKTtcclxuICAgIHJldHVybiB0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyID09PSBzdGF0ZSA6IHN0YXRlLmhhcyhyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZShlbnYsIHZhbHVlLCBhc3luYykge1xyXG4gICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkLlwiKTtcclxuICAgICAgICB2YXIgZGlzcG9zZSwgaW5uZXI7XHJcbiAgICAgICAgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmFzeW5jRGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0Rpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmFzeW5jRGlzcG9zZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkaXNwb3NlID09PSB2b2lkIDApIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuZGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5kaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5kaXNwb3NlXTtcclxuICAgICAgICAgICAgaWYgKGFzeW5jKSBpbm5lciA9IGRpc3Bvc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2YgZGlzcG9zZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IG5vdCBkaXNwb3NhYmxlLlwiKTtcclxuICAgICAgICBpZiAoaW5uZXIpIGRpc3Bvc2UgPSBmdW5jdGlvbigpIHsgdHJ5IHsgaW5uZXIuY2FsbCh0aGlzKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7IH0gfTtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IHZhbHVlOiB2YWx1ZSwgZGlzcG9zZTogZGlzcG9zZSwgYXN5bmM6IGFzeW5jIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoYXN5bmMpIHtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IGFzeW5jOiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG5cclxufVxyXG5cclxudmFyIF9TdXBwcmVzc2VkRXJyb3IgPSB0eXBlb2YgU3VwcHJlc3NlZEVycm9yID09PSBcImZ1bmN0aW9uXCIgPyBTdXBwcmVzc2VkRXJyb3IgOiBmdW5jdGlvbiAoZXJyb3IsIHN1cHByZXNzZWQsIG1lc3NhZ2UpIHtcclxuICAgIHZhciBlID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xyXG4gICAgcmV0dXJuIGUubmFtZSA9IFwiU3VwcHJlc3NlZEVycm9yXCIsIGUuZXJyb3IgPSBlcnJvciwgZS5zdXBwcmVzc2VkID0gc3VwcHJlc3NlZCwgZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2Rpc3Bvc2VSZXNvdXJjZXMoZW52KSB7XHJcbiAgICBmdW5jdGlvbiBmYWlsKGUpIHtcclxuICAgICAgICBlbnYuZXJyb3IgPSBlbnYuaGFzRXJyb3IgPyBuZXcgX1N1cHByZXNzZWRFcnJvcihlLCBlbnYuZXJyb3IsIFwiQW4gZXJyb3Igd2FzIHN1cHByZXNzZWQgZHVyaW5nIGRpc3Bvc2FsLlwiKSA6IGU7XHJcbiAgICAgICAgZW52Lmhhc0Vycm9yID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIHZhciByLCBzID0gMDtcclxuICAgIGZ1bmN0aW9uIG5leHQoKSB7XHJcbiAgICAgICAgd2hpbGUgKHIgPSBlbnYuc3RhY2sucG9wKCkpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmICghci5hc3luYyAmJiBzID09PSAxKSByZXR1cm4gcyA9IDAsIGVudi5zdGFjay5wdXNoKHIpLCBQcm9taXNlLnJlc29sdmUoKS50aGVuKG5leHQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHIuZGlzcG9zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSByLmRpc3Bvc2UuY2FsbChyLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoci5hc3luYykgcmV0dXJuIHMgfD0gMiwgUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCkudGhlbihuZXh0LCBmdW5jdGlvbihlKSB7IGZhaWwoZSk7IHJldHVybiBuZXh0KCk7IH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBzIHw9IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIGZhaWwoZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHMgPT09IDEpIHJldHVybiBlbnYuaGFzRXJyb3IgPyBQcm9taXNlLnJlamVjdChlbnYuZXJyb3IpIDogUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgaWYgKGVudi5oYXNFcnJvcikgdGhyb3cgZW52LmVycm9yO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5leHQoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uKHBhdGgsIHByZXNlcnZlSnN4KSB7XHJcbiAgICBpZiAodHlwZW9mIHBhdGggPT09IFwic3RyaW5nXCIgJiYgL15cXC5cXC4/XFwvLy50ZXN0KHBhdGgpKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhdGgucmVwbGFjZSgvXFwuKHRzeCkkfCgoPzpcXC5kKT8pKCg/OlxcLlteLi9dKz8pPylcXC4oW2NtXT8pdHMkL2ksIGZ1bmN0aW9uIChtLCB0c3gsIGQsIGV4dCwgY20pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRzeCA/IHByZXNlcnZlSnN4ID8gXCIuanN4XCIgOiBcIi5qc1wiIDogZCAmJiAoIWV4dCB8fCAhY20pID8gbSA6IChkICsgZXh0ICsgXCIuXCIgKyBjbS50b0xvd2VyQ2FzZSgpICsgXCJqc1wiKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiBwYXRoO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBfX2V4dGVuZHM6IF9fZXh0ZW5kcyxcclxuICAgIF9fYXNzaWduOiBfX2Fzc2lnbixcclxuICAgIF9fcmVzdDogX19yZXN0LFxyXG4gICAgX19kZWNvcmF0ZTogX19kZWNvcmF0ZSxcclxuICAgIF9fcGFyYW06IF9fcGFyYW0sXHJcbiAgICBfX2VzRGVjb3JhdGU6IF9fZXNEZWNvcmF0ZSxcclxuICAgIF9fcnVuSW5pdGlhbGl6ZXJzOiBfX3J1bkluaXRpYWxpemVycyxcclxuICAgIF9fcHJvcEtleTogX19wcm9wS2V5LFxyXG4gICAgX19zZXRGdW5jdGlvbk5hbWU6IF9fc2V0RnVuY3Rpb25OYW1lLFxyXG4gICAgX19tZXRhZGF0YTogX19tZXRhZGF0YSxcclxuICAgIF9fYXdhaXRlcjogX19hd2FpdGVyLFxyXG4gICAgX19nZW5lcmF0b3I6IF9fZ2VuZXJhdG9yLFxyXG4gICAgX19jcmVhdGVCaW5kaW5nOiBfX2NyZWF0ZUJpbmRpbmcsXHJcbiAgICBfX2V4cG9ydFN0YXI6IF9fZXhwb3J0U3RhcixcclxuICAgIF9fdmFsdWVzOiBfX3ZhbHVlcyxcclxuICAgIF9fcmVhZDogX19yZWFkLFxyXG4gICAgX19zcHJlYWQ6IF9fc3ByZWFkLFxyXG4gICAgX19zcHJlYWRBcnJheXM6IF9fc3ByZWFkQXJyYXlzLFxyXG4gICAgX19zcHJlYWRBcnJheTogX19zcHJlYWRBcnJheSxcclxuICAgIF9fYXdhaXQ6IF9fYXdhaXQsXHJcbiAgICBfX2FzeW5jR2VuZXJhdG9yOiBfX2FzeW5jR2VuZXJhdG9yLFxyXG4gICAgX19hc3luY0RlbGVnYXRvcjogX19hc3luY0RlbGVnYXRvcixcclxuICAgIF9fYXN5bmNWYWx1ZXM6IF9fYXN5bmNWYWx1ZXMsXHJcbiAgICBfX21ha2VUZW1wbGF0ZU9iamVjdDogX19tYWtlVGVtcGxhdGVPYmplY3QsXHJcbiAgICBfX2ltcG9ydFN0YXI6IF9faW1wb3J0U3RhcixcclxuICAgIF9faW1wb3J0RGVmYXVsdDogX19pbXBvcnREZWZhdWx0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldDogX19jbGFzc1ByaXZhdGVGaWVsZEdldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRTZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkSW46IF9fY2xhc3NQcml2YXRlRmllbGRJbixcclxuICAgIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlOiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZSxcclxuICAgIF9fZGlzcG9zZVJlc291cmNlczogX19kaXNwb3NlUmVzb3VyY2VzLFxyXG4gICAgX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb246IF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uLFxyXG59O1xyXG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIFNldHRpbmdEZWZpbml0aW9uSXRlbSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBGb290bm90ZVBsdWdpblNldHRpbmdzIHtcclxuICAgIGluc2VydEF0RW5kT2ZXb3JkOiBib29sZWFuO1xyXG4gICAgZW5hYmxlUG9wdXBFZGl0b3I6IGJvb2xlYW47XHJcblxyXG4gICAgZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogYm9vbGVhbjtcclxuICAgIEZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IHN0cmluZztcclxuXHJcbiAgICBlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lczogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEZvb3Rub3RlUGx1Z2luU2V0dGluZ3MgPSB7XHJcbiAgICBpbnNlcnRBdEVuZE9mV29yZDogdHJ1ZSxcclxuICAgIGVuYWJsZVBvcHVwRWRpdG9yOiB0cnVlLFxyXG5cclxuICAgIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IGZhbHNlLFxyXG4gICAgRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogXCIjIEZvb3Rub3Rlc1wiLFxyXG5cclxuICAgIGVuYWJsZVJlbW92ZUJsYW5rTGFzdExpbmVzOiB0cnVlLFxyXG59O1xyXG5cclxuZXhwb3J0IGNsYXNzIEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xyXG4gICAgICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBPYnNpZGlhbiAxLjEzLjArIHJlbmRlcnMgdGhlIHRhYiBmcm9tIHRoZXNlIGRlZmluaXRpb25zIGFuZCBza2lwc1xyXG4gICAgLy8gZGlzcGxheSgpOyBjb250cm9scyBiaW5kIHRvIHRoaXMucGx1Z2luLnNldHRpbmdzW2tleV0gYW5kIGF1dG8tc2F2ZVxyXG4gICAgZ2V0U2V0dGluZ0RlZmluaXRpb25zKCk6IFNldHRpbmdEZWZpbml0aW9uSXRlbVtdIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiLFxyXG4gICAgICAgICAgICAgICAgZGVzYzogXCJBIG5ldyBmb290bm90ZSBpcyBvbmx5IGluc2VydGVkIGF0IHRoZSBlbmQgb2YgdGhlIHdvcmQgYW5kIGFmdGVyIGFueSBwdW5jdHVhdGlvbi5cIixcclxuICAgICAgICAgICAgICAgIGNvbnRyb2w6IHsgdHlwZTogXCJ0b2dnbGVcIiwga2V5OiBcImluc2VydEF0RW5kT2ZXb3JkXCIgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJFZGl0IGZvb3Rub3RlcyBpbiBhIHBvcHVwXCIsXHJcbiAgICAgICAgICAgICAgICBkZXNjOiBcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCBFc2NhcGUsIG9yIGJ5IGNsaWNraW5nIG91dHNpZGUuXCIsXHJcbiAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVQb3B1cEVkaXRvclwiIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiZ3JvdXBcIixcclxuICAgICAgICAgICAgICAgIGhlYWRpbmc6IFwiRm9vdG5vdGVzIFNlY3Rpb25cIixcclxuICAgICAgICAgICAgICAgIGl0ZW1zOiBbXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIlRyaW0gYmxhbmsgbGluZXNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzYzogXCJSZW1vdmUgYmxhbmsgbGluZXMgZnJvbSB0aGUgZW5kIG9mIHRoZSBub3RlIHdoZW4gaW5zZXJ0aW5nIGEgbmV3IGZvb3Rub3RlcyBzZWN0aW9uLlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lc1wiIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiRW5hYmxlIHNlY3Rpb24gaGVhZGluZ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjOiBcIkF1dG9tYXRpY2FsbHkgYWRkcyBhIGhlYWRpbmcgc2VwYXJhdGluZyBmb290bm90ZXMgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbm90ZSBmcm9tIHRoZSByZXN0IG9mIHRoZSB0ZXh0LlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nXCIgfSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJTZWN0aW9uIGhlYWRpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzYzogXCJIZWFkaW5nIHRvIHBsYWNlIGFib3ZlIHRoZSBmb290bm90ZXMgc2VjdGlvbi4gQWNjZXB0cyBzdGFuZGFyZCBtYXJrZG93biwgaW5jbHVkaW5nIG11bHRpcGxlIGxpbmVzIGFuZCBkaXZpZGVycy5cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udHJvbDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ0ZXh0YXJlYVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBcIkZvb3Rub3RlU2VjdGlvbkhlYWRpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3M6IDYsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcjogXCJFeDogJyMgRm9vdG5vdGVzJ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ6ICgpID0+ICF0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIF07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gT2JzaWRpYW4gPCAxLjEzLjAgZmFsbHMgYmFjayB0byB0aGlzIGltcGVyYXRpdmUgaW1wbGVtZW50YXRpb247XHJcbiAgICAvLyBrZWVwIGl0IGluIHN5bmMgd2l0aCBnZXRTZXR0aW5nRGVmaW5pdGlvbnMoKSBhYm92ZVxyXG4gICAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcclxuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiQSBuZXcgZm9vdG5vdGUgaXMgb25seSBpbnNlcnRlZCBhdCB0aGUgZW5kIG9mIHRoZSB3b3JkIGFuZCBhZnRlciBhbnkgcHVuY3R1YXRpb24uXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZClcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZCA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkVkaXQgZm9vdG5vdGVzIGluIGEgcG9wdXBcIilcclxuICAgICAgICAuc2V0RGVzYyhcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCBFc2NhcGUsIG9yIGJ5IGNsaWNraW5nIG91dHNpZGUuXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVQb3B1cEVkaXRvcilcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVQb3B1cEVkaXRvciA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkZvb3Rub3RlcyBTZWN0aW9uXCIpXHJcbiAgICAgICAgLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJUcmltIGJsYW5rIGxpbmVzXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJSZW1vdmUgYmxhbmsgbGluZXMgZnJvbSB0aGUgZW5kIG9mIHRoZSBub3RlIHdoZW4gaW5zZXJ0aW5nIGEgbmV3IGZvb3Rub3RlIHNlY3Rpb24uXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkVuYWJsZSBzZWN0aW9uIGhlYWRpbmdcIilcclxuICAgICAgICAuc2V0RGVzYyhcIkF1dG9tYXRpY2FsbHkgYWRkcyBhIGhlYWRpbmcgc2VwYXJhdGluZyBmb290bm90ZXMgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbm90ZSBmcm9tIHRoZSByZXN0IG9mIHRoZSB0ZXh0LlwiKVxyXG4gICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICAgICAgdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKFwiU2VjdGlvbiBoZWFkaW5nXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJIZWFkaW5nIHRvIHBsYWNlIGFib3ZlIHRoZSBmb290bm90ZXMgc2VjdGlvbi4gQWNjZXB0cyBzdGFuZGFyZCBtYXJrZG93biwgaW5jbHVkaW5nIG11bHRpcGxlIGxpbmVzIGFuZCBkaXZpZGVycy5cIilcclxuICAgICAgICAuYWRkVGV4dEFyZWEoKHRleHQpID0+XHJcbiAgICAgICAgICAgIHRleHRcclxuICAgICAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIkV4OiAnIyBGb290bm90ZXMnXCIpXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oKHRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUud2lkdGggPSAnMTAwJSc7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnJvd3MgPSA2O1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHQuaW5wdXRFbC5zdHlsZS5yZXNpemUgPSAnbm9uZSc7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgeyBNYXJrZG93blZpZXcgfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmltcG9ydCBGb290bm90ZVBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcblxyXG4vLyBBIHNtYWxsIHBvcHVwIGFuY2hvcmVkIGF0IHRoZSBjdXJzb3IgY29udGFpbmluZyBPYnNpZGlhbidzIG93biBlZGl0YWJsZVxyXG4vLyBtYXJrZG93biBlbWJlZCwgYm91bmQgdG8ganVzdCB0aGUgZm9vdG5vdGUncyBkZXRhaWwgdmlhIHRoZSBgI1teaWRdYFxyXG4vLyBzdWJwYXRoICh0aGUgc2FtZSBtYWNoaW5lcnkgdGhlIGNvcmUgRm9vdG5vdGVzIHZpZXcgdXNlcykuIEVkaXRpbmcgaW4gdGhlXHJcbi8vIHBvcHVwIHNhdmVzIHN0cmFpZ2h0IGJhY2sgdG8gdGhlIGRldGFpbCBsaW5lIGF0IHRoZSBib3R0b20gb2YgdGhlIG5vdGUsXHJcbi8vIHNvIHRoZSB1c2VyJ3MgY3Vyc29yIG5ldmVyIGhhcyB0byBsZWF2ZSB0aGUgdGV4dC5cclxuXHJcbnR5cGUgQWN0aXZlUG9wdXAgPSB7XHJcbiAgICBjb250YWluZXJFbDogSFRNTEVsZW1lbnQ7XHJcbiAgICBjbG9zZTogKGZvY3VzRWRpdG9yOiBib29sZWFuKSA9PiB2b2lkO1xyXG59O1xyXG5cclxubGV0IGFjdGl2ZVBvcHVwOiBBY3RpdmVQb3B1cCB8IG51bGwgPSBudWxsO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKTogYm9vbGVhbiB7XHJcbiAgICAvLyBlbWJlZFJlZ2lzdHJ5IGlzIHVuZG9jdW1lbnRlZCBBUEksIHNvIGRlZ3JhZGUgdG8gdGhlIGxlZ2FjeVxyXG4gICAgLy8ganVtcC10by1ib3R0b20gYmVoYXZpb3IgaWYgaXQgZXZlciBjaGFuZ2VzIHNoYXBlXHJcbiAgICBjb25zdCByZWdpc3RyeSA9IChwbHVnaW4uYXBwIGFzIGFueSkuZW1iZWRSZWdpc3RyeTtcclxuICAgIHJldHVybiBwbHVnaW4uc2V0dGluZ3MuZW5hYmxlUG9wdXBFZGl0b3IgPT09IHRydWVcclxuICAgICAgICAmJiB0eXBlb2YgcmVnaXN0cnk/LmVtYmVkQnlFeHRlbnNpb24/Lm1kID09PSBcImZ1bmN0aW9uXCI7XHJcbn1cclxuXHJcbi8vIENsb3NlIGZyb20gdGhlIGZvb3Rub3RlIGhvdGtleTsgcmV0dXJucyB3aGV0aGVyIGEgcG9wdXAgd2FzIG9wZW4sIHNvIHRoZVxyXG4vLyBob3RrZXkgY2FuIHRvZ2dsZSB0aGUgcG9wdXAgaW5zdGVhZCBvZiBpbnNlcnRpbmcgYW5vdGhlciBmb290bm90ZS5cclxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUNsb3NlRm9vdG5vdGVQb3B1cCgpOiBib29sZWFuIHtcclxuICAgIGlmIChhY3RpdmVQb3B1cCkge1xyXG4gICAgICAgIGFjdGl2ZVBvcHVwLmNsb3NlKHRydWUpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG4vLyBDbG9zZSB3aXRob3V0IHN0ZWFsaW5nIGZvY3VzIChsZWFmIHN3aXRjaGVkLCBwbHVnaW4gdW5sb2FkaW5nKS5cclxuZXhwb3J0IGZ1bmN0aW9uIGRpc21pc3NGb290bm90ZVBvcHVwKCkge1xyXG4gICAgaWYgKGFjdGl2ZVBvcHVwKSB7XHJcbiAgICAgICAgYWN0aXZlUG9wdXAuY2xvc2UoZmFsc2UpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlbkZvb3Rub3RlUG9wdXAoXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4gICAgZm9vdG5vdGVJZDogc3RyaW5nLFxyXG4gICAgb25VbmF2YWlsYWJsZT86ICgpID0+IHZvaWQsXHJcbikge1xyXG4gICAgZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKTtcclxuXHJcbiAgICBjb25zdCBtZFZpZXcgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICBpZiAoIW1kVmlldyB8fCAhbWRWaWV3LmZpbGUpIHJldHVybjtcclxuXHJcbiAgICAvLyBhIGp1c3QtaW5zZXJ0ZWQgZGV0YWlsIGlzIG9ubHkgaW5kZXhlZCBvbmNlIHRoZSBmaWxlIHNhdmVzIOKAlCBidXRcclxuICAgIC8vIG1kVmlldy5kYXRhIGxhZ3MgYSB0aWNrIGJlaGluZCBlZGl0b3IgQVBJIGNoYW5nZXMsIHNvIHNhdmluZyB0b28gZWFybHlcclxuICAgIC8vIHdvdWxkIHdyaXRlIHByZS1pbnNlcnRpb24gY29udGVudCB0byBkaXNrOyB3YWl0IGZvciB0aGUgYnVmZmVyIHRvXHJcbiAgICAvLyBjYXRjaCB1cCBmaXJzdC4gRmluaXNoaW5nIHRoZSBzYXZlIChhbmQgaXRzIGZvbGQtc3RhdGUgZXZlbnQpIGJlZm9yZVxyXG4gICAgLy8gdGhlIGVtYmVkIGV4aXN0cyBhbHNvIGtlZXBzIGl0IGZyb20gcmVhY2hpbmcgYSBoYWxmLWluaXRpYWxpemVkIGVtYmVkLlxyXG4gICAgY29uc3QgZGV0YWlsVG9rZW4gPSBgW14ke2Zvb3Rub3RlSWR9XTpgO1xyXG4gICAgY29uc3QgZGF0YURlYWRsaW5lID0gRGF0ZS5ub3coKSArIDIwMDA7XHJcbiAgICB3aGlsZSAoIW1kVmlldy5kYXRhLmluY2x1ZGVzKGRldGFpbFRva2VuKSAmJiBEYXRlLm5vdygpIDwgZGF0YURlYWRsaW5lKSB7XHJcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNTApKTtcclxuICAgIH1cclxuICAgIGF3YWl0IG1kVmlldy5zYXZlKCk7XHJcbiAgICBjb25zdCBlZGl0b3IgPSBtZFZpZXcuZWRpdG9yO1xyXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmNvbnRhaW5lckVsLm93bmVyRG9jdW1lbnQ7XHJcbiAgICBjb25zdCB3aW4gPSBkb2MuZGVmYXVsdFZpZXcgfHwgd2luZG93O1xyXG5cclxuICAgIC8vIGFuY2hvciBqdXN0IGJlbG93IHRoZSBjdXJzb3IsIGZsaXBwaW5nIGFib3ZlIGl0IG5lYXIgdGhlIHdpbmRvdyBib3R0b21cclxuICAgIGNvbnN0IGNtID0gKGVkaXRvciBhcyBhbnkpLmNtO1xyXG4gICAgY29uc3QgY29vcmRzID0gY20gPyBjbS5jb29yZHNBdFBvcyhjbS5zdGF0ZS5zZWxlY3Rpb24ubWFpbi5oZWFkKSA6IG51bGw7XHJcbiAgICBjb25zdCB3aWR0aCA9IE1hdGgubWluKDQ4MCwgd2luLmlubmVyV2lkdGggLSAzMik7XHJcbiAgICBjb25zdCBsZWZ0ID0gTWF0aC5tYXgoMTYsIE1hdGgubWluKGNvb3JkcyA/IGNvb3Jkcy5sZWZ0IDogMTAwLCB3aW4uaW5uZXJXaWR0aCAtIHdpZHRoIC0gMTYpKTtcclxuICAgIGxldCB0b3AgPSAoY29vcmRzID8gY29vcmRzLmJvdHRvbSA6IDEwMCkgKyA2O1xyXG4gICAgaWYgKHRvcCArIDI2MCA+IHdpbi5pbm5lckhlaWdodCkge1xyXG4gICAgICAgIHRvcCA9IE1hdGgubWF4KDE2LCAoY29vcmRzID8gY29vcmRzLnRvcCA6IDMwMCkgLSAyNjYpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnRhaW5lckVsID0gZG9jLmJvZHkuY3JlYXRlRGl2KFwiZm9vdG5vdGUtc2hvcnRjdXQtcG9wdXBcIik7XHJcbiAgICBjb250YWluZXJFbC5zdHlsZS5sZWZ0ID0gYCR7bGVmdH1weGA7XHJcbiAgICBjb250YWluZXJFbC5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xyXG4gICAgY29udGFpbmVyRWwuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XHJcbiAgICAvLyBzdGF5IGludmlzaWJsZSB1bnRpbCB0aGUgZm9vdG5vdGUgZGV0YWlsIGlzIGFjdHVhbGx5IGxvYWRlZFxyXG4gICAgY29udGFpbmVyRWwuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XHJcblxyXG4gICAgY29uc3Qgc3VicGF0aCA9IGAjW14ke2Zvb3Rub3RlSWR9XWA7XHJcbiAgICBjb25zdCBidWlsZEVtYmVkID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGJ1aWx0ID0gKHBsdWdpbi5hcHAgYXMgYW55KS5lbWJlZFJlZ2lzdHJ5LmVtYmVkQnlFeHRlbnNpb24ubWQoXHJcbiAgICAgICAgICAgIHsgYXBwOiBwbHVnaW4uYXBwLCBsaW5rdGV4dDogc3VicGF0aCwgc291cmNlUGF0aDogbWRWaWV3LmZpbGUucGF0aCwgY29udGFpbmVyRWw6IGNvbnRhaW5lckVsLCBkZXB0aDogMCB9LFxyXG4gICAgICAgICAgICBtZFZpZXcuZmlsZSxcclxuICAgICAgICAgICAgc3VicGF0aCxcclxuICAgICAgICApO1xyXG4gICAgICAgIGJ1aWx0LmVkaXRhYmxlID0gdHJ1ZTtcclxuICAgICAgICBidWlsdC5sb2FkKCk7XHJcbiAgICAgICAgcmV0dXJuIGJ1aWx0O1xyXG4gICAgfTtcclxuICAgIGxldCBlbWJlZCA9IGJ1aWxkRW1iZWQoKTtcclxuXHJcbiAgICBsZXQgY2xvc2VkID0gZmFsc2U7XHJcbiAgICBjb25zdCBjbG9zZSA9IChmb2N1c0VkaXRvcjogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgIGlmIChjbG9zZWQpIHJldHVybjtcclxuICAgICAgICBjbG9zZWQgPSB0cnVlO1xyXG4gICAgICAgIGFjdGl2ZVBvcHVwID0gbnVsbDtcclxuICAgICAgICBkb2MucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBvbkRvY01vdXNlRG93biwgdHJ1ZSk7XHJcbiAgICAgICAgY29udGFpbmVyRWwuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gICAgICAgIGlmIChmb2N1c0VkaXRvcikgZWRpdG9yLmZvY3VzKCk7XHJcblxyXG4gICAgICAgIC8vIHRoZSBlbWJlZCBzYXZlcyBlZGl0cyBvbiBpdHMgb3duIGRlYm91bmNlOyBsZXQgdGhhdCBjeWNsZSBmaW5pc2hcclxuICAgICAgICAvLyBiZWZvcmUgdW5sb2FkaW5nLCBzaW5jZSB1bmxvYWRpbmcgbWlkLXNhdmUgY2xlYXJzIHRoZSBzdGF0ZSB0aGVcclxuICAgICAgICAvLyBzYXZlIHJlYWRzXHJcbiAgICAgICAgbGV0IGF0dGVtcHRzID0gMDtcclxuICAgICAgICBjb25zdCB0ZWFyZG93biA9ICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKChlbWJlZC5kaXJ0eSB8fCBlbWJlZC5zYXZpbmcgfHwgZW1iZWQuc2F2ZUFnYWluKSAmJiBhdHRlbXB0cysrIDwgNTApIHtcclxuICAgICAgICAgICAgICAgIHdpbi5zZXRUaW1lb3V0KHRlYXJkb3duLCAxMDApO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVtYmVkLnVubG9hZCgpO1xyXG4gICAgICAgICAgICBjb250YWluZXJFbC5yZW1vdmUoKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRlYXJkb3duKCk7XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IG9uRG9jTW91c2VEb3duID0gKGV2dDogTW91c2VFdmVudCkgPT4ge1xyXG4gICAgICAgIGlmICghY29udGFpbmVyRWwuY29udGFpbnMoZXZ0LnRhcmdldCBhcyBOb2RlKSkgY2xvc2UoZmFsc2UpO1xyXG4gICAgfTtcclxuICAgIGRvYy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIG9uRG9jTW91c2VEb3duLCB0cnVlKTtcclxuXHJcbiAgICAvLyBidWJibGUgcGhhc2UsIHNvIHRoZSBlbWJlZGRlZCBlZGl0b3IgKGUuZy4gdmltIG1vZGUgbGVhdmluZyBpbnNlcnRcclxuICAgIC8vIG1vZGUpIGdldHMgZmlyc3QgY2xhaW0gb24gRXNjYXBlXHJcbiAgICBjb250YWluZXJFbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZ0OiBLZXlib2FyZEV2ZW50KSA9PiB7XHJcbiAgICAgICAgaWYgKGV2dC5rZXkgPT09IFwiRXNjYXBlXCIpIHtcclxuICAgICAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIGNsb3NlKHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGFjdGl2ZVBvcHVwID0geyBjb250YWluZXJFbCwgY2xvc2UgfTtcclxuXHJcbiAgICBjb25zdCB0cnlTaG93ID0gYXN5bmMgKCk6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xyXG4gICAgICAgIGF3YWl0IGVtYmVkLmxvYWRGaWxlKCk7XHJcbiAgICAgICAgaWYgKGVtYmVkLnN1YnBhdGhOb3RGb3VuZCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnRhaW5lckVsLnN0eWxlLnZpc2liaWxpdHkgPSBcIlwiO1xyXG4gICAgICAgIGVtYmVkLnNob3dFZGl0b3IoKTtcclxuICAgICAgICBlbWJlZC5lZGl0TW9kZT8uZWRpdG9yPy5mb2N1cygpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCB3YWl0Rm9yQ2FjaGVDaGFuZ2UgPSAoKSA9PlxyXG4gICAgICAgIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSB3aW4uc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBwbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUub2ZmcmVmKHJlZik7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0sIDUwMCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlZiA9IHBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5vbihcImNoYW5nZWRcIiwgKGZpbGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChmaWxlID09PSBtZFZpZXcuZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbi5jbGVhclRpbWVvdXQodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLm9mZnJlZihyZWYpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc2hvd0VkaXRvciA9IGFzeW5jICgpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcclxuICAgICAgICBpZiAoYXdhaXQgdHJ5U2hvdygpKSByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICAgICAgLy8gcmV0cnkgYXMgdGhlIG1ldGFkYXRhIGNhY2hlIGNhdGNoZXMgdXAgd2l0aCB0aGUgc2F2ZWQgZmlsZTsgYVxyXG4gICAgICAgIC8vIGxvYWRlZCBlbWJlZCB3b24ndCByZS1yZXNvbHZlIGl0cyBzdWJwYXRoLCBzbyByZWJ1aWxkIGVhY2ggdGltZVxyXG4gICAgICAgIGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIDMwMDA7XHJcbiAgICAgICAgd2hpbGUgKERhdGUubm93KCkgPCBkZWFkbGluZSkge1xyXG4gICAgICAgICAgICBhd2FpdCB3YWl0Rm9yQ2FjaGVDaGFuZ2UoKTtcclxuICAgICAgICAgICAgaWYgKGNsb3NlZCkgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIGVtYmVkLnVubG9hZCgpO1xyXG4gICAgICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG4gICAgICAgICAgICBlbWJlZCA9IGJ1aWxkRW1iZWQoKTtcclxuICAgICAgICAgICAgaWYgKGF3YWl0IHRyeVNob3coKSkgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcblxyXG4gICAgc2hvd0VkaXRvcigpXHJcbiAgICAgICAgLnRoZW4oKHNob3duKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghc2hvd24gJiYgIWNsb3NlZCkge1xyXG4gICAgICAgICAgICAgICAgY2xvc2UoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgb25VbmF2YWlsYWJsZT8uKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KVxyXG4gICAgICAgIC5jYXRjaCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghY2xvc2VkKSB7XHJcbiAgICAgICAgICAgICAgICBjbG9zZShmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICBvblVuYXZhaWxhYmxlPy4oKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG59XHJcbiIsImltcG9ydCB7XHJcblx0RWRpdG9yLFxyXG5cdEVkaXRvclBvc2l0aW9uLFxyXG5cdE1hcmtkb3duVmlld1xyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuaW1wb3J0IEZvb3Rub3RlUGx1Z2luIGZyb20gXCIuL21haW5cIjtcclxuaW1wb3J0IHsgb3BlbkZvb3Rub3RlUG9wdXAsIHBvcHVwRWRpdGluZ0F2YWlsYWJsZSwgdG9nZ2xlQ2xvc2VGb290bm90ZVBvcHVwIH0gZnJvbSBcIi4vZm9vdG5vdGUtcG9wdXBcIjtcclxuXHJcbmV4cG9ydCB2YXIgQWxsTWFya2VycyA9IC9cXFtcXF4oW15cXFtcXF1dKylcXF0oPyE6KS9nO1xyXG52YXIgQWxsTnVtYmVyZWRNYXJrZXJzID0gL1xcW1xcXihcXGQrKVxcXS9naTtcclxudmFyIEFsbERldGFpbHNOYW1lT25seSA9IC9cXFtcXF4oW15cXFtcXF1dKylcXF06L2c7XHJcbnZhciBEZXRhaWxJbkxpbmUgPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdOi87XHJcbmV4cG9ydCB2YXIgRXh0cmFjdE5hbWVGcm9tRm9vdG5vdGUgPSAvKFxcW1xcXikoW15cXFtcXF1dKykoPz1cXF0pLztcclxuXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKFxyXG4gICAgZG9jOiBFZGl0b3JcclxuKSB7XHJcbiAgICBsZXQgRm9vdG5vdGVEZXRhaWxMaXN0OiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgXHJcbiAgICAvL3NlYXJjaCBlYWNoIGxpbmUgZm9yIGZvb3Rub3RlIGRldGFpbHMgYW5kIGFkZCB0byBsaXN0XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XHJcbiAgICAgICAgbGV0IHRoZUxpbmUgPSBkb2MuZ2V0TGluZShpKTtcclxuICAgICAgICBsZXQgbGluZU1hdGNoID0gdGhlTGluZS5tYXRjaChBbGxEZXRhaWxzTmFtZU9ubHkpO1xyXG4gICAgICAgIGlmIChsaW5lTWF0Y2gpIHtcclxuICAgICAgICAgICAgbGV0IHRlbXAgPSBsaW5lTWF0Y2hbMF07XHJcbiAgICAgICAgICAgIHRlbXAgPSB0ZW1wLnJlcGxhY2UoXCJbXlwiLFwiXCIpO1xyXG4gICAgICAgICAgICB0ZW1wID0gdGVtcC5yZXBsYWNlKFwiXTpcIixcIlwiKTtcclxuXHJcbiAgICAgICAgICAgIEZvb3Rub3RlRGV0YWlsTGlzdC5wdXNoKHRlbXApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBGb290bm90ZURldGFpbExpc3Q7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsaXN0RXhpc3RpbmdGb290bm90ZU1hcmtlcnNBbmRMb2NhdGlvbnMoXHJcbiAgICBkb2M6IEVkaXRvclxyXG4pIHtcclxuICAgIHR5cGUgbWFya2VyRW50cnkgPSB7XHJcbiAgICAgICAgZm9vdG5vdGU6IHN0cmluZztcclxuICAgICAgICBsaW5lTnVtOiBudW1iZXI7XHJcbiAgICAgICAgc3RhcnRJbmRleDogbnVtYmVyO1xyXG4gICAgfVxyXG4gICAgbGV0IG1hcmtlckVudHJ5O1xyXG5cclxuICAgIGxldCBGb290bm90ZU1hcmtlckluZm8gPSBbXTtcclxuICAgIC8vc2VhcmNoIGVhY2ggbGluZSBmb3IgZm9vdG5vdGUgbWFya2Vyc1xyXG4gICAgLy9mb3IgZWFjaCwgYWRkIHRoZWlyIG5hbWUsIGxpbmUgbnVtYmVyLCBhbmQgc3RhcnQgaW5kZXggdG8gRm9vdG5vdGVNYXJrZXJJbmZvXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XHJcbiAgICAgICAgbGV0IHRoZUxpbmUgPSBkb2MuZ2V0TGluZShpKTtcclxuICAgICAgICBsZXQgbGluZU1hdGNoO1xyXG5cclxuICAgICAgICB3aGlsZSAoKGxpbmVNYXRjaCA9IEFsbE1hcmtlcnMuZXhlYyh0aGVMaW5lKSkgIT0gbnVsbCkge1xyXG4gICAgICAgIG1hcmtlckVudHJ5ID0ge1xyXG4gICAgICAgICAgICBmb290bm90ZTogbGluZU1hdGNoWzBdLFxyXG4gICAgICAgICAgICBsaW5lTnVtOiBpLFxyXG4gICAgICAgICAgICBzdGFydEluZGV4OiBsaW5lTWF0Y2guaW5kZXhcclxuICAgICAgICB9XHJcbiAgICAgICAgRm9vdG5vdGVNYXJrZXJJbmZvLnB1c2gobWFya2VyRW50cnkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBGb290bm90ZU1hcmtlckluZm87XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoXHJcbiAgICBkb2M6IEVkaXRvcixcclxuICAgIG9sZEN1cnNvclBvczogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBuZXdDdXJzb3JQb3M6IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcclxuKTogdm9pZCB7XHJcbiAgICBkb2Muc2V0Q3Vyc29yKG5ld0N1cnNvclBvcyk7XHJcblxyXG4gICAgLy8gaWYgdXNlciBoYXMgdmltIG1vZGUgZW5hYmxlZCwgc2V0IGp1bXAgcG9pbnRcclxuICAgIC8vIGdldENvbmZpZyBpcyBwcml2YXRlIEFQSSwgbGlrZSB0aGUgdmltIGludGVybmFscyBiZWxvd1xyXG4gICAgaWYgKChwbHVnaW4uYXBwLnZhdWx0IGFzIGFueSkuZ2V0Q29uZmlnKFwidmltTW9kZVwiKSkge1xyXG4gICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcclxuICAgICAgICBhY3RpdmVXaW5kb3cuQ29kZU1pcnJvckFkYXB0ZXIuVmltLmdldFZpbUdsb2JhbFN0YXRlXygpLmp1bXBMaXN0LmFkZChcclxuICAgICAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxyXG4gICAgICAgICAgICBkb2MuY20uY20sIC8vIFNJQyB0d28gbGV2ZWxzIGRlZXBcclxuICAgICAgICAgICAgb2xkQ3Vyc29yUG9zLFxyXG4gICAgICAgICAgICBuZXdDdXJzb3JQb3MsXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXHJcbikge1xyXG4gICAgLy8gY2hlY2sgaWYgd2UncmUgaW4gYSBmb290bm90ZSBkZXRhaWwgbGluZSAoXCJbXjFdOiBmb290bm90ZVwiKVxyXG4gICAgLy8gaWYgc28sIGp1bXAgY3Vyc29yIGJhY2sgdG8gdGhlIGZvb3Rub3RlIGluIHRoZSB0ZXh0XHJcblxyXG4gICAgbGV0IG1hdGNoID0gbGluZVRleHQubWF0Y2goRGV0YWlsSW5MaW5lKTtcclxuICAgIGlmIChtYXRjaCkge1xyXG4gICAgICAgIGxldCBzID0gbWF0Y2hbMF07XHJcbiAgICAgICAgbGV0IGluZGV4ID0gcy5yZXBsYWNlKFwiW15cIiwgXCJcIik7XHJcbiAgICAgICAgaW5kZXggPSBpbmRleC5yZXBsYWNlKFwiXTpcIiwgXCJcIik7XHJcbiAgICAgICAgbGV0IGZvb3Rub3RlID0gcy5yZXBsYWNlKFwiOlwiLCBcIlwiKTtcclxuXHJcbiAgICAgICAgbGV0IHJldHVybkxpbmVJbmRleCA9IGN1cnNvclBvc2l0aW9uLmxpbmU7XHJcbiAgICAgICAgLy8gZmluZCB0aGUgRklSU1QgT0NDVVJFTkNFIHdoZXJlIHRoaXMgZm9vdG5vdGUgZXhpc3RzIGluIHRoZSB0ZXh0XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgc2NhbkxpbmUgPSBkb2MuZ2V0TGluZShpKTtcclxuICAgICAgICAgICAgaWYgKHNjYW5MaW5lLmNvbnRhaW5zKGZvb3Rub3RlKSkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGN1cnNvckxvY2F0aW9uSW5kZXggPSBzY2FuTGluZS5pbmRleE9mKGZvb3Rub3RlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybkxpbmVJbmRleCA9IGk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IHJldHVybkxpbmVJbmRleCwgY2g6IGN1cnNvckxvY2F0aW9uSW5kZXggKyBmb290bm90ZS5sZW5ndGggfTtcclxuICAgICAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zLCBwbHVnaW4pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBqdW1wVG9Gb290bm90ZURldGFpbChcclxuICAgIGZvb3Rub3RlTmFtZTogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXHJcbikge1xyXG4gICAgLy8gZmluZCB0aGUgZmlyc3QgbGluZSB3aXRoIHRoaXMgZGV0YWlsIG1hcmtlciBuYW1lIGluIGl0LlxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xyXG4gICAgICAgIGxldCB0aGVMaW5lID0gZG9jLmdldExpbmUoaSk7XHJcbiAgICAgICAgbGV0IGxpbmVNYXRjaCA9IHRoZUxpbmUubWF0Y2goRGV0YWlsSW5MaW5lKTtcclxuICAgICAgICBpZiAobGluZU1hdGNoKSB7XHJcbiAgICAgICAgICAgIC8vIGNvbXBhcmUgdG8gdGhlIGluZGV4XHJcbiAgICAgICAgICAgIGxldCBuYW1lTWF0Y2ggPSBsaW5lTWF0Y2hbMV07XHJcbiAgICAgICAgICAgIGlmIChuYW1lTWF0Y2ggPT0gZm9vdG5vdGVOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGksIGNoOiBsaW5lTWF0Y2hbMF0ubGVuZ3RoICsgMSB9O1xyXG4gICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MsIHBsdWdpbik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZEp1bXBGcm9tTWFya2VyVG9EZXRhaWwoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXHJcbikge1xyXG4gICAgLy8gSnVtcCBjdXJzb3IgVE8gZGV0YWlsIG1hcmtlclxyXG5cclxuICAgIC8vIGRvZXMgdGhpcyBsaW5lIGhhdmUgYSBmb290bm90ZSBtYXJrZXI/XHJcbiAgICAvLyBkb2VzIHRoZSBjdXJzb3Igb3ZlcmxhcCB3aXRoIG9uZSBvZiB0aGVtP1xyXG4gICAgLy8gaWYgc28sIHdoaWNoIG9uZT9cclxuICAgIC8vIGZpbmQgdGhpcyBmb290bm90ZSBtYXJrZXIncyBkZXRhaWwgbGluZVxyXG4gICAgLy8gcGxhY2UgY3Vyc29yIHRoZXJlXHJcbiAgICBsZXQgbWFya2VyVGFyZ2V0ID0gbnVsbDtcclxuXHJcbiAgICBsZXQgRm9vdG5vdGVNYXJrZXJJbmZvID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVNYXJrZXJzQW5kTG9jYXRpb25zKGRvYyk7XHJcbiAgICBsZXQgY3VycmVudExpbmUgPSBjdXJzb3JQb3NpdGlvbi5saW5lO1xyXG4gICAgbGV0IGZvb3Rub3Rlc09uTGluZSA9IEZvb3Rub3RlTWFya2VySW5mby5maWx0ZXIoKG1hcmtlckVudHJ5OiB7IGxpbmVOdW06IG51bWJlcjsgfSkgPT4gbWFya2VyRW50cnkubGluZU51bSA9PT0gY3VycmVudExpbmUpO1xyXG5cclxuICAgIGlmIChmb290bm90ZXNPbkxpbmUgIT0gbnVsbCkge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IGZvb3Rub3Rlc09uTGluZS5sZW5ndGgtMTsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChmb290bm90ZXNPbkxpbmVbaV0uZm9vdG5vdGUgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGxldCBtYXJrZXIgPSBmb290bm90ZXNPbkxpbmVbaV0uZm9vdG5vdGU7XHJcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXhPZk1hcmtlckluTGluZSA9IGZvb3Rub3Rlc09uTGluZVtpXS5zdGFydEluZGV4O1xyXG4gICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPj0gaW5kZXhPZk1hcmtlckluTGluZSAmJlxyXG4gICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPD0gaW5kZXhPZk1hcmtlckluTGluZSArIG1hcmtlci5sZW5ndGhcclxuICAgICAgICAgICAgICAgICkge1xyXG4gICAgICAgICAgICAgICAgbWFya2VyVGFyZ2V0ID0gbWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAobWFya2VyVGFyZ2V0ICE9PSBudWxsKSB7XHJcbiAgICAgICAgLy8gZXh0cmFjdCBuYW1lXHJcbiAgICAgICAgbGV0IG1hdGNoID0gbWFya2VyVGFyZ2V0Lm1hdGNoKEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlKTtcclxuICAgICAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgbGV0IGZvb3Rub3RlTmFtZSA9IG1hdGNoWzJdO1xyXG5cclxuICAgICAgICAgICAgLy8gbWFya2VycyB3aXRob3V0IGEgZGV0YWlsIGxpbmUgZmFsbCB0aHJvdWdoIHRvIHRoZVxyXG4gICAgICAgICAgICAvLyBkZXRhaWwtY3JlYXRpb24gcGF0aHNcclxuICAgICAgICAgICAgbGV0IGRldGFpbHMgPSBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoZG9jKTtcclxuICAgICAgICAgICAgaWYgKCFkZXRhaWxzLmluY2x1ZGVzKGZvb3Rub3RlTmFtZSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW4pKSB7XHJcbiAgICAgICAgICAgICAgICBvcGVuRm9vdG5vdGVQb3B1cChwbHVnaW4sIGZvb3Rub3RlTmFtZSwgKCkgPT5cclxuICAgICAgICAgICAgICAgICAgICBqdW1wVG9Gb290bm90ZURldGFpbChmb290bm90ZU5hbWUsIGN1cnNvclBvc2l0aW9uLCBkb2MsIHBsdWdpbilcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4ganVtcFRvRm9vdG5vdGVEZXRhaWwoZm9vdG5vdGVOYW1lLCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXHJcbik6IHN0cmluZyB7XHJcbiAgICAvL2NoZWNrIGlmICdFbmFibGUgRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nJyBpcyB0cnVlXHJcbiAgICAvL2lmIHNvLCByZXR1cm4gdGhlIFwiRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nXCJcclxuICAgIC8vIGVsc2UsIHJldHVybiBcIlwiXHJcblxyXG4gICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nID09IHRydWUpIHtcclxuICAgICAgICBsZXQgcmV0dXJuSGVhZGluZyA9IHBsdWdpbi5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nO1xyXG4gICAgICAgIC8vIHRoZSBzZXR0aW5nIGhvbGRzIGxpdGVyYWwgbWFya2Rvd24gKGxlZ2FjeSBwbGFpbi10ZXh0IHZhbHVlcyBhcmVcclxuICAgICAgICAvLyBtaWdyYXRlZCBvbiBsb2FkKTsgYSBkaXZpZGVyIGRpcmVjdGx5IGJlbG93IGEgdGV4dCBsaW5lIHdvdWxkIHR1cm5cclxuICAgICAgICAvLyB0aGF0IGxpbmUgaW50byBhIHNldGV4dCBoZWFkaW5nLCBzbyBrZWVwIGEgYmxhbmsgbGluZSBpbiBiZXR3ZWVuXHJcbiAgICAgICAgY29uc3QgZGl2aWRlclJlZ2V4ID0gL14oLS0tfFxcKlxcKlxcKnxfX18pLztcclxuICAgICAgICBpZiAoZGl2aWRlclJlZ2V4LnRlc3QocmV0dXJuSGVhZGluZykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGBcXG5cXG4ke3JldHVybkhlYWRpbmd9YDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGBcXG4ke3JldHVybkhlYWRpbmd9YDtcclxuICAgIH1cclxuICAgIHJldHVybiBcIlwiO1xyXG59XHJcblxyXG4vKiogYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB0byBpbnNlcnQgYSBmb290bm90ZSBvbmx5IGF0IHRoZSBlbmQgb2Ygd29yZCAqL1xyXG5mdW5jdGlvbiBhZGp1c3RGb290bm90ZVBvc2l0aW9uKFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLmluc2VydEF0RW5kT2ZXb3JkKSByZXR1cm4gY3Vyc29yUG9zaXRpb247XHJcbiAgICBjb25zdCBlbmRPZldvcmRVbmRlckN1cnNvciA9IGRvYy53b3JkQXQoY3Vyc29yUG9zaXRpb24pPy50bztcclxuICAgIGlmICghZW5kT2ZXb3JkVW5kZXJDdXJzb3IpIHJldHVybiBjdXJzb3JQb3NpdGlvbjsgLy8gbm8gd29yZCB1bmRlciBjdXJzb3JcclxuXHJcbiAgICAvLyBhZGp1c3QgY3Vyc29yIHBvc2l0aW9uIHRvIGluc2VydCBhIGZvb3Rub3RlIG9ubHkgYXQgdGhlIGVuZCBvZiB3b3JkXHJcbiAgICBjb25zdCBuZXh0Q2hhciA9IGxpbmVUZXh0LmNoYXJBdChlbmRPZldvcmRVbmRlckN1cnNvci5jaCk7XHJcbiAgICBpZiAoW1wiLlwiLCBcIixcIiwgXCI6XCIsIFwiO1wiXS5pbmNsdWRlcyhuZXh0Q2hhcikpIGVuZE9mV29yZFVuZGVyQ3Vyc29yLmNoKys7XHJcbiAgICBjdXJzb3JQb3NpdGlvbiA9IGVuZE9mV29yZFVuZGVyQ3Vyc29yO1xyXG4gICAgcmV0dXJuIGN1cnNvclBvc2l0aW9uO1xyXG59XHJcblxyXG4vL0ZVTkNUSU9OUyBGT1IgQVVUT05VTUJFUkVEIEZPT1ROT1RFU1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGluc2VydEF1dG9udW1Gb290bm90ZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKSB7XHJcbiAgICAvLyBwcmVzc2luZyB0aGUgaG90a2V5IHdoaWxlIHRoZSBwb3B1cCBlZGl0b3IgaXMgb3BlbiBjbG9zZXMgaXRcclxuICAgIGlmICh0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAoKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG1kVmlldyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHJcbiAgICBpZiAoIW1kVmlldykgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKG1kVmlldy5lZGl0b3IgPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmVkaXRvcjtcclxuICAgIGNvbnN0IGN1cnNvclBvc2l0aW9uID0gZG9jLmdldEN1cnNvcigpO1xyXG4gICAgY29uc3QgbGluZVRleHQgPSBkb2MuZ2V0TGluZShjdXJzb3JQb3NpdGlvbi5saW5lKTtcclxuICAgIGNvbnN0IG1hcmtkb3duVGV4dCA9IG1kVmlldy5kYXRhO1xyXG5cclxuICAgIGlmIChzaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIGlmIChzaG91bGRKdW1wRnJvbU1hcmtlclRvRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxyXG4gICAgICAgIHJldHVybjtcclxuXHJcbiAgICByZXR1cm4gc2hvdWxkQ3JlYXRlQXV0b251bUZvb3Rub3RlKFxyXG4gICAgICAgIGxpbmVUZXh0LFxyXG4gICAgICAgIGN1cnNvclBvc2l0aW9uLFxyXG4gICAgICAgIHBsdWdpbixcclxuICAgICAgICBkb2MsXHJcbiAgICAgICAgbWFya2Rvd25UZXh0XHJcbiAgICApO1xyXG59XHJcblxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZUF1dG9udW1Gb290bm90ZShcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBtYXJrZG93blRleHQ6IHN0cmluZ1xyXG4pIHtcclxuICAgIGN1cnNvclBvc2l0aW9uID0gYWRqdXN0Rm9vdG5vdGVQb3NpdGlvbihjdXJzb3JQb3NpdGlvbiwgZG9jLCBsaW5lVGV4dCwgcGx1Z2luKTtcclxuXHJcbiAgICAvLyBjcmVhdGUgbmV3IGZvb3Rub3RlIHdpdGggdGhlIG5leHQgbnVtZXJpY2FsIGluZGV4XHJcbiAgICBsZXQgbWF0Y2hlcyA9IG1hcmtkb3duVGV4dC5tYXRjaChBbGxOdW1iZXJlZE1hcmtlcnMpO1xyXG4gICAgbGV0IG51bWJlcnM6IEFycmF5PG51bWJlcj4gPSBbXTtcclxuICAgIGxldCBjdXJyZW50TWF4ID0gMTtcclxuXHJcbiAgICBpZiAobWF0Y2hlcyAhPSBudWxsKSB7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gbWF0Y2hlcy5sZW5ndGggLSAxOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IG1hdGNoID0gbWF0Y2hlc1tpXTtcclxuICAgICAgICAgICAgbWF0Y2ggPSBtYXRjaC5yZXBsYWNlKFwiW15cIiwgXCJcIik7XHJcbiAgICAgICAgICAgIG1hdGNoID0gbWF0Y2gucmVwbGFjZShcIl1cIiwgXCJcIik7XHJcbiAgICAgICAgICAgIGxldCBtYXRjaE51bWJlciA9IE51bWJlcihtYXRjaCk7XHJcbiAgICAgICAgICAgIG51bWJlcnNbaV0gPSBtYXRjaE51bWJlcjtcclxuICAgICAgICAgICAgaWYgKG1hdGNoTnVtYmVyICsgMSA+IGN1cnJlbnRNYXgpIHtcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRNYXggPSBtYXRjaE51bWJlciArIDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGZvb3ROb3RlSWQgPSBjdXJyZW50TWF4O1xyXG4gICAgbGV0IGZvb3Rub3RlTWFya2VyID0gYFteJHtmb290Tm90ZUlkfV1gO1xyXG4gICAgbGV0IGxpbmVQYXJ0MSA9IGxpbmVUZXh0LnN1YnN0cigwLCBjdXJzb3JQb3NpdGlvbi5jaCk7XHJcbiAgICBsZXQgbGluZVBhcnQyID0gbGluZVRleHQuc3Vic3RyKGN1cnNvclBvc2l0aW9uLmNoKTtcclxuICAgIGxldCBuZXdMaW5lID0gbGluZVBhcnQxICsgZm9vdG5vdGVNYXJrZXIgKyBsaW5lUGFydDI7XHJcblxyXG4gICAgZG9jLnJlcGxhY2VSYW5nZShcclxuICAgICAgICBuZXdMaW5lLFxyXG4gICAgICAgIHsgbGluZTogY3Vyc29yUG9zaXRpb24ubGluZSwgY2g6IDAgfSxcclxuICAgICAgICB7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiBsaW5lVGV4dC5sZW5ndGggfVxyXG4gICAgKTtcclxuXHJcbiAgICBsZXQgbGFzdExpbmVJbmRleCA9IGRvYy5sYXN0TGluZSgpO1xyXG4gICAgbGV0IGxhc3RMaW5lID0gZG9jLmdldExpbmUobGFzdExpbmVJbmRleCk7XHJcblxyXG4gICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9PT0gdHJ1ZSkge1xyXG4gICAgICAgIHdoaWxlIChsYXN0TGluZUluZGV4ID4gMCkge1xyXG4gICAgICAgICAgICBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xyXG4gICAgICAgICAgICBpZiAobGFzdExpbmUubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgZG9jLnJlcGxhY2VSYW5nZShcclxuICAgICAgICAgICAgICAgICAgICBcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgIHsgbGluZTogbGFzdExpbmVJbmRleCwgY2g6IDAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7IGxpbmU6IGRvYy5sYXN0TGluZSgpLCBjaDogMCB9XHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGFzdExpbmVJbmRleC0tO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBsZXQgZm9vdG5vdGVEZXRhaWwgPSBgXFxuW14ke2Zvb3ROb3RlSWR9XTogYDtcclxuXHJcbiAgICBsZXQgbGlzdCA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhkb2MpO1xyXG4gICAgXHJcbiAgICBsZXQgbmV3Q3Vyc29yUG9zOiBFZGl0b3JQb3NpdGlvbjtcclxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCAmJiBjdXJyZW50TWF4ID09IDEpIHtcclxuICAgICAgICBmb290bm90ZURldGFpbCA9IFwiXFxuXCIgKyBmb290bm90ZURldGFpbDtcclxuICAgICAgICBsZXQgSGVhZGluZyA9IGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihwbHVnaW4pO1xyXG4gICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIEhlYWRpbmcgKyBmb290bm90ZURldGFpbCk7XHJcbiAgICAgICAgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBkb2MubGFzdExpbmUoKSAtIDEsIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZG9jLnNldExpbmUoZG9jLmxhc3RMaW5lKCksIGxhc3RMaW5lICsgZm9vdG5vdGVEZXRhaWwpO1xyXG4gICAgICAgIG5ld0N1cnNvclBvcyA9IHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAocG9wdXBFZGl0aW5nQXZhaWxhYmxlKHBsdWdpbikpIHtcclxuICAgICAgICAvLyB0eXBlIHRoZSBkZXRhaWwgaW4gYSBwb3B1cCBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbVxyXG4gICAgICAgIGRvYy5zZXRDdXJzb3IoeyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogY3Vyc29yUG9zaXRpb24uY2ggKyBmb290bm90ZU1hcmtlci5sZW5ndGggfSk7XHJcbiAgICAgICAgb3BlbkZvb3Rub3RlUG9wdXAocGx1Z2luLCBTdHJpbmcoZm9vdE5vdGVJZCksICgpID0+XHJcbiAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zLCBwbHVnaW4pXHJcbiAgICAgICAgKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MsIHBsdWdpbilcclxuICAgIH1cclxufVxyXG5cclxuXHJcbi8vRlVOQ1RJT05TIEZPUiBOQU1FRCBGT09UTk9URVNcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpbnNlcnROYW1lZEZvb3Rub3RlKHBsdWdpbjogRm9vdG5vdGVQbHVnaW4pIHtcclxuICAgIC8vIHByZXNzaW5nIHRoZSBob3RrZXkgd2hpbGUgdGhlIHBvcHVwIGVkaXRvciBpcyBvcGVuIGNsb3NlcyBpdFxyXG4gICAgaWYgKHRvZ2dsZUNsb3NlRm9vdG5vdGVQb3B1cCgpKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgbWRWaWV3ID0gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG5cclxuICAgIGlmICghbWRWaWV3KSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAobWRWaWV3LmVkaXRvciA9PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICBjb25zdCBkb2MgPSBtZFZpZXcuZWRpdG9yO1xyXG4gICAgY29uc3QgY3Vyc29yUG9zaXRpb24gPSBkb2MuZ2V0Q3Vyc29yKCk7XHJcbiAgICBjb25zdCBsaW5lVGV4dCA9IGRvYy5nZXRMaW5lKGN1cnNvclBvc2l0aW9uLmxpbmUpO1xyXG4gICAgY29uc3QgbWFya2Rvd25UZXh0ID0gbWRWaWV3LmRhdGE7XHJcblxyXG4gICAgaWYgKHNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MsIHBsdWdpbikpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgaWYgKHNob3VsZEp1bXBGcm9tTWFya2VyVG9EZXRhaWwobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MsIHBsdWdpbikpXHJcbiAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgIGlmIChzaG91bGRDcmVhdGVNYXRjaGluZ0Zvb3Rub3RlRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgcGx1Z2luLCBkb2MpKVxyXG4gICAgICAgIHJldHVybjsgXHJcbiAgICByZXR1cm4gc2hvdWxkQ3JlYXRlRm9vdG5vdGVNYXJrZXIoXHJcbiAgICAgICAgbGluZVRleHQsXHJcbiAgICAgICAgY3Vyc29yUG9zaXRpb24sXHJcbiAgICAgICAgZG9jLFxyXG4gICAgICAgIG1hcmtkb3duVGV4dCxcclxuICAgICAgICBwbHVnaW5cclxuICAgICk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDcmVhdGVNYXRjaGluZ0Zvb3Rub3RlRGV0YWlsKFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXHJcbiAgICBkb2M6IEVkaXRvclxyXG4pIHtcclxuICAgIC8vIENyZWF0ZSBtYXRjaGluZyBmb290bm90ZSBkZXRhaWwgZm9yIGZvb3Rub3RlIG1hcmtlclxyXG4gICAgXHJcbiAgICAvLyBkb2VzIHRoaXMgbGluZSBoYXZlIGEgZm9vdG5vdGUgbWFya2VyP1xyXG4gICAgLy8gZG9lcyB0aGUgY3Vyc29yIG92ZXJsYXAgd2l0aCBvbmUgb2YgdGhlbT9cclxuICAgIC8vIGlmIHNvLCB3aGljaCBvbmU/XHJcbiAgICAvLyBkb2VzIHRoaXMgZm9vdG5vdGUgbWFya2VyIGhhdmUgYSBkZXRhaWwgbGluZT9cclxuICAgIC8vIGlmIG5vdCwgY3JlYXRlIGl0IGFuZCBwbGFjZSBjdXJzb3IgdGhlcmVcclxuICAgIGxldCByZU9ubHlNYXJrZXJzTWF0Y2hlcyA9IGxpbmVUZXh0Lm1hdGNoKEFsbE1hcmtlcnMpO1xyXG5cclxuICAgIGxldCBtYXJrZXJUYXJnZXQgPSBudWxsO1xyXG5cclxuICAgIGlmIChyZU9ubHlNYXJrZXJzTWF0Y2hlcyl7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gcmVPbmx5TWFya2Vyc01hdGNoZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IG1hcmtlciA9IHJlT25seU1hcmtlcnNNYXRjaGVzW2ldO1xyXG4gICAgICAgICAgICBpZiAobWFya2VyICE9IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGluZGV4T2ZNYXJrZXJJbkxpbmUgPSBsaW5lVGV4dC5pbmRleE9mKG1hcmtlcik7XHJcbiAgICAgICAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPj0gaW5kZXhPZk1hcmtlckluTGluZSAmJlxyXG4gICAgICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoIDw9IGluZGV4T2ZNYXJrZXJJbkxpbmUgKyBtYXJrZXIubGVuZ3RoXHJcbiAgICAgICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgICAgICBtYXJrZXJUYXJnZXQgPSBtYXJrZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1hcmtlclRhcmdldCAhPSBudWxsKSB7XHJcbiAgICAgICAgLy9leHRyYWN0IGZvb3Rub3RlXHJcbiAgICAgICAgbGV0IG1hdGNoID0gbWFya2VyVGFyZ2V0Lm1hdGNoKEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlKVxyXG4gICAgICAgIC8vZmluZCBpZiB0aGlzIGZvb3Rub3RlIGV4aXN0cyBieSBsaXN0aW5nIGV4aXN0aW5nIGZvb3Rub3RlIGRldGFpbHNcclxuICAgICAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgbGV0IGZvb3Rub3RlSWQgPSBtYXRjaFsyXTtcclxuXHJcbiAgICAgICAgICAgIGxldCBsaXN0OiBzdHJpbmdbXSA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhkb2MpO1xyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIGxpc3QgZG9lc24ndCBpbmNsdWRlIGN1cnJlbnQgZm9vdG5vdGVcclxuICAgICAgICAgICAgLy8gaWYgc28sIGFkZCBkZXRhaWwgZm9yIHRoZSBjdXJyZW50IGZvb3Rub3RlXHJcbiAgICAgICAgICAgIGlmKCFsaXN0LmluY2x1ZGVzKGZvb3Rub3RlSWQpKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbGFzdExpbmVJbmRleCA9IGRvYy5sYXN0TGluZSgpO1xyXG4gICAgICAgICAgICAgICAgbGV0IGxhc3RMaW5lID0gZG9jLmdldExpbmUobGFzdExpbmVJbmRleCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHdoaWxlIChsYXN0TGluZUluZGV4ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFzdExpbmUubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9jLnJlcGxhY2VSYW5nZShcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGluZTogbGFzdExpbmVJbmRleCwgY2g6IDAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxpbmU6IGRvYy5sYXN0TGluZSgpLCBjaDogMCB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdExpbmVJbmRleC0tO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgbGV0IGZvb3Rub3RlRGV0YWlsID0gYFxcblteJHtmb290bm90ZUlkfV06IGA7XHJcblxyXG4gICAgICAgICAgICAgICAgbGV0IG5ld0N1cnNvclBvczogRWRpdG9yUG9zaXRpb247XHJcbiAgICAgICAgICAgICAgICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBmb290bm90ZURldGFpbCA9IFwiXFxuXCIgKyBmb290bm90ZURldGFpbDtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgSGVhZGluZyA9IGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihwbHVnaW4pO1xyXG4gICAgICAgICAgICAgICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIEhlYWRpbmcgKyBmb290bm90ZURldGFpbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBkb2MubGFzdExpbmUoKSAtIDEsIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZG9jLnNldExpbmUoZG9jLmxhc3RMaW5lKCksIGxhc3RMaW5lICsgZm9vdG5vdGVEZXRhaWwpO1xyXG4gICAgICAgICAgICAgICAgICAgIG5ld0N1cnNvclBvcyA9IHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiBmb290bm90ZURldGFpbC5sZW5ndGggLSAxIH1cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAocG9wdXBFZGl0aW5nQXZhaWxhYmxlKHBsdWdpbikpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyB0eXBlIHRoZSBkZXRhaWwgaW4gYSBwb3B1cCBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbVxyXG4gICAgICAgICAgICAgICAgICAgIG9wZW5Gb290bm90ZVBvcHVwKHBsdWdpbiwgZm9vdG5vdGVJZCwgKCkgPT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MsIHBsdWdpbilcclxuICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcywgcGx1Z2luKVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybjsgXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ3JlYXRlRm9vdG5vdGVNYXJrZXIoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBtYXJrZG93blRleHQ6IHN0cmluZyxcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW5cclxuKSB7XHJcbiAgICBjdXJzb3JQb3NpdGlvbiA9IGFkanVzdEZvb3Rub3RlUG9zaXRpb24oY3Vyc29yUG9zaXRpb24sIGRvYywgbGluZVRleHQsIHBsdWdpbik7XHJcblxyXG4gICAgLy9jcmVhdGUgZW1wdHkgZm9vdG5vdGUgbWFya2VyIGZvciBuYW1lIGlucHV0XHJcbiAgICBsZXQgZW1wdHlNYXJrZXIgPSBgW15dYDtcclxuICAgIGRvYy5yZXBsYWNlUmFuZ2UoZW1wdHlNYXJrZXIsY3Vyc29yUG9zaXRpb24pO1xyXG4gICAgLy9tb3ZlIGN1cnNvciBpbiBiZXR3ZWVuIFteIGFuZCBdXHJcbiAgICBjb25zdCBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiBjdXJzb3JQb3NpdGlvbi5jaCArIDIgfVxyXG4gICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MsIHBsdWdpbilcclxuICAgIC8vb3BlbiBmb290bm90ZVBpY2tlciBwb3B1cFxyXG4gICAgXHJcbn1cclxuIiwiaW1wb3J0IHtcclxuICBhZGRJY29uLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBQbHVnaW5cclxufSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmltcG9ydCB7IEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYiwgRm9vdG5vdGVQbHVnaW5TZXR0aW5ncywgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XHJcbmltcG9ydCB7IGRpc21pc3NGb290bm90ZVBvcHVwIH0gZnJvbSBcIi4vZm9vdG5vdGUtcG9wdXBcIjtcclxuaW1wb3J0IHsgaW5zZXJ0QXV0b251bUZvb3Rub3RlLGluc2VydE5hbWVkRm9vdG5vdGUgfSBmcm9tIFwiLi9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzXCI7XHJcblxyXG4vL0FkZCBjaGV2cm9uLXVwLXNxdWFyZSBpY29uIGZyb20gbHVjaWRlIGZvciBtb2JpbGUgdG9vbGJhciAodGVtcG9yYXJ5IHVudGlsIE9ic2lkaWFuIHVwZGF0ZXMgdG8gTHVjaWRlIHYwLjEzMC4wKVxyXG5hZGRJY29uKFwiY2hldnJvbi11cC1zcXVhcmVcIiwgYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBjbGFzcz1cImx1Y2lkZSBsdWNpZGUtY2hldnJvbi11cC1zcXVhcmVcIj48cmVjdCB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB4PVwiM1wiIHk9XCIzXCIgcng9XCIyXCIgcnk9XCIyXCI+PC9yZWN0Pjxwb2x5bGluZSBwb2ludHM9XCI4LDE0IDEyLDEwIDE2LDE0XCI+PC9wb2x5bGluZT48L3N2Zz5gKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvb3Rub3RlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICBwdWJsaWMgc2V0dGluZ3MhOiBGb290bm90ZVBsdWdpblNldHRpbmdzO1xyXG5cclxuICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImluc2VydC1hdXRvbnVtYmVyZWQtZm9vdG5vdGVcIixcclxuICAgICAgbmFtZTogXCJJbnNlcnQgLyBOYXZpZ2F0ZSBBdXRvLU51bWJlcmVkIEZvb3Rub3RlXCIsXHJcbiAgICAgIGljb246IFwicGx1cy1zcXVhcmVcIixcclxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgaWYgKGNoZWNraW5nKVxyXG4gICAgICAgICAgcmV0dXJuICEhdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgICAgICBpbnNlcnRBdXRvbnVtRm9vdG5vdGUodGhpcyk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImluc2VydC1uYW1lZC1mb290bm90ZVwiLFxyXG4gICAgICBuYW1lOiBcIkluc2VydCAvIE5hdmlnYXRlIE5hbWVkIEZvb3Rub3RlXCIsXHJcbiAgICAgIGljb246IFwiY2hldnJvbi11cC1zcXVhcmVcIixcclxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgaWYgKGNoZWNraW5nKVxyXG4gICAgICAgICAgcmV0dXJuICEhdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgICAgICBpbnNlcnROYW1lZEZvb3Rub3RlKHRoaXMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICBcclxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgRm9vdG5vdGVQbHVnaW5TZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxyXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJhY3RpdmUtbGVhZi1jaGFuZ2VcIiwgKCkgPT4gZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBvbnVubG9hZCgpIHtcclxuICAgIGRpc21pc3NGb290bm90ZVBvcHVwKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XHJcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcclxuXHJcbiAgICAvLyBtaWdyYXRlIHByZS0xLjAuNCBzZWN0aW9uIGhlYWRpbmcgdmFsdWVzOiB0aGUgb2xkIHRleHQgaW5wdXQgaW1wbGllZFxyXG4gICAgLy8gYW4gSDEsIHRoZSB0ZXh0YXJlYSB0YWtlcyBsaXRlcmFsIG1hcmtkb3duLCBzbyBjb252ZXJ0IG9uY2UgYW5kIHNhdmVcclxuICAgIGNvbnN0IGhlYWRpbmcgPSB0aGlzLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmc7XHJcbiAgICBpZiAoaGVhZGluZyAmJiAhL14oI3sxLDZ9IHwtLS18XFwqXFwqXFwqfF9fXykvLnRlc3QoaGVhZGluZykpIHtcclxuICAgICAgdGhpcy5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nID0gYCMgJHtoZWFkaW5nfWA7XHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZHJvcCB0aGUgc2V0dGluZyBmb3IgdGhlIHJlbW92ZWQgYXV0b3N1Z2dlc3QgZmVhdHVyZSAoT2JzaWRpYW4gbm93XHJcbiAgICAvLyBzdWdnZXN0cyBmb290bm90ZXMgbmF0aXZlbHkpXHJcbiAgICBpZiAoXCJlbmFibGVBdXRvU3VnZ2VzdFwiIGluIHRoaXMuc2V0dGluZ3MpIHtcclxuICAgICAgZGVsZXRlICh0aGlzLnNldHRpbmdzIGFzIGFueSkuZW5hYmxlQXV0b1N1Z2dlc3Q7XHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gIH1cclxufSJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIk1hcmtkb3duVmlldyIsImFkZEljb24iLCJQbHVnaW4iXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBb0dBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUN0RyxRQUFRLFNBQVMsSUFBSSxDQUFDLE1B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
