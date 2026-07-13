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
        // capture: the null-check above doesn't narrow property access inside
        // the buildEmbed closure
        const file = mdView.file;
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
            const built = plugin.app.embedRegistry.embedByExtension.md({ app: plugin.app, linktext: subpath, sourcePath: file.path, containerEl: containerEl, depth: 0 }, file, subpath);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9mb290bm90ZS1wb3B1cC50cyIsInNyYy9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlLCBTdXBwcmVzc2VkRXJyb3IsIFN5bWJvbCwgSXRlcmF0b3IgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXNEZWNvcmF0ZShjdG9yLCBkZXNjcmlwdG9ySW4sIGRlY29yYXRvcnMsIGNvbnRleHRJbiwgaW5pdGlhbGl6ZXJzLCBleHRyYUluaXRpYWxpemVycykge1xyXG4gICAgZnVuY3Rpb24gYWNjZXB0KGYpIHsgaWYgKGYgIT09IHZvaWQgMCAmJiB0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRnVuY3Rpb24gZXhwZWN0ZWRcIik7IHJldHVybiBmOyB9XHJcbiAgICB2YXIga2luZCA9IGNvbnRleHRJbi5raW5kLCBrZXkgPSBraW5kID09PSBcImdldHRlclwiID8gXCJnZXRcIiA6IGtpbmQgPT09IFwic2V0dGVyXCIgPyBcInNldFwiIDogXCJ2YWx1ZVwiO1xyXG4gICAgdmFyIHRhcmdldCA9ICFkZXNjcmlwdG9ySW4gJiYgY3RvciA/IGNvbnRleHRJbltcInN0YXRpY1wiXSA/IGN0b3IgOiBjdG9yLnByb3RvdHlwZSA6IG51bGw7XHJcbiAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JJbiB8fCAodGFyZ2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGNvbnRleHRJbi5uYW1lKSA6IHt9KTtcclxuICAgIHZhciBfLCBkb25lID0gZmFsc2U7XHJcbiAgICBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4pIGNvbnRleHRbcF0gPSBwID09PSBcImFjY2Vzc1wiID8ge30gOiBjb250ZXh0SW5bcF07XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4uYWNjZXNzKSBjb250ZXh0LmFjY2Vzc1twXSA9IGNvbnRleHRJbi5hY2Nlc3NbcF07XHJcbiAgICAgICAgY29udGV4dC5hZGRJbml0aWFsaXplciA9IGZ1bmN0aW9uIChmKSB7IGlmIChkb25lKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFkZCBpbml0aWFsaXplcnMgYWZ0ZXIgZGVjb3JhdGlvbiBoYXMgY29tcGxldGVkXCIpOyBleHRyYUluaXRpYWxpemVycy5wdXNoKGFjY2VwdChmIHx8IG51bGwpKTsgfTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gKDAsIGRlY29yYXRvcnNbaV0pKGtpbmQgPT09IFwiYWNjZXNzb3JcIiA/IHsgZ2V0OiBkZXNjcmlwdG9yLmdldCwgc2V0OiBkZXNjcmlwdG9yLnNldCB9IDogZGVzY3JpcHRvcltrZXldLCBjb250ZXh0KTtcclxuICAgICAgICBpZiAoa2luZCA9PT0gXCJhY2Nlc3NvclwiKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHZvaWQgMCkgY29udGludWU7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZFwiKTtcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmdldCkpIGRlc2NyaXB0b3IuZ2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LnNldCkpIGRlc2NyaXB0b3Iuc2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmluaXQpKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoXyA9IGFjY2VwdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIGlmIChraW5kID09PSBcImZpZWxkXCIpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgICAgICBlbHNlIGRlc2NyaXB0b3Jba2V5XSA9IF87XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRhcmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgY29udGV4dEluLm5hbWUsIGRlc2NyaXB0b3IpO1xyXG4gICAgZG9uZSA9IHRydWU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19ydW5Jbml0aWFsaXplcnModGhpc0FyZywgaW5pdGlhbGl6ZXJzLCB2YWx1ZSkge1xyXG4gICAgdmFyIHVzZVZhbHVlID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRpYWxpemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhbHVlID0gdXNlVmFsdWUgPyBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnLCB2YWx1ZSkgOiBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1c2VWYWx1ZSA/IHZhbHVlIDogdm9pZCAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcHJvcEtleSh4KSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwic3ltYm9sXCIgPyB4IDogXCJcIi5jb25jYXQoeCk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zZXRGdW5jdGlvbk5hbWUoZiwgbmFtZSwgcHJlZml4KSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3ltYm9sXCIpIG5hbWUgPSBuYW1lLmRlc2NyaXB0aW9uID8gXCJbXCIuY29uY2F0KG5hbWUuZGVzY3JpcHRpb24sIFwiXVwiKSA6IFwiXCI7XHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGYsIFwibmFtZVwiLCB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHByZWZpeCA/IFwiXCIuY29uY2F0KHByZWZpeCwgXCIgXCIsIG5hbWUpIDogbmFtZSB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGcgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEl0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpO1xyXG4gICAgcmV0dXJuIGcubmV4dCA9IHZlcmIoMCksIGdbXCJ0aHJvd1wiXSA9IHZlcmIoMSksIGdbXCJyZXR1cm5cIl0gPSB2ZXJiKDIpLCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBBc3luY0l0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBBc3luY0l0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpLCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIsIGF3YWl0UmV0dXJuKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gYXdhaXRSZXR1cm4oZikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGYsIHJlamVjdCk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpZiAoZ1tuXSkgeyBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyBpZiAoZikgaVtuXSA9IGYoaVtuXSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IGZhbHNlIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbnZhciBvd25LZXlzID0gZnVuY3Rpb24obykge1xyXG4gICAgb3duS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIHx8IGZ1bmN0aW9uIChvKSB7XHJcbiAgICAgICAgdmFyIGFyID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgayBpbiBvKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIGspKSBhclthci5sZW5ndGhdID0gaztcclxuICAgICAgICByZXR1cm4gYXI7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIG93bktleXMobyk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayA9IG93bktleXMobW9kKSwgaSA9IDA7IGkgPCBrLmxlbmd0aDsgaSsrKSBpZiAoa1tpXSAhPT0gXCJkZWZhdWx0XCIpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwga1tpXSk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4oc3RhdGUsIHJlY2VpdmVyKSB7XHJcbiAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwgfHwgKHR5cGVvZiByZWNlaXZlciAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcmVjZWl2ZXIgIT09IFwiZnVuY3Rpb25cIikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgdXNlICdpbicgb3BlcmF0b3Igb24gbm9uLW9iamVjdFwiKTtcclxuICAgIHJldHVybiB0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyID09PSBzdGF0ZSA6IHN0YXRlLmhhcyhyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZShlbnYsIHZhbHVlLCBhc3luYykge1xyXG4gICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkLlwiKTtcclxuICAgICAgICB2YXIgZGlzcG9zZSwgaW5uZXI7XHJcbiAgICAgICAgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmFzeW5jRGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0Rpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmFzeW5jRGlzcG9zZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkaXNwb3NlID09PSB2b2lkIDApIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuZGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5kaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5kaXNwb3NlXTtcclxuICAgICAgICAgICAgaWYgKGFzeW5jKSBpbm5lciA9IGRpc3Bvc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2YgZGlzcG9zZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IG5vdCBkaXNwb3NhYmxlLlwiKTtcclxuICAgICAgICBpZiAoaW5uZXIpIGRpc3Bvc2UgPSBmdW5jdGlvbigpIHsgdHJ5IHsgaW5uZXIuY2FsbCh0aGlzKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7IH0gfTtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IHZhbHVlOiB2YWx1ZSwgZGlzcG9zZTogZGlzcG9zZSwgYXN5bmM6IGFzeW5jIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoYXN5bmMpIHtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IGFzeW5jOiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG5cclxufVxyXG5cclxudmFyIF9TdXBwcmVzc2VkRXJyb3IgPSB0eXBlb2YgU3VwcHJlc3NlZEVycm9yID09PSBcImZ1bmN0aW9uXCIgPyBTdXBwcmVzc2VkRXJyb3IgOiBmdW5jdGlvbiAoZXJyb3IsIHN1cHByZXNzZWQsIG1lc3NhZ2UpIHtcclxuICAgIHZhciBlID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xyXG4gICAgcmV0dXJuIGUubmFtZSA9IFwiU3VwcHJlc3NlZEVycm9yXCIsIGUuZXJyb3IgPSBlcnJvciwgZS5zdXBwcmVzc2VkID0gc3VwcHJlc3NlZCwgZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2Rpc3Bvc2VSZXNvdXJjZXMoZW52KSB7XHJcbiAgICBmdW5jdGlvbiBmYWlsKGUpIHtcclxuICAgICAgICBlbnYuZXJyb3IgPSBlbnYuaGFzRXJyb3IgPyBuZXcgX1N1cHByZXNzZWRFcnJvcihlLCBlbnYuZXJyb3IsIFwiQW4gZXJyb3Igd2FzIHN1cHByZXNzZWQgZHVyaW5nIGRpc3Bvc2FsLlwiKSA6IGU7XHJcbiAgICAgICAgZW52Lmhhc0Vycm9yID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIHZhciByLCBzID0gMDtcclxuICAgIGZ1bmN0aW9uIG5leHQoKSB7XHJcbiAgICAgICAgd2hpbGUgKHIgPSBlbnYuc3RhY2sucG9wKCkpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmICghci5hc3luYyAmJiBzID09PSAxKSByZXR1cm4gcyA9IDAsIGVudi5zdGFjay5wdXNoKHIpLCBQcm9taXNlLnJlc29sdmUoKS50aGVuKG5leHQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHIuZGlzcG9zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSByLmRpc3Bvc2UuY2FsbChyLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoci5hc3luYykgcmV0dXJuIHMgfD0gMiwgUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCkudGhlbihuZXh0LCBmdW5jdGlvbihlKSB7IGZhaWwoZSk7IHJldHVybiBuZXh0KCk7IH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBzIHw9IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIGZhaWwoZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHMgPT09IDEpIHJldHVybiBlbnYuaGFzRXJyb3IgPyBQcm9taXNlLnJlamVjdChlbnYuZXJyb3IpIDogUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgaWYgKGVudi5oYXNFcnJvcikgdGhyb3cgZW52LmVycm9yO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5leHQoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uKHBhdGgsIHByZXNlcnZlSnN4KSB7XHJcbiAgICBpZiAodHlwZW9mIHBhdGggPT09IFwic3RyaW5nXCIgJiYgL15cXC5cXC4/XFwvLy50ZXN0KHBhdGgpKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhdGgucmVwbGFjZSgvXFwuKHRzeCkkfCgoPzpcXC5kKT8pKCg/OlxcLlteLi9dKz8pPylcXC4oW2NtXT8pdHMkL2ksIGZ1bmN0aW9uIChtLCB0c3gsIGQsIGV4dCwgY20pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRzeCA/IHByZXNlcnZlSnN4ID8gXCIuanN4XCIgOiBcIi5qc1wiIDogZCAmJiAoIWV4dCB8fCAhY20pID8gbSA6IChkICsgZXh0ICsgXCIuXCIgKyBjbS50b0xvd2VyQ2FzZSgpICsgXCJqc1wiKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiBwYXRoO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBfX2V4dGVuZHM6IF9fZXh0ZW5kcyxcclxuICAgIF9fYXNzaWduOiBfX2Fzc2lnbixcclxuICAgIF9fcmVzdDogX19yZXN0LFxyXG4gICAgX19kZWNvcmF0ZTogX19kZWNvcmF0ZSxcclxuICAgIF9fcGFyYW06IF9fcGFyYW0sXHJcbiAgICBfX2VzRGVjb3JhdGU6IF9fZXNEZWNvcmF0ZSxcclxuICAgIF9fcnVuSW5pdGlhbGl6ZXJzOiBfX3J1bkluaXRpYWxpemVycyxcclxuICAgIF9fcHJvcEtleTogX19wcm9wS2V5LFxyXG4gICAgX19zZXRGdW5jdGlvbk5hbWU6IF9fc2V0RnVuY3Rpb25OYW1lLFxyXG4gICAgX19tZXRhZGF0YTogX19tZXRhZGF0YSxcclxuICAgIF9fYXdhaXRlcjogX19hd2FpdGVyLFxyXG4gICAgX19nZW5lcmF0b3I6IF9fZ2VuZXJhdG9yLFxyXG4gICAgX19jcmVhdGVCaW5kaW5nOiBfX2NyZWF0ZUJpbmRpbmcsXHJcbiAgICBfX2V4cG9ydFN0YXI6IF9fZXhwb3J0U3RhcixcclxuICAgIF9fdmFsdWVzOiBfX3ZhbHVlcyxcclxuICAgIF9fcmVhZDogX19yZWFkLFxyXG4gICAgX19zcHJlYWQ6IF9fc3ByZWFkLFxyXG4gICAgX19zcHJlYWRBcnJheXM6IF9fc3ByZWFkQXJyYXlzLFxyXG4gICAgX19zcHJlYWRBcnJheTogX19zcHJlYWRBcnJheSxcclxuICAgIF9fYXdhaXQ6IF9fYXdhaXQsXHJcbiAgICBfX2FzeW5jR2VuZXJhdG9yOiBfX2FzeW5jR2VuZXJhdG9yLFxyXG4gICAgX19hc3luY0RlbGVnYXRvcjogX19hc3luY0RlbGVnYXRvcixcclxuICAgIF9fYXN5bmNWYWx1ZXM6IF9fYXN5bmNWYWx1ZXMsXHJcbiAgICBfX21ha2VUZW1wbGF0ZU9iamVjdDogX19tYWtlVGVtcGxhdGVPYmplY3QsXHJcbiAgICBfX2ltcG9ydFN0YXI6IF9faW1wb3J0U3RhcixcclxuICAgIF9faW1wb3J0RGVmYXVsdDogX19pbXBvcnREZWZhdWx0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldDogX19jbGFzc1ByaXZhdGVGaWVsZEdldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRTZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkSW46IF9fY2xhc3NQcml2YXRlRmllbGRJbixcclxuICAgIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlOiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZSxcclxuICAgIF9fZGlzcG9zZVJlc291cmNlczogX19kaXNwb3NlUmVzb3VyY2VzLFxyXG4gICAgX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb246IF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uLFxyXG59O1xyXG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIFNldHRpbmdEZWZpbml0aW9uSXRlbSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBGb290bm90ZVBsdWdpblNldHRpbmdzIHtcclxuICAgIGluc2VydEF0RW5kT2ZXb3JkOiBib29sZWFuO1xyXG4gICAgZW5hYmxlUG9wdXBFZGl0b3I6IGJvb2xlYW47XHJcblxyXG4gICAgZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogYm9vbGVhbjtcclxuICAgIEZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IHN0cmluZztcclxuXHJcbiAgICBlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lczogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEZvb3Rub3RlUGx1Z2luU2V0dGluZ3MgPSB7XHJcbiAgICBpbnNlcnRBdEVuZE9mV29yZDogdHJ1ZSxcclxuICAgIGVuYWJsZVBvcHVwRWRpdG9yOiB0cnVlLFxyXG5cclxuICAgIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IGZhbHNlLFxyXG4gICAgRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogXCIjIEZvb3Rub3Rlc1wiLFxyXG5cclxuICAgIGVuYWJsZVJlbW92ZUJsYW5rTGFzdExpbmVzOiB0cnVlLFxyXG59O1xyXG5cclxuZXhwb3J0IGNsYXNzIEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xyXG4gICAgICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBPYnNpZGlhbiAxLjEzLjArIHJlbmRlcnMgdGhlIHRhYiBmcm9tIHRoZXNlIGRlZmluaXRpb25zIGFuZCBza2lwc1xyXG4gICAgLy8gZGlzcGxheSgpOyBjb250cm9scyBiaW5kIHRvIHRoaXMucGx1Z2luLnNldHRpbmdzW2tleV0gYW5kIGF1dG8tc2F2ZVxyXG4gICAgZ2V0U2V0dGluZ0RlZmluaXRpb25zKCk6IFNldHRpbmdEZWZpbml0aW9uSXRlbVtdIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiLFxyXG4gICAgICAgICAgICAgICAgZGVzYzogXCJBIG5ldyBmb290bm90ZSBpcyBvbmx5IGluc2VydGVkIGF0IHRoZSBlbmQgb2YgdGhlIHdvcmQgYW5kIGFmdGVyIGFueSBwdW5jdHVhdGlvbi5cIixcclxuICAgICAgICAgICAgICAgIGNvbnRyb2w6IHsgdHlwZTogXCJ0b2dnbGVcIiwga2V5OiBcImluc2VydEF0RW5kT2ZXb3JkXCIgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJFZGl0IGZvb3Rub3RlcyBpbiBhIHBvcHVwXCIsXHJcbiAgICAgICAgICAgICAgICBkZXNjOiBcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCBFc2NhcGUsIG9yIGJ5IGNsaWNraW5nIG91dHNpZGUuXCIsXHJcbiAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVQb3B1cEVkaXRvclwiIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiZ3JvdXBcIixcclxuICAgICAgICAgICAgICAgIGhlYWRpbmc6IFwiRm9vdG5vdGVzIFNlY3Rpb25cIixcclxuICAgICAgICAgICAgICAgIGl0ZW1zOiBbXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIlRyaW0gYmxhbmsgbGluZXNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzYzogXCJSZW1vdmUgYmxhbmsgbGluZXMgZnJvbSB0aGUgZW5kIG9mIHRoZSBub3RlIHdoZW4gaW5zZXJ0aW5nIGEgbmV3IGZvb3Rub3RlcyBzZWN0aW9uLlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lc1wiIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiRW5hYmxlIHNlY3Rpb24gaGVhZGluZ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjOiBcIkF1dG9tYXRpY2FsbHkgYWRkcyBhIGhlYWRpbmcgc2VwYXJhdGluZyBmb290bm90ZXMgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbm90ZSBmcm9tIHRoZSByZXN0IG9mIHRoZSB0ZXh0LlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nXCIgfSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJTZWN0aW9uIGhlYWRpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzYzogXCJIZWFkaW5nIHRvIHBsYWNlIGFib3ZlIHRoZSBmb290bm90ZXMgc2VjdGlvbi4gQWNjZXB0cyBzdGFuZGFyZCBtYXJrZG93biwgaW5jbHVkaW5nIG11bHRpcGxlIGxpbmVzIGFuZCBkaXZpZGVycy5cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udHJvbDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ0ZXh0YXJlYVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBcIkZvb3Rub3RlU2VjdGlvbkhlYWRpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3M6IDYsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcjogXCJFeDogJyMgRm9vdG5vdGVzJ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ6ICgpID0+ICF0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIF07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gT2JzaWRpYW4gPCAxLjEzLjAgZmFsbHMgYmFjayB0byB0aGlzIGltcGVyYXRpdmUgaW1wbGVtZW50YXRpb247XHJcbiAgICAvLyBrZWVwIGl0IGluIHN5bmMgd2l0aCBnZXRTZXR0aW5nRGVmaW5pdGlvbnMoKSBhYm92ZVxyXG4gICAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcclxuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiQSBuZXcgZm9vdG5vdGUgaXMgb25seSBpbnNlcnRlZCBhdCB0aGUgZW5kIG9mIHRoZSB3b3JkIGFuZCBhZnRlciBhbnkgcHVuY3R1YXRpb24uXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZClcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZCA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkVkaXQgZm9vdG5vdGVzIGluIGEgcG9wdXBcIilcclxuICAgICAgICAuc2V0RGVzYyhcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCBFc2NhcGUsIG9yIGJ5IGNsaWNraW5nIG91dHNpZGUuXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVQb3B1cEVkaXRvcilcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVQb3B1cEVkaXRvciA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkZvb3Rub3RlcyBTZWN0aW9uXCIpXHJcbiAgICAgICAgLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJUcmltIGJsYW5rIGxpbmVzXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJSZW1vdmUgYmxhbmsgbGluZXMgZnJvbSB0aGUgZW5kIG9mIHRoZSBub3RlIHdoZW4gaW5zZXJ0aW5nIGEgbmV3IGZvb3Rub3RlIHNlY3Rpb24uXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkVuYWJsZSBzZWN0aW9uIGhlYWRpbmdcIilcclxuICAgICAgICAuc2V0RGVzYyhcIkF1dG9tYXRpY2FsbHkgYWRkcyBhIGhlYWRpbmcgc2VwYXJhdGluZyBmb290bm90ZXMgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbm90ZSBmcm9tIHRoZSByZXN0IG9mIHRoZSB0ZXh0LlwiKVxyXG4gICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICAgICAgdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKFwiU2VjdGlvbiBoZWFkaW5nXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJIZWFkaW5nIHRvIHBsYWNlIGFib3ZlIHRoZSBmb290bm90ZXMgc2VjdGlvbi4gQWNjZXB0cyBzdGFuZGFyZCBtYXJrZG93biwgaW5jbHVkaW5nIG11bHRpcGxlIGxpbmVzIGFuZCBkaXZpZGVycy5cIilcclxuICAgICAgICAuYWRkVGV4dEFyZWEoKHRleHQpID0+XHJcbiAgICAgICAgICAgIHRleHRcclxuICAgICAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIkV4OiAnIyBGb290bm90ZXMnXCIpXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oKHRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUud2lkdGggPSAnMTAwJSc7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnJvd3MgPSA2O1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHQuaW5wdXRFbC5zdHlsZS5yZXNpemUgPSAnbm9uZSc7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgeyBNYXJrZG93blZpZXcgfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmltcG9ydCBGb290bm90ZVBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcblxyXG4vLyBBIHNtYWxsIHBvcHVwIGFuY2hvcmVkIGF0IHRoZSBjdXJzb3IgY29udGFpbmluZyBPYnNpZGlhbidzIG93biBlZGl0YWJsZVxyXG4vLyBtYXJrZG93biBlbWJlZCwgYm91bmQgdG8ganVzdCB0aGUgZm9vdG5vdGUncyBkZXRhaWwgdmlhIHRoZSBgI1teaWRdYFxyXG4vLyBzdWJwYXRoICh0aGUgc2FtZSBtYWNoaW5lcnkgdGhlIGNvcmUgRm9vdG5vdGVzIHZpZXcgdXNlcykuIEVkaXRpbmcgaW4gdGhlXHJcbi8vIHBvcHVwIHNhdmVzIHN0cmFpZ2h0IGJhY2sgdG8gdGhlIGRldGFpbCBsaW5lIGF0IHRoZSBib3R0b20gb2YgdGhlIG5vdGUsXHJcbi8vIHNvIHRoZSB1c2VyJ3MgY3Vyc29yIG5ldmVyIGhhcyB0byBsZWF2ZSB0aGUgdGV4dC5cclxuXHJcbnR5cGUgQWN0aXZlUG9wdXAgPSB7XHJcbiAgICBjb250YWluZXJFbDogSFRNTEVsZW1lbnQ7XHJcbiAgICBjbG9zZTogKGZvY3VzRWRpdG9yOiBib29sZWFuKSA9PiB2b2lkO1xyXG59O1xyXG5cclxubGV0IGFjdGl2ZVBvcHVwOiBBY3RpdmVQb3B1cCB8IG51bGwgPSBudWxsO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKTogYm9vbGVhbiB7XHJcbiAgICAvLyBlbWJlZFJlZ2lzdHJ5IGlzIHVuZG9jdW1lbnRlZCBBUEksIHNvIGRlZ3JhZGUgdG8gdGhlIGxlZ2FjeVxyXG4gICAgLy8ganVtcC10by1ib3R0b20gYmVoYXZpb3IgaWYgaXQgZXZlciBjaGFuZ2VzIHNoYXBlXHJcbiAgICBjb25zdCByZWdpc3RyeSA9IChwbHVnaW4uYXBwIGFzIGFueSkuZW1iZWRSZWdpc3RyeTtcclxuICAgIHJldHVybiBwbHVnaW4uc2V0dGluZ3MuZW5hYmxlUG9wdXBFZGl0b3IgPT09IHRydWVcclxuICAgICAgICAmJiB0eXBlb2YgcmVnaXN0cnk/LmVtYmVkQnlFeHRlbnNpb24/Lm1kID09PSBcImZ1bmN0aW9uXCI7XHJcbn1cclxuXHJcbi8vIENsb3NlIGZyb20gdGhlIGZvb3Rub3RlIGhvdGtleTsgcmV0dXJucyB3aGV0aGVyIGEgcG9wdXAgd2FzIG9wZW4sIHNvIHRoZVxyXG4vLyBob3RrZXkgY2FuIHRvZ2dsZSB0aGUgcG9wdXAgaW5zdGVhZCBvZiBpbnNlcnRpbmcgYW5vdGhlciBmb290bm90ZS5cclxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUNsb3NlRm9vdG5vdGVQb3B1cCgpOiBib29sZWFuIHtcclxuICAgIGlmIChhY3RpdmVQb3B1cCkge1xyXG4gICAgICAgIGFjdGl2ZVBvcHVwLmNsb3NlKHRydWUpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG4vLyBDbG9zZSB3aXRob3V0IHN0ZWFsaW5nIGZvY3VzIChsZWFmIHN3aXRjaGVkLCBwbHVnaW4gdW5sb2FkaW5nKS5cclxuZXhwb3J0IGZ1bmN0aW9uIGRpc21pc3NGb290bm90ZVBvcHVwKCkge1xyXG4gICAgaWYgKGFjdGl2ZVBvcHVwKSB7XHJcbiAgICAgICAgYWN0aXZlUG9wdXAuY2xvc2UoZmFsc2UpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlbkZvb3Rub3RlUG9wdXAoXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4gICAgZm9vdG5vdGVJZDogc3RyaW5nLFxyXG4gICAgb25VbmF2YWlsYWJsZT86ICgpID0+IHZvaWQsXHJcbikge1xyXG4gICAgZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKTtcclxuXHJcbiAgICBjb25zdCBtZFZpZXcgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICBpZiAoIW1kVmlldyB8fCAhbWRWaWV3LmZpbGUpIHJldHVybjtcclxuICAgIC8vIGNhcHR1cmU6IHRoZSBudWxsLWNoZWNrIGFib3ZlIGRvZXNuJ3QgbmFycm93IHByb3BlcnR5IGFjY2VzcyBpbnNpZGVcclxuICAgIC8vIHRoZSBidWlsZEVtYmVkIGNsb3N1cmVcclxuICAgIGNvbnN0IGZpbGUgPSBtZFZpZXcuZmlsZTtcclxuXHJcbiAgICAvLyBhIGp1c3QtaW5zZXJ0ZWQgZGV0YWlsIGlzIG9ubHkgaW5kZXhlZCBvbmNlIHRoZSBmaWxlIHNhdmVzIOKAlCBidXRcclxuICAgIC8vIG1kVmlldy5kYXRhIGxhZ3MgYSB0aWNrIGJlaGluZCBlZGl0b3IgQVBJIGNoYW5nZXMsIHNvIHNhdmluZyB0b28gZWFybHlcclxuICAgIC8vIHdvdWxkIHdyaXRlIHByZS1pbnNlcnRpb24gY29udGVudCB0byBkaXNrOyB3YWl0IGZvciB0aGUgYnVmZmVyIHRvXHJcbiAgICAvLyBjYXRjaCB1cCBmaXJzdC4gRmluaXNoaW5nIHRoZSBzYXZlIChhbmQgaXRzIGZvbGQtc3RhdGUgZXZlbnQpIGJlZm9yZVxyXG4gICAgLy8gdGhlIGVtYmVkIGV4aXN0cyBhbHNvIGtlZXBzIGl0IGZyb20gcmVhY2hpbmcgYSBoYWxmLWluaXRpYWxpemVkIGVtYmVkLlxyXG4gICAgY29uc3QgZGV0YWlsVG9rZW4gPSBgW14ke2Zvb3Rub3RlSWR9XTpgO1xyXG4gICAgY29uc3QgZGF0YURlYWRsaW5lID0gRGF0ZS5ub3coKSArIDIwMDA7XHJcbiAgICB3aGlsZSAoIW1kVmlldy5kYXRhLmluY2x1ZGVzKGRldGFpbFRva2VuKSAmJiBEYXRlLm5vdygpIDwgZGF0YURlYWRsaW5lKSB7XHJcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNTApKTtcclxuICAgIH1cclxuICAgIGF3YWl0IG1kVmlldy5zYXZlKCk7XHJcbiAgICBjb25zdCBlZGl0b3IgPSBtZFZpZXcuZWRpdG9yO1xyXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmNvbnRhaW5lckVsLm93bmVyRG9jdW1lbnQ7XHJcbiAgICBjb25zdCB3aW4gPSBkb2MuZGVmYXVsdFZpZXcgfHwgd2luZG93O1xyXG5cclxuICAgIC8vIGFuY2hvciBqdXN0IGJlbG93IHRoZSBjdXJzb3IsIGZsaXBwaW5nIGFib3ZlIGl0IG5lYXIgdGhlIHdpbmRvdyBib3R0b21cclxuICAgIGNvbnN0IGNtID0gKGVkaXRvciBhcyBhbnkpLmNtO1xyXG4gICAgY29uc3QgY29vcmRzID0gY20gPyBjbS5jb29yZHNBdFBvcyhjbS5zdGF0ZS5zZWxlY3Rpb24ubWFpbi5oZWFkKSA6IG51bGw7XHJcbiAgICBjb25zdCB3aWR0aCA9IE1hdGgubWluKDQ4MCwgd2luLmlubmVyV2lkdGggLSAzMik7XHJcbiAgICBjb25zdCBsZWZ0ID0gTWF0aC5tYXgoMTYsIE1hdGgubWluKGNvb3JkcyA/IGNvb3Jkcy5sZWZ0IDogMTAwLCB3aW4uaW5uZXJXaWR0aCAtIHdpZHRoIC0gMTYpKTtcclxuICAgIGxldCB0b3AgPSAoY29vcmRzID8gY29vcmRzLmJvdHRvbSA6IDEwMCkgKyA2O1xyXG4gICAgaWYgKHRvcCArIDI2MCA+IHdpbi5pbm5lckhlaWdodCkge1xyXG4gICAgICAgIHRvcCA9IE1hdGgubWF4KDE2LCAoY29vcmRzID8gY29vcmRzLnRvcCA6IDMwMCkgLSAyNjYpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnRhaW5lckVsID0gZG9jLmJvZHkuY3JlYXRlRGl2KFwiZm9vdG5vdGUtc2hvcnRjdXQtcG9wdXBcIik7XHJcbiAgICBjb250YWluZXJFbC5zdHlsZS5sZWZ0ID0gYCR7bGVmdH1weGA7XHJcbiAgICBjb250YWluZXJFbC5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xyXG4gICAgY29udGFpbmVyRWwuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XHJcbiAgICAvLyBzdGF5IGludmlzaWJsZSB1bnRpbCB0aGUgZm9vdG5vdGUgZGV0YWlsIGlzIGFjdHVhbGx5IGxvYWRlZFxyXG4gICAgY29udGFpbmVyRWwuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XHJcblxyXG4gICAgY29uc3Qgc3VicGF0aCA9IGAjW14ke2Zvb3Rub3RlSWR9XWA7XHJcbiAgICBjb25zdCBidWlsZEVtYmVkID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGJ1aWx0ID0gKHBsdWdpbi5hcHAgYXMgYW55KS5lbWJlZFJlZ2lzdHJ5LmVtYmVkQnlFeHRlbnNpb24ubWQoXHJcbiAgICAgICAgICAgIHsgYXBwOiBwbHVnaW4uYXBwLCBsaW5rdGV4dDogc3VicGF0aCwgc291cmNlUGF0aDogZmlsZS5wYXRoLCBjb250YWluZXJFbDogY29udGFpbmVyRWwsIGRlcHRoOiAwIH0sXHJcbiAgICAgICAgICAgIGZpbGUsXHJcbiAgICAgICAgICAgIHN1YnBhdGgsXHJcbiAgICAgICAgKTtcclxuICAgICAgICBidWlsdC5lZGl0YWJsZSA9IHRydWU7XHJcbiAgICAgICAgYnVpbHQubG9hZCgpO1xyXG4gICAgICAgIHJldHVybiBidWlsdDtcclxuICAgIH07XHJcbiAgICBsZXQgZW1iZWQgPSBidWlsZEVtYmVkKCk7XHJcblxyXG4gICAgbGV0IGNsb3NlZCA9IGZhbHNlO1xyXG4gICAgY29uc3QgY2xvc2UgPSAoZm9jdXNFZGl0b3I6IGJvb2xlYW4pID0+IHtcclxuICAgICAgICBpZiAoY2xvc2VkKSByZXR1cm47XHJcbiAgICAgICAgY2xvc2VkID0gdHJ1ZTtcclxuICAgICAgICBhY3RpdmVQb3B1cCA9IG51bGw7XHJcbiAgICAgICAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgb25Eb2NNb3VzZURvd24sIHRydWUpO1xyXG4gICAgICAgIGNvbnRhaW5lckVsLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICAgICAgICBpZiAoZm9jdXNFZGl0b3IpIGVkaXRvci5mb2N1cygpO1xyXG5cclxuICAgICAgICAvLyB0aGUgZW1iZWQgc2F2ZXMgZWRpdHMgb24gaXRzIG93biBkZWJvdW5jZTsgbGV0IHRoYXQgY3ljbGUgZmluaXNoXHJcbiAgICAgICAgLy8gYmVmb3JlIHVubG9hZGluZywgc2luY2UgdW5sb2FkaW5nIG1pZC1zYXZlIGNsZWFycyB0aGUgc3RhdGUgdGhlXHJcbiAgICAgICAgLy8gc2F2ZSByZWFkc1xyXG4gICAgICAgIGxldCBhdHRlbXB0cyA9IDA7XHJcbiAgICAgICAgY29uc3QgdGVhcmRvd24gPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICgoZW1iZWQuZGlydHkgfHwgZW1iZWQuc2F2aW5nIHx8IGVtYmVkLnNhdmVBZ2FpbikgJiYgYXR0ZW1wdHMrKyA8IDUwKSB7XHJcbiAgICAgICAgICAgICAgICB3aW4uc2V0VGltZW91dCh0ZWFyZG93biwgMTAwKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbWJlZC51bmxvYWQoKTtcclxuICAgICAgICAgICAgY29udGFpbmVyRWwucmVtb3ZlKCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICB0ZWFyZG93bigpO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBvbkRvY01vdXNlRG93biA9IChldnQ6IE1vdXNlRXZlbnQpID0+IHtcclxuICAgICAgICBpZiAoIWNvbnRhaW5lckVsLmNvbnRhaW5zKGV2dC50YXJnZXQgYXMgTm9kZSkpIGNsb3NlKGZhbHNlKTtcclxuICAgIH07XHJcbiAgICBkb2MuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBvbkRvY01vdXNlRG93biwgdHJ1ZSk7XHJcblxyXG4gICAgLy8gYnViYmxlIHBoYXNlLCBzbyB0aGUgZW1iZWRkZWQgZWRpdG9yIChlLmcuIHZpbSBtb2RlIGxlYXZpbmcgaW5zZXJ0XHJcbiAgICAvLyBtb2RlKSBnZXRzIGZpcnN0IGNsYWltIG9uIEVzY2FwZVxyXG4gICAgY29udGFpbmVyRWwuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2dDogS2V5Ym9hcmRFdmVudCkgPT4ge1xyXG4gICAgICAgIGlmIChldnQua2V5ID09PSBcIkVzY2FwZVwiKSB7XHJcbiAgICAgICAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBjbG9zZSh0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBhY3RpdmVQb3B1cCA9IHsgY29udGFpbmVyRWwsIGNsb3NlIH07XHJcblxyXG4gICAgY29uc3QgdHJ5U2hvdyA9IGFzeW5jICgpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcclxuICAgICAgICBhd2FpdCBlbWJlZC5sb2FkRmlsZSgpO1xyXG4gICAgICAgIGlmIChlbWJlZC5zdWJwYXRoTm90Rm91bmQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb250YWluZXJFbC5zdHlsZS52aXNpYmlsaXR5ID0gXCJcIjtcclxuICAgICAgICBlbWJlZC5zaG93RWRpdG9yKCk7XHJcbiAgICAgICAgZW1iZWQuZWRpdE1vZGU/LmVkaXRvcj8uZm9jdXMoKTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3Qgd2FpdEZvckNhY2hlQ2hhbmdlID0gKCkgPT5cclxuICAgICAgICBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB0aW1lb3V0ID0gd2luLnNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLm9mZnJlZihyZWYpO1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9LCA1MDApO1xyXG4gICAgICAgICAgICBjb25zdCByZWYgPSBwbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZmlsZSA9PT0gbWRWaWV3LmZpbGUpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW4uY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5vZmZyZWYocmVmKTtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHNob3dFZGl0b3IgPSBhc3luYyAoKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XHJcbiAgICAgICAgaWYgKGF3YWl0IHRyeVNob3coKSkgcmV0dXJuIHRydWU7XHJcblxyXG4gICAgICAgIC8vIHJldHJ5IGFzIHRoZSBtZXRhZGF0YSBjYWNoZSBjYXRjaGVzIHVwIHdpdGggdGhlIHNhdmVkIGZpbGU7IGFcclxuICAgICAgICAvLyBsb2FkZWQgZW1iZWQgd29uJ3QgcmUtcmVzb2x2ZSBpdHMgc3VicGF0aCwgc28gcmVidWlsZCBlYWNoIHRpbWVcclxuICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyAzMDAwO1xyXG4gICAgICAgIHdoaWxlIChEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcclxuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckNhY2hlQ2hhbmdlKCk7XHJcbiAgICAgICAgICAgIGlmIChjbG9zZWQpIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICBlbWJlZC51bmxvYWQoKTtcclxuICAgICAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuICAgICAgICAgICAgZW1iZWQgPSBidWlsZEVtYmVkKCk7XHJcbiAgICAgICAgICAgIGlmIChhd2FpdCB0cnlTaG93KCkpIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG5cclxuICAgIHNob3dFZGl0b3IoKVxyXG4gICAgICAgIC50aGVuKChzaG93bikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIXNob3duICYmICFjbG9zZWQpIHtcclxuICAgICAgICAgICAgICAgIGNsb3NlKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIG9uVW5hdmFpbGFibGU/LigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2goKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWNsb3NlZCkge1xyXG4gICAgICAgICAgICAgICAgY2xvc2UoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgb25VbmF2YWlsYWJsZT8uKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxufVxyXG4iLCJpbXBvcnQge1xyXG5cdEVkaXRvcixcclxuXHRFZGl0b3JQb3NpdGlvbixcclxuXHRNYXJrZG93blZpZXdcclxufSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmltcG9ydCBGb290bm90ZVBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcbmltcG9ydCB7IG9wZW5Gb290bm90ZVBvcHVwLCBwb3B1cEVkaXRpbmdBdmFpbGFibGUsIHRvZ2dsZUNsb3NlRm9vdG5vdGVQb3B1cCB9IGZyb20gXCIuL2Zvb3Rub3RlLXBvcHVwXCI7XHJcblxyXG5leHBvcnQgdmFyIEFsbE1hcmtlcnMgPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdKD8hOikvZztcclxudmFyIEFsbE51bWJlcmVkTWFya2VycyA9IC9cXFtcXF4oXFxkKylcXF0vZ2k7XHJcbnZhciBBbGxEZXRhaWxzTmFtZU9ubHkgPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdOi9nO1xyXG52YXIgRGV0YWlsSW5MaW5lID0gL1xcW1xcXihbXlxcW1xcXV0rKVxcXTovO1xyXG5leHBvcnQgdmFyIEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlID0gLyhcXFtcXF4pKFteXFxbXFxdXSspKD89XFxdKS87XHJcblxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhcclxuICAgIGRvYzogRWRpdG9yXHJcbikge1xyXG4gICAgbGV0IEZvb3Rub3RlRGV0YWlsTGlzdDogc3RyaW5nW10gPSBbXTtcclxuICAgIFxyXG4gICAgLy9zZWFyY2ggZWFjaCBsaW5lIGZvciBmb290bm90ZSBkZXRhaWxzIGFuZCBhZGQgdG8gbGlzdFxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xyXG4gICAgICAgIGxldCB0aGVMaW5lID0gZG9jLmdldExpbmUoaSk7XHJcbiAgICAgICAgbGV0IGxpbmVNYXRjaCA9IHRoZUxpbmUubWF0Y2goQWxsRGV0YWlsc05hbWVPbmx5KTtcclxuICAgICAgICBpZiAobGluZU1hdGNoKSB7XHJcbiAgICAgICAgICAgIGxldCB0ZW1wID0gbGluZU1hdGNoWzBdO1xyXG4gICAgICAgICAgICB0ZW1wID0gdGVtcC5yZXBsYWNlKFwiW15cIixcIlwiKTtcclxuICAgICAgICAgICAgdGVtcCA9IHRlbXAucmVwbGFjZShcIl06XCIsXCJcIik7XHJcblxyXG4gICAgICAgICAgICBGb290bm90ZURldGFpbExpc3QucHVzaCh0ZW1wKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gRm9vdG5vdGVEZXRhaWxMaXN0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbGlzdEV4aXN0aW5nRm9vdG5vdGVNYXJrZXJzQW5kTG9jYXRpb25zKFxyXG4gICAgZG9jOiBFZGl0b3JcclxuKSB7XHJcbiAgICB0eXBlIG1hcmtlckVudHJ5ID0ge1xyXG4gICAgICAgIGZvb3Rub3RlOiBzdHJpbmc7XHJcbiAgICAgICAgbGluZU51bTogbnVtYmVyO1xyXG4gICAgICAgIHN0YXJ0SW5kZXg6IG51bWJlcjtcclxuICAgIH1cclxuICAgIGxldCBtYXJrZXJFbnRyeTtcclxuXHJcbiAgICBsZXQgRm9vdG5vdGVNYXJrZXJJbmZvID0gW107XHJcbiAgICAvL3NlYXJjaCBlYWNoIGxpbmUgZm9yIGZvb3Rub3RlIG1hcmtlcnNcclxuICAgIC8vZm9yIGVhY2gsIGFkZCB0aGVpciBuYW1lLCBsaW5lIG51bWJlciwgYW5kIHN0YXJ0IGluZGV4IHRvIEZvb3Rub3RlTWFya2VySW5mb1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xyXG4gICAgICAgIGxldCB0aGVMaW5lID0gZG9jLmdldExpbmUoaSk7XHJcbiAgICAgICAgbGV0IGxpbmVNYXRjaDtcclxuXHJcbiAgICAgICAgd2hpbGUgKChsaW5lTWF0Y2ggPSBBbGxNYXJrZXJzLmV4ZWModGhlTGluZSkpICE9IG51bGwpIHtcclxuICAgICAgICBtYXJrZXJFbnRyeSA9IHtcclxuICAgICAgICAgICAgZm9vdG5vdGU6IGxpbmVNYXRjaFswXSxcclxuICAgICAgICAgICAgbGluZU51bTogaSxcclxuICAgICAgICAgICAgc3RhcnRJbmRleDogbGluZU1hdGNoLmluZGV4XHJcbiAgICAgICAgfVxyXG4gICAgICAgIEZvb3Rub3RlTWFya2VySW5mby5wdXNoKG1hcmtlckVudHJ5KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gRm9vdG5vdGVNYXJrZXJJbmZvO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBvbGRDdXJzb3JQb3M6IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgbmV3Q3Vyc29yUG9zOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXHJcbik6IHZvaWQge1xyXG4gICAgZG9jLnNldEN1cnNvcihuZXdDdXJzb3JQb3MpO1xyXG5cclxuICAgIC8vIGlmIHVzZXIgaGFzIHZpbSBtb2RlIGVuYWJsZWQsIHNldCBqdW1wIHBvaW50XHJcbiAgICAvLyBnZXRDb25maWcgaXMgcHJpdmF0ZSBBUEksIGxpa2UgdGhlIHZpbSBpbnRlcm5hbHMgYmVsb3dcclxuICAgIGlmICgocGx1Z2luLmFwcC52YXVsdCBhcyBhbnkpLmdldENvbmZpZyhcInZpbU1vZGVcIikpIHtcclxuICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXHJcbiAgICAgICAgYWN0aXZlV2luZG93LkNvZGVNaXJyb3JBZGFwdGVyLlZpbS5nZXRWaW1HbG9iYWxTdGF0ZV8oKS5qdW1wTGlzdC5hZGQoXHJcbiAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcclxuICAgICAgICAgICAgZG9jLmNtLmNtLCAvLyBTSUMgdHdvIGxldmVscyBkZWVwXHJcbiAgICAgICAgICAgIG9sZEN1cnNvclBvcyxcclxuICAgICAgICAgICAgbmV3Q3Vyc29yUG9zLFxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIC8vIGNoZWNrIGlmIHdlJ3JlIGluIGEgZm9vdG5vdGUgZGV0YWlsIGxpbmUgKFwiW14xXTogZm9vdG5vdGVcIilcclxuICAgIC8vIGlmIHNvLCBqdW1wIGN1cnNvciBiYWNrIHRvIHRoZSBmb290bm90ZSBpbiB0aGUgdGV4dFxyXG5cclxuICAgIGxldCBtYXRjaCA9IGxpbmVUZXh0Lm1hdGNoKERldGFpbEluTGluZSk7XHJcbiAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICBsZXQgcyA9IG1hdGNoWzBdO1xyXG4gICAgICAgIGxldCBpbmRleCA9IHMucmVwbGFjZShcIlteXCIsIFwiXCIpO1xyXG4gICAgICAgIGluZGV4ID0gaW5kZXgucmVwbGFjZShcIl06XCIsIFwiXCIpO1xyXG4gICAgICAgIGxldCBmb290bm90ZSA9IHMucmVwbGFjZShcIjpcIiwgXCJcIik7XHJcblxyXG4gICAgICAgIGxldCByZXR1cm5MaW5lSW5kZXggPSBjdXJzb3JQb3NpdGlvbi5saW5lO1xyXG4gICAgICAgIC8vIGZpbmQgdGhlIEZJUlNUIE9DQ1VSRU5DRSB3aGVyZSB0aGlzIGZvb3Rub3RlIGV4aXN0cyBpbiB0aGUgdGV4dFxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IHNjYW5MaW5lID0gZG9jLmdldExpbmUoaSk7XHJcbiAgICAgICAgICAgIGlmIChzY2FuTGluZS5jb250YWlucyhmb290bm90ZSkpIHtcclxuICAgICAgICAgICAgICAgIGxldCBjdXJzb3JMb2NhdGlvbkluZGV4ID0gc2NhbkxpbmUuaW5kZXhPZihmb290bm90ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm5MaW5lSW5kZXggPSBpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiByZXR1cm5MaW5lSW5kZXgsIGNoOiBjdXJzb3JMb2NhdGlvbkluZGV4ICsgZm9vdG5vdGUubGVuZ3RoIH07XHJcbiAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcywgcGx1Z2luKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24ganVtcFRvRm9vdG5vdGVEZXRhaWwoXHJcbiAgICBmb290bm90ZU5hbWU6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIC8vIGZpbmQgdGhlIGZpcnN0IGxpbmUgd2l0aCB0aGlzIGRldGFpbCBtYXJrZXIgbmFtZSBpbiBpdC5cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xyXG4gICAgICAgIGxldCBsaW5lTWF0Y2ggPSB0aGVMaW5lLm1hdGNoKERldGFpbEluTGluZSk7XHJcbiAgICAgICAgaWYgKGxpbmVNYXRjaCkge1xyXG4gICAgICAgICAgICAvLyBjb21wYXJlIHRvIHRoZSBpbmRleFxyXG4gICAgICAgICAgICBsZXQgbmFtZU1hdGNoID0gbGluZU1hdGNoWzFdO1xyXG4gICAgICAgICAgICBpZiAobmFtZU1hdGNoID09IGZvb3Rub3RlTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBpLCBjaDogbGluZU1hdGNoWzBdLmxlbmd0aCArIDEgfTtcclxuICAgICAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zLCBwbHVnaW4pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRKdW1wRnJvbU1hcmtlclRvRGV0YWlsKFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIC8vIEp1bXAgY3Vyc29yIFRPIGRldGFpbCBtYXJrZXJcclxuXHJcbiAgICAvLyBkb2VzIHRoaXMgbGluZSBoYXZlIGEgZm9vdG5vdGUgbWFya2VyP1xyXG4gICAgLy8gZG9lcyB0aGUgY3Vyc29yIG92ZXJsYXAgd2l0aCBvbmUgb2YgdGhlbT9cclxuICAgIC8vIGlmIHNvLCB3aGljaCBvbmU/XHJcbiAgICAvLyBmaW5kIHRoaXMgZm9vdG5vdGUgbWFya2VyJ3MgZGV0YWlsIGxpbmVcclxuICAgIC8vIHBsYWNlIGN1cnNvciB0aGVyZVxyXG4gICAgbGV0IG1hcmtlclRhcmdldCA9IG51bGw7XHJcblxyXG4gICAgbGV0IEZvb3Rub3RlTWFya2VySW5mbyA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlTWFya2Vyc0FuZExvY2F0aW9ucyhkb2MpO1xyXG4gICAgbGV0IGN1cnJlbnRMaW5lID0gY3Vyc29yUG9zaXRpb24ubGluZTtcclxuICAgIGxldCBmb290bm90ZXNPbkxpbmUgPSBGb290bm90ZU1hcmtlckluZm8uZmlsdGVyKChtYXJrZXJFbnRyeTogeyBsaW5lTnVtOiBudW1iZXI7IH0pID0+IG1hcmtlckVudHJ5LmxpbmVOdW0gPT09IGN1cnJlbnRMaW5lKTtcclxuXHJcbiAgICBpZiAoZm9vdG5vdGVzT25MaW5lICE9IG51bGwpIHtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBmb290bm90ZXNPbkxpbmUubGVuZ3RoLTE7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZm9vdG5vdGVzT25MaW5lW2ldLmZvb3Rub3RlICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbWFya2VyID0gZm9vdG5vdGVzT25MaW5lW2ldLmZvb3Rub3RlO1xyXG4gICAgICAgICAgICAgICAgbGV0IGluZGV4T2ZNYXJrZXJJbkxpbmUgPSBmb290bm90ZXNPbkxpbmVbaV0uc3RhcnRJbmRleDtcclxuICAgICAgICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoID49IGluZGV4T2ZNYXJrZXJJbkxpbmUgJiZcclxuICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoIDw9IGluZGV4T2ZNYXJrZXJJbkxpbmUgKyBtYXJrZXIubGVuZ3RoXHJcbiAgICAgICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgIG1hcmtlclRhcmdldCA9IG1hcmtlcjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKG1hcmtlclRhcmdldCAhPT0gbnVsbCkge1xyXG4gICAgICAgIC8vIGV4dHJhY3QgbmFtZVxyXG4gICAgICAgIGxldCBtYXRjaCA9IG1hcmtlclRhcmdldC5tYXRjaChFeHRyYWN0TmFtZUZyb21Gb290bm90ZSk7XHJcbiAgICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgICAgIGxldCBmb290bm90ZU5hbWUgPSBtYXRjaFsyXTtcclxuXHJcbiAgICAgICAgICAgIC8vIG1hcmtlcnMgd2l0aG91dCBhIGRldGFpbCBsaW5lIGZhbGwgdGhyb3VnaCB0byB0aGVcclxuICAgICAgICAgICAgLy8gZGV0YWlsLWNyZWF0aW9uIHBhdGhzXHJcbiAgICAgICAgICAgIGxldCBkZXRhaWxzID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKGRvYyk7XHJcbiAgICAgICAgICAgIGlmICghZGV0YWlscy5pbmNsdWRlcyhmb290bm90ZU5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luKSkge1xyXG4gICAgICAgICAgICAgICAgb3BlbkZvb3Rub3RlUG9wdXAocGx1Z2luLCBmb290bm90ZU5hbWUsICgpID0+XHJcbiAgICAgICAgICAgICAgICAgICAganVtcFRvRm9vdG5vdGVEZXRhaWwoZm9vdG5vdGVOYW1lLCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGp1bXBUb0Zvb3Rub3RlRGV0YWlsKGZvb3Rub3RlTmFtZSwgY3Vyc29yUG9zaXRpb24sIGRvYywgcGx1Z2luKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBhZGRGb290bm90ZVNlY3Rpb25IZWFkZXIoXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4pOiBzdHJpbmcge1xyXG4gICAgLy9jaGVjayBpZiAnRW5hYmxlIEZvb3Rub3RlIFNlY3Rpb24gSGVhZGluZycgaXMgdHJ1ZVxyXG4gICAgLy9pZiBzbywgcmV0dXJuIHRoZSBcIkZvb3Rub3RlIFNlY3Rpb24gSGVhZGluZ1wiXHJcbiAgICAvLyBlbHNlLCByZXR1cm4gXCJcIlxyXG5cclxuICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9PSB0cnVlKSB7XHJcbiAgICAgICAgbGV0IHJldHVybkhlYWRpbmcgPSBwbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZztcclxuICAgICAgICAvLyB0aGUgc2V0dGluZyBob2xkcyBsaXRlcmFsIG1hcmtkb3duIChsZWdhY3kgcGxhaW4tdGV4dCB2YWx1ZXMgYXJlXHJcbiAgICAgICAgLy8gbWlncmF0ZWQgb24gbG9hZCk7IGEgZGl2aWRlciBkaXJlY3RseSBiZWxvdyBhIHRleHQgbGluZSB3b3VsZCB0dXJuXHJcbiAgICAgICAgLy8gdGhhdCBsaW5lIGludG8gYSBzZXRleHQgaGVhZGluZywgc28ga2VlcCBhIGJsYW5rIGxpbmUgaW4gYmV0d2VlblxyXG4gICAgICAgIGNvbnN0IGRpdmlkZXJSZWdleCA9IC9eKC0tLXxcXCpcXCpcXCp8X19fKS87XHJcbiAgICAgICAgaWYgKGRpdmlkZXJSZWdleC50ZXN0KHJldHVybkhlYWRpbmcpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBgXFxuXFxuJHtyZXR1cm5IZWFkaW5nfWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBgXFxuJHtyZXR1cm5IZWFkaW5nfWA7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gXCJcIjtcclxufVxyXG5cclxuLyoqIGFkanVzdCBjdXJzb3IgcG9zaXRpb24gdG8gaW5zZXJ0IGEgZm9vdG5vdGUgb25seSBhdCB0aGUgZW5kIG9mIHdvcmQgKi9cclxuZnVuY3Rpb24gYWRqdXN0Rm9vdG5vdGVQb3NpdGlvbihcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW5cclxuKSB7XHJcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZCkgcmV0dXJuIGN1cnNvclBvc2l0aW9uO1xyXG4gICAgY29uc3QgZW5kT2ZXb3JkVW5kZXJDdXJzb3IgPSBkb2Mud29yZEF0KGN1cnNvclBvc2l0aW9uKT8udG87XHJcbiAgICBpZiAoIWVuZE9mV29yZFVuZGVyQ3Vyc29yKSByZXR1cm4gY3Vyc29yUG9zaXRpb247IC8vIG5vIHdvcmQgdW5kZXIgY3Vyc29yXHJcblxyXG4gICAgLy8gYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB0byBpbnNlcnQgYSBmb290bm90ZSBvbmx5IGF0IHRoZSBlbmQgb2Ygd29yZFxyXG4gICAgY29uc3QgbmV4dENoYXIgPSBsaW5lVGV4dC5jaGFyQXQoZW5kT2ZXb3JkVW5kZXJDdXJzb3IuY2gpO1xyXG4gICAgaWYgKFtcIi5cIiwgXCIsXCIsIFwiOlwiLCBcIjtcIl0uaW5jbHVkZXMobmV4dENoYXIpKSBlbmRPZldvcmRVbmRlckN1cnNvci5jaCsrO1xyXG4gICAgY3Vyc29yUG9zaXRpb24gPSBlbmRPZldvcmRVbmRlckN1cnNvcjtcclxuICAgIHJldHVybiBjdXJzb3JQb3NpdGlvbjtcclxufVxyXG5cclxuLy9GVU5DVElPTlMgRk9SIEFVVE9OVU1CRVJFRCBGT09UTk9URVNcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpbnNlcnRBdXRvbnVtRm9vdG5vdGUocGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xyXG4gICAgLy8gcHJlc3NpbmcgdGhlIGhvdGtleSB3aGlsZSB0aGUgcG9wdXAgZWRpdG9yIGlzIG9wZW4gY2xvc2VzIGl0XHJcbiAgICBpZiAodG9nZ2xlQ2xvc2VGb290bm90ZVBvcHVwKCkpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBtZFZpZXcgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcblxyXG4gICAgaWYgKCFtZFZpZXcpIHJldHVybiBmYWxzZTtcclxuICAgIGlmIChtZFZpZXcuZWRpdG9yID09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgIGNvbnN0IGRvYyA9IG1kVmlldy5lZGl0b3I7XHJcbiAgICBjb25zdCBjdXJzb3JQb3NpdGlvbiA9IGRvYy5nZXRDdXJzb3IoKTtcclxuICAgIGNvbnN0IGxpbmVUZXh0ID0gZG9jLmdldExpbmUoY3Vyc29yUG9zaXRpb24ubGluZSk7XHJcbiAgICBjb25zdCBtYXJrZG93blRleHQgPSBtZFZpZXcuZGF0YTtcclxuXHJcbiAgICBpZiAoc2hvdWxkSnVtcEZyb21EZXRhaWxUb01hcmtlcihsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYywgcGx1Z2luKSlcclxuICAgICAgICByZXR1cm47XHJcbiAgICBpZiAoc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYywgcGx1Z2luKSlcclxuICAgICAgICByZXR1cm47XHJcblxyXG4gICAgcmV0dXJuIHNob3VsZENyZWF0ZUF1dG9udW1Gb290bm90ZShcclxuICAgICAgICBsaW5lVGV4dCxcclxuICAgICAgICBjdXJzb3JQb3NpdGlvbixcclxuICAgICAgICBwbHVnaW4sXHJcbiAgICAgICAgZG9jLFxyXG4gICAgICAgIG1hcmtkb3duVGV4dFxyXG4gICAgKTtcclxufVxyXG5cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDcmVhdGVBdXRvbnVtRm9vdG5vdGUoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgbWFya2Rvd25UZXh0OiBzdHJpbmdcclxuKSB7XHJcbiAgICBjdXJzb3JQb3NpdGlvbiA9IGFkanVzdEZvb3Rub3RlUG9zaXRpb24oY3Vyc29yUG9zaXRpb24sIGRvYywgbGluZVRleHQsIHBsdWdpbik7XHJcblxyXG4gICAgLy8gY3JlYXRlIG5ldyBmb290bm90ZSB3aXRoIHRoZSBuZXh0IG51bWVyaWNhbCBpbmRleFxyXG4gICAgbGV0IG1hdGNoZXMgPSBtYXJrZG93blRleHQubWF0Y2goQWxsTnVtYmVyZWRNYXJrZXJzKTtcclxuICAgIGxldCBudW1iZXJzOiBBcnJheTxudW1iZXI+ID0gW107XHJcbiAgICBsZXQgY3VycmVudE1heCA9IDE7XHJcblxyXG4gICAgaWYgKG1hdGNoZXMgIT0gbnVsbCkge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IG1hdGNoZXMubGVuZ3RoIC0gMTsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBtYXRjaCA9IG1hdGNoZXNbaV07XHJcbiAgICAgICAgICAgIG1hdGNoID0gbWF0Y2gucmVwbGFjZShcIlteXCIsIFwiXCIpO1xyXG4gICAgICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoXCJdXCIsIFwiXCIpO1xyXG4gICAgICAgICAgICBsZXQgbWF0Y2hOdW1iZXIgPSBOdW1iZXIobWF0Y2gpO1xyXG4gICAgICAgICAgICBudW1iZXJzW2ldID0gbWF0Y2hOdW1iZXI7XHJcbiAgICAgICAgICAgIGlmIChtYXRjaE51bWJlciArIDEgPiBjdXJyZW50TWF4KSB7XHJcbiAgICAgICAgICAgICAgICBjdXJyZW50TWF4ID0gbWF0Y2hOdW1iZXIgKyAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGxldCBmb290Tm90ZUlkID0gY3VycmVudE1heDtcclxuICAgIGxldCBmb290bm90ZU1hcmtlciA9IGBbXiR7Zm9vdE5vdGVJZH1dYDtcclxuICAgIGxldCBsaW5lUGFydDEgPSBsaW5lVGV4dC5zdWJzdHIoMCwgY3Vyc29yUG9zaXRpb24uY2gpO1xyXG4gICAgbGV0IGxpbmVQYXJ0MiA9IGxpbmVUZXh0LnN1YnN0cihjdXJzb3JQb3NpdGlvbi5jaCk7XHJcbiAgICBsZXQgbmV3TGluZSA9IGxpbmVQYXJ0MSArIGZvb3Rub3RlTWFya2VyICsgbGluZVBhcnQyO1xyXG5cclxuICAgIGRvYy5yZXBsYWNlUmFuZ2UoXHJcbiAgICAgICAgbmV3TGluZSxcclxuICAgICAgICB7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiAwIH0sXHJcbiAgICAgICAgeyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogbGluZVRleHQubGVuZ3RoIH1cclxuICAgICk7XHJcblxyXG4gICAgbGV0IGxhc3RMaW5lSW5kZXggPSBkb2MubGFzdExpbmUoKTtcclxuICAgIGxldCBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xyXG5cclxuICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXMgPT09IHRydWUpIHtcclxuICAgICAgICB3aGlsZSAobGFzdExpbmVJbmRleCA+IDApIHtcclxuICAgICAgICAgICAgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcclxuICAgICAgICAgICAgaWYgKGxhc3RMaW5lLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIGRvYy5yZXBsYWNlUmFuZ2UoXHJcbiAgICAgICAgICAgICAgICAgICAgXCJcIixcclxuICAgICAgICAgICAgICAgICAgICB7IGxpbmU6IGxhc3RMaW5lSW5kZXgsIGNoOiAwIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgeyBsaW5lOiBkb2MubGFzdExpbmUoKSwgY2g6IDAgfVxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxhc3RMaW5lSW5kZXgtLTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGZvb3Rub3RlRGV0YWlsID0gYFxcblteJHtmb290Tm90ZUlkfV06IGA7XHJcblxyXG4gICAgbGV0IGxpc3QgPSBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoZG9jKTtcclxuICAgIFxyXG4gICAgbGV0IG5ld0N1cnNvclBvczogRWRpdG9yUG9zaXRpb247XHJcbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDAgJiYgY3VycmVudE1heCA9PSAxKSB7XHJcbiAgICAgICAgZm9vdG5vdGVEZXRhaWwgPSBcIlxcblwiICsgZm9vdG5vdGVEZXRhaWw7XHJcbiAgICAgICAgbGV0IEhlYWRpbmcgPSBhZGRGb290bm90ZVNlY3Rpb25IZWFkZXIocGx1Z2luKTtcclxuICAgICAgICBkb2Muc2V0TGluZShkb2MubGFzdExpbmUoKSwgbGFzdExpbmUgKyBIZWFkaW5nICsgZm9vdG5vdGVEZXRhaWwpO1xyXG4gICAgICAgIG5ld0N1cnNvclBvcyA9IHsgbGluZTogZG9jLmxhc3RMaW5lKCkgLSAxLCBjaDogZm9vdG5vdGVEZXRhaWwubGVuZ3RoIC0gMSB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIGZvb3Rub3RlRGV0YWlsKTtcclxuICAgICAgICBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGRvYy5sYXN0TGluZSgpLCBjaDogZm9vdG5vdGVEZXRhaWwubGVuZ3RoIC0gMSB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW4pKSB7XHJcbiAgICAgICAgLy8gdHlwZSB0aGUgZGV0YWlsIGluIGEgcG9wdXAgaW5zdGVhZCBvZiBqdW1waW5nIHRvIHRoZSBib3R0b21cclxuICAgICAgICBkb2Muc2V0Q3Vyc29yKHsgbGluZTogY3Vyc29yUG9zaXRpb24ubGluZSwgY2g6IGN1cnNvclBvc2l0aW9uLmNoICsgZm9vdG5vdGVNYXJrZXIubGVuZ3RoIH0pO1xyXG4gICAgICAgIG9wZW5Gb290bm90ZVBvcHVwKHBsdWdpbiwgU3RyaW5nKGZvb3ROb3RlSWQpLCAoKSA9PlxyXG4gICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcywgcGx1Z2luKVxyXG4gICAgICAgICk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zLCBwbHVnaW4pXHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG4vL0ZVTkNUSU9OUyBGT1IgTkFNRUQgRk9PVE5PVEVTXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0TmFtZWRGb290bm90ZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKSB7XHJcbiAgICAvLyBwcmVzc2luZyB0aGUgaG90a2V5IHdoaWxlIHRoZSBwb3B1cCBlZGl0b3IgaXMgb3BlbiBjbG9zZXMgaXRcclxuICAgIGlmICh0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAoKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG1kVmlldyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHJcbiAgICBpZiAoIW1kVmlldykgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKG1kVmlldy5lZGl0b3IgPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmVkaXRvcjtcclxuICAgIGNvbnN0IGN1cnNvclBvc2l0aW9uID0gZG9jLmdldEN1cnNvcigpO1xyXG4gICAgY29uc3QgbGluZVRleHQgPSBkb2MuZ2V0TGluZShjdXJzb3JQb3NpdGlvbi5saW5lKTtcclxuICAgIGNvbnN0IG1hcmtkb3duVGV4dCA9IG1kVmlldy5kYXRhO1xyXG5cclxuICAgIGlmIChzaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIGlmIChzaG91bGRKdW1wRnJvbU1hcmtlclRvRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxyXG4gICAgICAgIHJldHVybjtcclxuXHJcbiAgICBpZiAoc2hvdWxkQ3JlYXRlTWF0Y2hpbmdGb290bm90ZURldGFpbChsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIHBsdWdpbiwgZG9jKSlcclxuICAgICAgICByZXR1cm47IFxyXG4gICAgcmV0dXJuIHNob3VsZENyZWF0ZUZvb3Rub3RlTWFya2VyKFxyXG4gICAgICAgIGxpbmVUZXh0LFxyXG4gICAgICAgIGN1cnNvclBvc2l0aW9uLFxyXG4gICAgICAgIGRvYyxcclxuICAgICAgICBtYXJrZG93blRleHQsXHJcbiAgICAgICAgcGx1Z2luXHJcbiAgICApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ3JlYXRlTWF0Y2hpbmdGb290bm90ZURldGFpbChcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4gICAgZG9jOiBFZGl0b3JcclxuKSB7XHJcbiAgICAvLyBDcmVhdGUgbWF0Y2hpbmcgZm9vdG5vdGUgZGV0YWlsIGZvciBmb290bm90ZSBtYXJrZXJcclxuICAgIFxyXG4gICAgLy8gZG9lcyB0aGlzIGxpbmUgaGF2ZSBhIGZvb3Rub3RlIG1hcmtlcj9cclxuICAgIC8vIGRvZXMgdGhlIGN1cnNvciBvdmVybGFwIHdpdGggb25lIG9mIHRoZW0/XHJcbiAgICAvLyBpZiBzbywgd2hpY2ggb25lP1xyXG4gICAgLy8gZG9lcyB0aGlzIGZvb3Rub3RlIG1hcmtlciBoYXZlIGEgZGV0YWlsIGxpbmU/XHJcbiAgICAvLyBpZiBub3QsIGNyZWF0ZSBpdCBhbmQgcGxhY2UgY3Vyc29yIHRoZXJlXHJcbiAgICBsZXQgcmVPbmx5TWFya2Vyc01hdGNoZXMgPSBsaW5lVGV4dC5tYXRjaChBbGxNYXJrZXJzKTtcclxuXHJcbiAgICBsZXQgbWFya2VyVGFyZ2V0ID0gbnVsbDtcclxuXHJcbiAgICBpZiAocmVPbmx5TWFya2Vyc01hdGNoZXMpe1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IHJlT25seU1hcmtlcnNNYXRjaGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBtYXJrZXIgPSByZU9ubHlNYXJrZXJzTWF0Y2hlc1tpXTtcclxuICAgICAgICAgICAgaWYgKG1hcmtlciAhPSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGxldCBpbmRleE9mTWFya2VySW5MaW5lID0gbGluZVRleHQuaW5kZXhPZihtYXJrZXIpO1xyXG4gICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoID49IGluZGV4T2ZNYXJrZXJJbkxpbmUgJiZcclxuICAgICAgICAgICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA8PSBpbmRleE9mTWFya2VySW5MaW5lICsgbWFya2VyLmxlbmd0aFxyXG4gICAgICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWFya2VyVGFyZ2V0ID0gbWFya2VyO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChtYXJrZXJUYXJnZXQgIT0gbnVsbCkge1xyXG4gICAgICAgIC8vZXh0cmFjdCBmb290bm90ZVxyXG4gICAgICAgIGxldCBtYXRjaCA9IG1hcmtlclRhcmdldC5tYXRjaChFeHRyYWN0TmFtZUZyb21Gb290bm90ZSlcclxuICAgICAgICAvL2ZpbmQgaWYgdGhpcyBmb290bm90ZSBleGlzdHMgYnkgbGlzdGluZyBleGlzdGluZyBmb290bm90ZSBkZXRhaWxzXHJcbiAgICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgICAgIGxldCBmb290bm90ZUlkID0gbWF0Y2hbMl07XHJcblxyXG4gICAgICAgICAgICBsZXQgbGlzdDogc3RyaW5nW10gPSBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoZG9jKTtcclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBsaXN0IGRvZXNuJ3QgaW5jbHVkZSBjdXJyZW50IGZvb3Rub3RlXHJcbiAgICAgICAgICAgIC8vIGlmIHNvLCBhZGQgZGV0YWlsIGZvciB0aGUgY3VycmVudCBmb290bm90ZVxyXG4gICAgICAgICAgICBpZighbGlzdC5pbmNsdWRlcyhmb290bm90ZUlkKSkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGxhc3RMaW5lSW5kZXggPSBkb2MubGFzdExpbmUoKTtcclxuICAgICAgICAgICAgICAgIGxldCBsYXN0TGluZSA9IGRvYy5nZXRMaW5lKGxhc3RMaW5lSW5kZXgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZW5hYmxlUmVtb3ZlQmxhbmtMYXN0TGluZXMgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAobGFzdExpbmVJbmRleCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RMaW5lLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvYy5yZXBsYWNlUmFuZ2UoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxpbmU6IGxhc3RMaW5lSW5kZXgsIGNoOiAwIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsaW5lOiBkb2MubGFzdExpbmUoKSwgY2g6IDAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RMaW5lSW5kZXgtLTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGxldCBmb290bm90ZURldGFpbCA9IGBcXG5bXiR7Zm9vdG5vdGVJZH1dOiBgO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBuZXdDdXJzb3JQb3M6IEVkaXRvclBvc2l0aW9uO1xyXG4gICAgICAgICAgICAgICAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9vdG5vdGVEZXRhaWwgPSBcIlxcblwiICsgZm9vdG5vdGVEZXRhaWw7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IEhlYWRpbmcgPSBhZGRGb290bm90ZVNlY3Rpb25IZWFkZXIocGx1Z2luKTtcclxuICAgICAgICAgICAgICAgICAgICBkb2Muc2V0TGluZShkb2MubGFzdExpbmUoKSwgbGFzdExpbmUgKyBIZWFkaW5nICsgZm9vdG5vdGVEZXRhaWwpO1xyXG4gICAgICAgICAgICAgICAgICAgIG5ld0N1cnNvclBvcyA9IHsgbGluZTogZG9jLmxhc3RMaW5lKCkgLSAxLCBjaDogZm9vdG5vdGVEZXRhaWwubGVuZ3RoIC0gMSB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIGZvb3Rub3RlRGV0YWlsKTtcclxuICAgICAgICAgICAgICAgICAgICBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGRvYy5sYXN0TGluZSgpLCBjaDogZm9vdG5vdGVEZXRhaWwubGVuZ3RoIC0gMSB9XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW4pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gdHlwZSB0aGUgZGV0YWlsIGluIGEgcG9wdXAgaW5zdGVhZCBvZiBqdW1waW5nIHRvIHRoZSBib3R0b21cclxuICAgICAgICAgICAgICAgICAgICBvcGVuRm9vdG5vdGVQb3B1cChwbHVnaW4sIGZvb3Rub3RlSWQsICgpID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zLCBwbHVnaW4pXHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MsIHBsdWdpbilcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47IFxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZUZvb3Rub3RlTWFya2VyKFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgbWFya2Rvd25UZXh0OiBzdHJpbmcsXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXHJcbikge1xyXG4gICAgY3Vyc29yUG9zaXRpb24gPSBhZGp1c3RGb290bm90ZVBvc2l0aW9uKGN1cnNvclBvc2l0aW9uLCBkb2MsIGxpbmVUZXh0LCBwbHVnaW4pO1xyXG5cclxuICAgIC8vY3JlYXRlIGVtcHR5IGZvb3Rub3RlIG1hcmtlciBmb3IgbmFtZSBpbnB1dFxyXG4gICAgbGV0IGVtcHR5TWFya2VyID0gYFteXWA7XHJcbiAgICBkb2MucmVwbGFjZVJhbmdlKGVtcHR5TWFya2VyLGN1cnNvclBvc2l0aW9uKTtcclxuICAgIC8vbW92ZSBjdXJzb3IgaW4gYmV0d2VlbiBbXiBhbmQgXVxyXG4gICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogY3Vyc29yUG9zaXRpb24uY2ggKyAyIH1cclxuICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zLCBwbHVnaW4pXHJcbiAgICAvL29wZW4gZm9vdG5vdGVQaWNrZXIgcG9wdXBcclxuICAgIFxyXG59XHJcbiIsImltcG9ydCB7XHJcbiAgYWRkSWNvbixcclxuICBNYXJrZG93blZpZXcsXHJcbiAgUGx1Z2luXHJcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5pbXBvcnQgeyBGb290bm90ZVBsdWdpblNldHRpbmdUYWIsIEZvb3Rub3RlUGx1Z2luU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xyXG5pbXBvcnQgeyBkaXNtaXNzRm9vdG5vdGVQb3B1cCB9IGZyb20gXCIuL2Zvb3Rub3RlLXBvcHVwXCI7XHJcbmltcG9ydCB7IGluc2VydEF1dG9udW1Gb290bm90ZSxpbnNlcnROYW1lZEZvb3Rub3RlIH0gZnJvbSBcIi4vaW5zZXJ0LW9yLW5hdmlnYXRlLWZvb3Rub3Rlc1wiO1xyXG5cclxuLy9BZGQgY2hldnJvbi11cC1zcXVhcmUgaWNvbiBmcm9tIGx1Y2lkZSBmb3IgbW9iaWxlIHRvb2xiYXIgKHRlbXBvcmFyeSB1bnRpbCBPYnNpZGlhbiB1cGRhdGVzIHRvIEx1Y2lkZSB2MC4xMzAuMClcclxuYWRkSWNvbihcImNoZXZyb24tdXAtc3F1YXJlXCIsIGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgY2xhc3M9XCJsdWNpZGUgbHVjaWRlLWNoZXZyb24tdXAtc3F1YXJlXCI+PHJlY3Qgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgeD1cIjNcIiB5PVwiM1wiIHJ4PVwiMlwiIHJ5PVwiMlwiPjwvcmVjdD48cG9seWxpbmUgcG9pbnRzPVwiOCwxNCAxMiwxMCAxNiwxNFwiPjwvcG9seWxpbmU+PC9zdmc+YCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBGb290bm90ZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcbiAgcHVibGljIHNldHRpbmdzITogRm9vdG5vdGVQbHVnaW5TZXR0aW5ncztcclxuXHJcbiAgYXN5bmMgb25sb2FkKCkge1xyXG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJpbnNlcnQtYXV0b251bWJlcmVkLWZvb3Rub3RlXCIsXHJcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IC8gTmF2aWdhdGUgQXV0by1OdW1iZXJlZCBGb290bm90ZVwiLFxyXG4gICAgICBpY29uOiBcInBsdXMtc3F1YXJlXCIsXHJcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgIGlmIChjaGVja2luZylcclxuICAgICAgICAgIHJldHVybiAhIXRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICAgICAgaW5zZXJ0QXV0b251bUZvb3Rub3RlKHRoaXMpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJpbnNlcnQtbmFtZWQtZm9vdG5vdGVcIixcclxuICAgICAgbmFtZTogXCJJbnNlcnQgLyBOYXZpZ2F0ZSBOYW1lZCBGb290bm90ZVwiLFxyXG4gICAgICBpY29uOiBcImNoZXZyb24tdXAtc3F1YXJlXCIsXHJcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgIGlmIChjaGVja2luZylcclxuICAgICAgICAgIHJldHVybiAhIXRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICAgICAgaW5zZXJ0TmFtZWRGb290bm90ZSh0aGlzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgXHJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cclxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcclxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsICgpID0+IGRpc21pc3NGb290bm90ZVBvcHVwKCkpXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgb251bmxvYWQoKSB7XHJcbiAgICBkaXNtaXNzRm9vdG5vdGVQb3B1cCgpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xyXG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XHJcblxyXG4gICAgLy8gbWlncmF0ZSBwcmUtMS4wLjQgc2VjdGlvbiBoZWFkaW5nIHZhbHVlczogdGhlIG9sZCB0ZXh0IGlucHV0IGltcGxpZWRcclxuICAgIC8vIGFuIEgxLCB0aGUgdGV4dGFyZWEgdGFrZXMgbGl0ZXJhbCBtYXJrZG93biwgc28gY29udmVydCBvbmNlIGFuZCBzYXZlXHJcbiAgICBjb25zdCBoZWFkaW5nID0gdGhpcy5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nO1xyXG4gICAgaWYgKGhlYWRpbmcgJiYgIS9eKCN7MSw2fSB8LS0tfFxcKlxcKlxcKnxfX18pLy50ZXN0KGhlYWRpbmcpKSB7XHJcbiAgICAgIHRoaXMuc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZyA9IGAjICR7aGVhZGluZ31gO1xyXG4gICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGRyb3AgdGhlIHNldHRpbmcgZm9yIHRoZSByZW1vdmVkIGF1dG9zdWdnZXN0IGZlYXR1cmUgKE9ic2lkaWFuIG5vd1xyXG4gICAgLy8gc3VnZ2VzdHMgZm9vdG5vdGVzIG5hdGl2ZWx5KVxyXG4gICAgaWYgKFwiZW5hYmxlQXV0b1N1Z2dlc3RcIiBpbiB0aGlzLnNldHRpbmdzKSB7XHJcbiAgICAgIGRlbGV0ZSAodGhpcy5zZXR0aW5ncyBhcyBhbnkpLmVuYWJsZUF1dG9TdWdnZXN0O1xyXG4gICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xyXG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICB9XHJcbn0iXSwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJNYXJrZG93blZpZXciLCJhZGRJY29uIiwiUGx1Z2luIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQW9HQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FB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
