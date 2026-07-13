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
            .setDesc("Open the footnote detail in a small editor where you're typing, instead of jumping to the bottom of the note. Close with the footnote hotkey, the escape key, or by clicking outside.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enablePopupEditor)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enablePopupEditor = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Footnotes section")
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
            .setDesc("Heading to place above the footnotes section. Accepts standard Markdown, including multiple lines and dividers.")
            .addTextArea((text) => text
            .setPlaceholder("Ex: '# Footnotes'")
            .setValue(this.plugin.settings.FootnoteSectionHeading)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.FootnoteSectionHeading = value;
            yield this.plugin.saveSettings();
        }))
            .then((text) => {
            text.inputEl.addClass("footnote-shortcut-section-heading-input");
            text.inputEl.rows = 6;
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
        var _a, _b;
        dismissFootnotePopup();
        const mdView = plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (!mdView || !mdView.file)
            return;
        // callers gate on popupEditingAvailable, but re-check so a registry
        // shape change degrades to the legacy jump instead of throwing
        const createEmbed = (_b = (_a = plugin.app.embedRegistry) === null || _a === void 0 ? void 0 : _a.embedByExtension) === null || _b === void 0 ? void 0 : _b.md;
        if (!createEmbed) {
            onUnavailable === null || onUnavailable === void 0 ? void 0 : onUnavailable();
            return;
        }
        // capture: the null-check above doesn't narrow property access inside
        // the buildEmbed closure
        const file = mdView.file;
        // a just-inserted detail is only indexed once the file saves — but
        // mdView.data lags a tick behind editor API changes, so saving too early
        // would write pre-insertion content to disk; wait for the buffer to
        // catch up first. Finishing the save (and its fold-state event) before
        // the embed exists also keeps it from reaching a half-initialized embed.
        const editor = mdView.editor;
        const doc = mdView.containerEl.ownerDocument;
        const win = doc.defaultView || window;
        const detailToken = `[^${footnoteId}]:`;
        const dataDeadline = Date.now() + 2000;
        while (!mdView.data.includes(detailToken) && Date.now() < dataDeadline) {
            yield new Promise((resolve) => win.setTimeout(resolve, 50));
        }
        yield mdView.save();
        // anchor just below the cursor, flipping above it near the window bottom.
        // When focus is in a sub-editor (a table cell being edited), the main
        // editor's coordsAtPos only knows the table widget's edge — which pins
        // the popup to the screen border — while the sub-editor's DOM selection
        // tracks the real caret. With the main editor focused, coordsAtPos is
        // the reliable one (the DOM selection can lag the editor API).
        const cm = editor.cm;
        let coords = null;
        // focus rests ON the contentDOM element itself; a table cell's
        // sub-editor has its own contentDOM nested inside the main one, so
        // this must be an identity check, not containment
        const mainEditorFocused = !!cm && doc.activeElement === cm.contentDOM;
        if (!mainEditorFocused) {
            const sel = win.getSelection();
            if (sel && sel.rangeCount > 0) {
                const rect = sel.getRangeAt(0).getBoundingClientRect();
                if (rect.height > 0)
                    coords = rect;
            }
        }
        if (!coords && cm)
            coords = cm.coordsAtPos(cm.state.selection.main.head);
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
        containerEl.addClass("footnote-shortcut-popup-loading");
        // name the footnote being edited so the user can tell markers apart
        containerEl.createDiv({
            cls: "footnote-shortcut-popup-label",
            text: `[^${footnoteId}]:`,
        });
        const embedEl = containerEl.createDiv("footnote-shortcut-popup-embed");
        const subpath = `#[^${footnoteId}]`;
        const buildEmbed = () => {
            const built = createEmbed({ app: plugin.app, linktext: subpath, sourcePath: file.path, containerEl: embedEl, depth: 0 }, file, subpath);
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
            containerEl.addClass("footnote-shortcut-popup-closed");
            if (focusEditor) {
                // editor.focus() can silently no-op right after the popup's
                // embed held focus (Obsidian's focus bookkeeping lags), so
                // focus the underlying CodeMirror view directly
                const cmView = editor.cm;
                if (cmView)
                    cmView.focus();
                else
                    editor.focus();
            }
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
            containerEl.removeClass("footnote-shortcut-popup-loading");
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
                embedEl.empty();
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

const AllMarkers = /\[\^([^[\]]+)\](?!:)/g;
const AllNumberedMarkers = /\[\^(\d+)\]/gi;
const AllDetailsNameOnly = /\[\^([^[\]]+)\]:/g;
const DetailInLine = /\[\^([^[\]]+)\]:/;
const ExtractNameFromFootnote = /(\[\^)([^[\]]+)(?=\])/;
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
function moveCursorAndSetJumpPoint(doc, oldCursorPos, newCursorPos, plugin, changes) {
    var _a, _b, _c, _d;
    // when focus sits in a sub-editor (a table cell being edited — its
    // contentDOM is nested inside the main editor's), return it to the main
    // editor BEFORE moving the cursor: a jump out of the table would
    // otherwise leave keystrokes going to the abandoned cell editor, while
    // a jump into a table re-activates cell editing on its own
    const cmView = doc.cm;
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
    }
    else {
        doc.setCursor(newCursorPos);
    }
    // if user has vim mode enabled, set jump point
    // getConfig is private API, like the vim internals below
    if ((_b = (_a = plugin.app.vault).getConfig) === null || _b === void 0 ? void 0 : _b.call(_a, "vimMode")) {
        (_c = activeWindow.CodeMirrorAdapter) === null || _c === void 0 ? void 0 : _c.Vim.getVimGlobalState_().jumpList.add((_d = doc.cm) === null || _d === void 0 ? void 0 : _d.cm, // SIC two levels deep
        oldCursorPos, newCursorPos);
    }
}
function shouldJumpFromDetailToMarker(lineText, cursorPosition, doc, plugin) {
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
                void openFootnotePopup(plugin, footnoteName, () => jumpToFootnoteDetail(footnoteName, cursorPosition, doc, plugin));
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
// Build (don't apply) the edit that appends `[^id]: ` after the last
// non-blank line — trimming trailing blank lines if enabled, and adding a
// blank separator plus the optional section heading before the first
// footnote. Returned as data so the caller can bundle it with the marker
// insertion into a single transaction (see moveCursorAndSetJumpPoint).
function buildDetailAppend(doc, footnoteId, isFirstFootnote, plugin) {
    let text = `\n[^${footnoteId}]: `;
    if (isFirstFootnote) {
        text = addFootnoteSectionHeader(plugin) + "\n" + text;
    }
    let fromLine = doc.lastLine();
    let to;
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
    const list = listExistingFootnoteDetails(doc);
    const isFirstFootnote = list.length === 0 && currentMax == 1;
    const detail = buildDetailAppend(doc, String(footNoteId), isFirstFootnote, plugin);
    const changes = [
        { from: cursorPosition, text: footnoteMarker },
        detail.change,
    ];
    if (popupEditingAvailable(plugin)) {
        // type the detail in a popup instead of jumping to the bottom;
        // the cursor only moves past the new marker
        const afterMarker = { line: cursorPosition.line, ch: cursorPosition.ch + footnoteMarker.length };
        doc.transaction({ changes, selection: { from: afterMarker } });
        void openFootnotePopup(plugin, String(footNoteId), () => moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin));
    }
    else {
        moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, changes);
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
                const detail = buildDetailAppend(doc, footnoteId, list.length === 0, plugin);
                if (popupEditingAvailable(plugin)) {
                    // type the detail in a popup instead of jumping to the
                    // bottom; the cursor stays on the marker
                    doc.transaction({ changes: [detail.change] });
                    void openFootnotePopup(plugin, footnoteId, () => moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin));
                }
                else {
                    moveCursorAndSetJumpPoint(doc, cursorPosition, detail.cursor, plugin, [detail.change]);
                }
                return true;
            }
            return;
        }
    }
}
function shouldCreateFootnoteMarker(lineText, cursorPosition, doc, markdownText, plugin) {
    cursorPosition = adjustFootnotePosition(cursorPosition, doc, lineText, plugin);
    //create empty footnote marker for name input, cursor in between [^ and ]
    let emptyMarker = `[^]`;
    const newCursorPos = { line: cursorPosition.line, ch: cursorPosition.ch + 2 };
    moveCursorAndSetJumpPoint(doc, cursorPosition, newCursorPos, plugin, [
        { from: cursorPosition, text: emptyMarker },
    ]);
}

//Add chevron-up-square icon from lucide for mobile toolbar (temporary until Obsidian updates to Lucide v0.130.0)
obsidian.addIcon("chevron-up-square", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-square"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><polyline points="8,14 12,10 16,14"></polyline></svg>`);
class FootnotePlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.addCommand({
                id: "insert-autonumbered-footnote",
                name: "Insert / navigate auto-numbered footnote",
                icon: "plus-square",
                checkCallback: (checking) => {
                    if (checking)
                        return !!this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                    insertAutonumFootnote(this);
                },
            });
            this.addCommand({
                id: "insert-named-footnote",
                name: "Insert / navigate named footnote",
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
            this.settings = Object.assign({}, DEFAULT_SETTINGS, (yield this.loadData()));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9mb290bm90ZS1wb3B1cC50cyIsInNyYy9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlLCBTdXBwcmVzc2VkRXJyb3IsIFN5bWJvbCwgSXRlcmF0b3IgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXNEZWNvcmF0ZShjdG9yLCBkZXNjcmlwdG9ySW4sIGRlY29yYXRvcnMsIGNvbnRleHRJbiwgaW5pdGlhbGl6ZXJzLCBleHRyYUluaXRpYWxpemVycykge1xyXG4gICAgZnVuY3Rpb24gYWNjZXB0KGYpIHsgaWYgKGYgIT09IHZvaWQgMCAmJiB0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRnVuY3Rpb24gZXhwZWN0ZWRcIik7IHJldHVybiBmOyB9XHJcbiAgICB2YXIga2luZCA9IGNvbnRleHRJbi5raW5kLCBrZXkgPSBraW5kID09PSBcImdldHRlclwiID8gXCJnZXRcIiA6IGtpbmQgPT09IFwic2V0dGVyXCIgPyBcInNldFwiIDogXCJ2YWx1ZVwiO1xyXG4gICAgdmFyIHRhcmdldCA9ICFkZXNjcmlwdG9ySW4gJiYgY3RvciA/IGNvbnRleHRJbltcInN0YXRpY1wiXSA/IGN0b3IgOiBjdG9yLnByb3RvdHlwZSA6IG51bGw7XHJcbiAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JJbiB8fCAodGFyZ2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGNvbnRleHRJbi5uYW1lKSA6IHt9KTtcclxuICAgIHZhciBfLCBkb25lID0gZmFsc2U7XHJcbiAgICBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4pIGNvbnRleHRbcF0gPSBwID09PSBcImFjY2Vzc1wiID8ge30gOiBjb250ZXh0SW5bcF07XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4uYWNjZXNzKSBjb250ZXh0LmFjY2Vzc1twXSA9IGNvbnRleHRJbi5hY2Nlc3NbcF07XHJcbiAgICAgICAgY29udGV4dC5hZGRJbml0aWFsaXplciA9IGZ1bmN0aW9uIChmKSB7IGlmIChkb25lKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFkZCBpbml0aWFsaXplcnMgYWZ0ZXIgZGVjb3JhdGlvbiBoYXMgY29tcGxldGVkXCIpOyBleHRyYUluaXRpYWxpemVycy5wdXNoKGFjY2VwdChmIHx8IG51bGwpKTsgfTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gKDAsIGRlY29yYXRvcnNbaV0pKGtpbmQgPT09IFwiYWNjZXNzb3JcIiA/IHsgZ2V0OiBkZXNjcmlwdG9yLmdldCwgc2V0OiBkZXNjcmlwdG9yLnNldCB9IDogZGVzY3JpcHRvcltrZXldLCBjb250ZXh0KTtcclxuICAgICAgICBpZiAoa2luZCA9PT0gXCJhY2Nlc3NvclwiKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHZvaWQgMCkgY29udGludWU7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZFwiKTtcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmdldCkpIGRlc2NyaXB0b3IuZ2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LnNldCkpIGRlc2NyaXB0b3Iuc2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmluaXQpKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoXyA9IGFjY2VwdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIGlmIChraW5kID09PSBcImZpZWxkXCIpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgICAgICBlbHNlIGRlc2NyaXB0b3Jba2V5XSA9IF87XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRhcmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgY29udGV4dEluLm5hbWUsIGRlc2NyaXB0b3IpO1xyXG4gICAgZG9uZSA9IHRydWU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19ydW5Jbml0aWFsaXplcnModGhpc0FyZywgaW5pdGlhbGl6ZXJzLCB2YWx1ZSkge1xyXG4gICAgdmFyIHVzZVZhbHVlID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRpYWxpemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhbHVlID0gdXNlVmFsdWUgPyBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnLCB2YWx1ZSkgOiBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1c2VWYWx1ZSA/IHZhbHVlIDogdm9pZCAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcHJvcEtleSh4KSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwic3ltYm9sXCIgPyB4IDogXCJcIi5jb25jYXQoeCk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zZXRGdW5jdGlvbk5hbWUoZiwgbmFtZSwgcHJlZml4KSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3ltYm9sXCIpIG5hbWUgPSBuYW1lLmRlc2NyaXB0aW9uID8gXCJbXCIuY29uY2F0KG5hbWUuZGVzY3JpcHRpb24sIFwiXVwiKSA6IFwiXCI7XHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGYsIFwibmFtZVwiLCB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHByZWZpeCA/IFwiXCIuY29uY2F0KHByZWZpeCwgXCIgXCIsIG5hbWUpIDogbmFtZSB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGcgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEl0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpO1xyXG4gICAgcmV0dXJuIGcubmV4dCA9IHZlcmIoMCksIGdbXCJ0aHJvd1wiXSA9IHZlcmIoMSksIGdbXCJyZXR1cm5cIl0gPSB2ZXJiKDIpLCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBBc3luY0l0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBBc3luY0l0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpLCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIsIGF3YWl0UmV0dXJuKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gYXdhaXRSZXR1cm4oZikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGYsIHJlamVjdCk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpZiAoZ1tuXSkgeyBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyBpZiAoZikgaVtuXSA9IGYoaVtuXSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IGZhbHNlIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbnZhciBvd25LZXlzID0gZnVuY3Rpb24obykge1xyXG4gICAgb3duS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIHx8IGZ1bmN0aW9uIChvKSB7XHJcbiAgICAgICAgdmFyIGFyID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgayBpbiBvKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIGspKSBhclthci5sZW5ndGhdID0gaztcclxuICAgICAgICByZXR1cm4gYXI7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIG93bktleXMobyk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayA9IG93bktleXMobW9kKSwgaSA9IDA7IGkgPCBrLmxlbmd0aDsgaSsrKSBpZiAoa1tpXSAhPT0gXCJkZWZhdWx0XCIpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwga1tpXSk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4oc3RhdGUsIHJlY2VpdmVyKSB7XHJcbiAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwgfHwgKHR5cGVvZiByZWNlaXZlciAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcmVjZWl2ZXIgIT09IFwiZnVuY3Rpb25cIikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgdXNlICdpbicgb3BlcmF0b3Igb24gbm9uLW9iamVjdFwiKTtcclxuICAgIHJldHVybiB0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyID09PSBzdGF0ZSA6IHN0YXRlLmhhcyhyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZShlbnYsIHZhbHVlLCBhc3luYykge1xyXG4gICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkLlwiKTtcclxuICAgICAgICB2YXIgZGlzcG9zZSwgaW5uZXI7XHJcbiAgICAgICAgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmFzeW5jRGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0Rpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmFzeW5jRGlzcG9zZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkaXNwb3NlID09PSB2b2lkIDApIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuZGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5kaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5kaXNwb3NlXTtcclxuICAgICAgICAgICAgaWYgKGFzeW5jKSBpbm5lciA9IGRpc3Bvc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2YgZGlzcG9zZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IG5vdCBkaXNwb3NhYmxlLlwiKTtcclxuICAgICAgICBpZiAoaW5uZXIpIGRpc3Bvc2UgPSBmdW5jdGlvbigpIHsgdHJ5IHsgaW5uZXIuY2FsbCh0aGlzKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7IH0gfTtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IHZhbHVlOiB2YWx1ZSwgZGlzcG9zZTogZGlzcG9zZSwgYXN5bmM6IGFzeW5jIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoYXN5bmMpIHtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IGFzeW5jOiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG5cclxufVxyXG5cclxudmFyIF9TdXBwcmVzc2VkRXJyb3IgPSB0eXBlb2YgU3VwcHJlc3NlZEVycm9yID09PSBcImZ1bmN0aW9uXCIgPyBTdXBwcmVzc2VkRXJyb3IgOiBmdW5jdGlvbiAoZXJyb3IsIHN1cHByZXNzZWQsIG1lc3NhZ2UpIHtcclxuICAgIHZhciBlID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xyXG4gICAgcmV0dXJuIGUubmFtZSA9IFwiU3VwcHJlc3NlZEVycm9yXCIsIGUuZXJyb3IgPSBlcnJvciwgZS5zdXBwcmVzc2VkID0gc3VwcHJlc3NlZCwgZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2Rpc3Bvc2VSZXNvdXJjZXMoZW52KSB7XHJcbiAgICBmdW5jdGlvbiBmYWlsKGUpIHtcclxuICAgICAgICBlbnYuZXJyb3IgPSBlbnYuaGFzRXJyb3IgPyBuZXcgX1N1cHByZXNzZWRFcnJvcihlLCBlbnYuZXJyb3IsIFwiQW4gZXJyb3Igd2FzIHN1cHByZXNzZWQgZHVyaW5nIGRpc3Bvc2FsLlwiKSA6IGU7XHJcbiAgICAgICAgZW52Lmhhc0Vycm9yID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIHZhciByLCBzID0gMDtcclxuICAgIGZ1bmN0aW9uIG5leHQoKSB7XHJcbiAgICAgICAgd2hpbGUgKHIgPSBlbnYuc3RhY2sucG9wKCkpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmICghci5hc3luYyAmJiBzID09PSAxKSByZXR1cm4gcyA9IDAsIGVudi5zdGFjay5wdXNoKHIpLCBQcm9taXNlLnJlc29sdmUoKS50aGVuKG5leHQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHIuZGlzcG9zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSByLmRpc3Bvc2UuY2FsbChyLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoci5hc3luYykgcmV0dXJuIHMgfD0gMiwgUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCkudGhlbihuZXh0LCBmdW5jdGlvbihlKSB7IGZhaWwoZSk7IHJldHVybiBuZXh0KCk7IH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBzIHw9IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIGZhaWwoZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHMgPT09IDEpIHJldHVybiBlbnYuaGFzRXJyb3IgPyBQcm9taXNlLnJlamVjdChlbnYuZXJyb3IpIDogUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgaWYgKGVudi5oYXNFcnJvcikgdGhyb3cgZW52LmVycm9yO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5leHQoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uKHBhdGgsIHByZXNlcnZlSnN4KSB7XHJcbiAgICBpZiAodHlwZW9mIHBhdGggPT09IFwic3RyaW5nXCIgJiYgL15cXC5cXC4/XFwvLy50ZXN0KHBhdGgpKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhdGgucmVwbGFjZSgvXFwuKHRzeCkkfCgoPzpcXC5kKT8pKCg/OlxcLlteLi9dKz8pPylcXC4oW2NtXT8pdHMkL2ksIGZ1bmN0aW9uIChtLCB0c3gsIGQsIGV4dCwgY20pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRzeCA/IHByZXNlcnZlSnN4ID8gXCIuanN4XCIgOiBcIi5qc1wiIDogZCAmJiAoIWV4dCB8fCAhY20pID8gbSA6IChkICsgZXh0ICsgXCIuXCIgKyBjbS50b0xvd2VyQ2FzZSgpICsgXCJqc1wiKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiBwYXRoO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBfX2V4dGVuZHM6IF9fZXh0ZW5kcyxcclxuICAgIF9fYXNzaWduOiBfX2Fzc2lnbixcclxuICAgIF9fcmVzdDogX19yZXN0LFxyXG4gICAgX19kZWNvcmF0ZTogX19kZWNvcmF0ZSxcclxuICAgIF9fcGFyYW06IF9fcGFyYW0sXHJcbiAgICBfX2VzRGVjb3JhdGU6IF9fZXNEZWNvcmF0ZSxcclxuICAgIF9fcnVuSW5pdGlhbGl6ZXJzOiBfX3J1bkluaXRpYWxpemVycyxcclxuICAgIF9fcHJvcEtleTogX19wcm9wS2V5LFxyXG4gICAgX19zZXRGdW5jdGlvbk5hbWU6IF9fc2V0RnVuY3Rpb25OYW1lLFxyXG4gICAgX19tZXRhZGF0YTogX19tZXRhZGF0YSxcclxuICAgIF9fYXdhaXRlcjogX19hd2FpdGVyLFxyXG4gICAgX19nZW5lcmF0b3I6IF9fZ2VuZXJhdG9yLFxyXG4gICAgX19jcmVhdGVCaW5kaW5nOiBfX2NyZWF0ZUJpbmRpbmcsXHJcbiAgICBfX2V4cG9ydFN0YXI6IF9fZXhwb3J0U3RhcixcclxuICAgIF9fdmFsdWVzOiBfX3ZhbHVlcyxcclxuICAgIF9fcmVhZDogX19yZWFkLFxyXG4gICAgX19zcHJlYWQ6IF9fc3ByZWFkLFxyXG4gICAgX19zcHJlYWRBcnJheXM6IF9fc3ByZWFkQXJyYXlzLFxyXG4gICAgX19zcHJlYWRBcnJheTogX19zcHJlYWRBcnJheSxcclxuICAgIF9fYXdhaXQ6IF9fYXdhaXQsXHJcbiAgICBfX2FzeW5jR2VuZXJhdG9yOiBfX2FzeW5jR2VuZXJhdG9yLFxyXG4gICAgX19hc3luY0RlbGVnYXRvcjogX19hc3luY0RlbGVnYXRvcixcclxuICAgIF9fYXN5bmNWYWx1ZXM6IF9fYXN5bmNWYWx1ZXMsXHJcbiAgICBfX21ha2VUZW1wbGF0ZU9iamVjdDogX19tYWtlVGVtcGxhdGVPYmplY3QsXHJcbiAgICBfX2ltcG9ydFN0YXI6IF9faW1wb3J0U3RhcixcclxuICAgIF9faW1wb3J0RGVmYXVsdDogX19pbXBvcnREZWZhdWx0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldDogX19jbGFzc1ByaXZhdGVGaWVsZEdldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRTZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkSW46IF9fY2xhc3NQcml2YXRlRmllbGRJbixcclxuICAgIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlOiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZSxcclxuICAgIF9fZGlzcG9zZVJlc291cmNlczogX19kaXNwb3NlUmVzb3VyY2VzLFxyXG4gICAgX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb246IF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uLFxyXG59O1xyXG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIFNldHRpbmdEZWZpbml0aW9uSXRlbSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBGb290bm90ZVBsdWdpblNldHRpbmdzIHtcclxuICAgIGluc2VydEF0RW5kT2ZXb3JkOiBib29sZWFuO1xyXG4gICAgZW5hYmxlUG9wdXBFZGl0b3I6IGJvb2xlYW47XHJcblxyXG4gICAgZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogYm9vbGVhbjtcclxuICAgIEZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IHN0cmluZztcclxuXHJcbiAgICBlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lczogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEZvb3Rub3RlUGx1Z2luU2V0dGluZ3MgPSB7XHJcbiAgICBpbnNlcnRBdEVuZE9mV29yZDogdHJ1ZSxcclxuICAgIGVuYWJsZVBvcHVwRWRpdG9yOiB0cnVlLFxyXG5cclxuICAgIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IGZhbHNlLFxyXG4gICAgRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogXCIjIEZvb3Rub3Rlc1wiLFxyXG5cclxuICAgIGVuYWJsZVJlbW92ZUJsYW5rTGFzdExpbmVzOiB0cnVlLFxyXG59O1xyXG5cclxuZXhwb3J0IGNsYXNzIEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xyXG4gICAgICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBPYnNpZGlhbiAxLjEzLjArIHJlbmRlcnMgdGhlIHRhYiBmcm9tIHRoZXNlIGRlZmluaXRpb25zIGFuZCBza2lwc1xyXG4gICAgLy8gZGlzcGxheSgpOyBjb250cm9scyBiaW5kIHRvIHRoaXMucGx1Z2luLnNldHRpbmdzW2tleV0gYW5kIGF1dG8tc2F2ZVxyXG4gICAgZ2V0U2V0dGluZ0RlZmluaXRpb25zKCk6IFNldHRpbmdEZWZpbml0aW9uSXRlbVtdIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiLFxyXG4gICAgICAgICAgICAgICAgZGVzYzogXCJBIG5ldyBmb290bm90ZSBpcyBvbmx5IGluc2VydGVkIGF0IHRoZSBlbmQgb2YgdGhlIHdvcmQgYW5kIGFmdGVyIGFueSBwdW5jdHVhdGlvbi5cIixcclxuICAgICAgICAgICAgICAgIGNvbnRyb2w6IHsgdHlwZTogXCJ0b2dnbGVcIiwga2V5OiBcImluc2VydEF0RW5kT2ZXb3JkXCIgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJFZGl0IGZvb3Rub3RlcyBpbiBhIHBvcHVwXCIsXHJcbiAgICAgICAgICAgICAgICBkZXNjOiBcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCBFc2NhcGUsIG9yIGJ5IGNsaWNraW5nIG91dHNpZGUuXCIsXHJcbiAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVQb3B1cEVkaXRvclwiIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiZ3JvdXBcIixcclxuICAgICAgICAgICAgICAgIGhlYWRpbmc6IFwiRm9vdG5vdGVzIFNlY3Rpb25cIixcclxuICAgICAgICAgICAgICAgIGl0ZW1zOiBbXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIlRyaW0gYmxhbmsgbGluZXNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzYzogXCJSZW1vdmUgYmxhbmsgbGluZXMgZnJvbSB0aGUgZW5kIG9mIHRoZSBub3RlIHdoZW4gaW5zZXJ0aW5nIGEgbmV3IGZvb3Rub3RlcyBzZWN0aW9uLlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lc1wiIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiRW5hYmxlIHNlY3Rpb24gaGVhZGluZ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjOiBcIkF1dG9tYXRpY2FsbHkgYWRkcyBhIGhlYWRpbmcgc2VwYXJhdGluZyBmb290bm90ZXMgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbm90ZSBmcm9tIHRoZSByZXN0IG9mIHRoZSB0ZXh0LlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nXCIgfSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJTZWN0aW9uIGhlYWRpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzYzogXCJIZWFkaW5nIHRvIHBsYWNlIGFib3ZlIHRoZSBmb290bm90ZXMgc2VjdGlvbi4gQWNjZXB0cyBzdGFuZGFyZCBtYXJrZG93biwgaW5jbHVkaW5nIG11bHRpcGxlIGxpbmVzIGFuZCBkaXZpZGVycy5cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udHJvbDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ0ZXh0YXJlYVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBcIkZvb3Rub3RlU2VjdGlvbkhlYWRpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3M6IDYsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcjogXCJFeDogJyMgRm9vdG5vdGVzJ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ6ICgpID0+ICF0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIF07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gT2JzaWRpYW4gPCAxLjEzLjAgZmFsbHMgYmFjayB0byB0aGlzIGltcGVyYXRpdmUgaW1wbGVtZW50YXRpb247XHJcbiAgICAvLyBrZWVwIGl0IGluIHN5bmMgd2l0aCBnZXRTZXR0aW5nRGVmaW5pdGlvbnMoKSBhYm92ZVxyXG4gICAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcclxuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiQSBuZXcgZm9vdG5vdGUgaXMgb25seSBpbnNlcnRlZCBhdCB0aGUgZW5kIG9mIHRoZSB3b3JkIGFuZCBhZnRlciBhbnkgcHVuY3R1YXRpb24uXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZClcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZCA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkVkaXQgZm9vdG5vdGVzIGluIGEgcG9wdXBcIilcclxuICAgICAgICAuc2V0RGVzYyhcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciB3aGVyZSB5b3UncmUgdHlwaW5nLCBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCB0aGUgZXNjYXBlIGtleSwgb3IgYnkgY2xpY2tpbmcgb3V0c2lkZS5cIilcclxuICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XHJcbiAgICAgICAgICAgIHRvZ2dsZVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVBvcHVwRWRpdG9yKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVBvcHVwRWRpdG9yID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKFwiRm9vdG5vdGVzIHNlY3Rpb25cIilcclxuICAgICAgICAuc2V0SGVhZGluZygpO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIlRyaW0gYmxhbmsgbGluZXNcIilcclxuICAgICAgICAuc2V0RGVzYyhcIlJlbW92ZSBibGFuayBsaW5lcyBmcm9tIHRoZSBlbmQgb2YgdGhlIG5vdGUgd2hlbiBpbnNlcnRpbmcgYSBuZXcgZm9vdG5vdGUgc2VjdGlvbi5cIilcclxuICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XHJcbiAgICAgICAgICAgIHRvZ2dsZVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVJlbW92ZUJsYW5rTGFzdExpbmVzKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVJlbW92ZUJsYW5rTGFzdExpbmVzID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKFwiRW5hYmxlIHNlY3Rpb24gaGVhZGluZ1wiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiQXV0b21hdGljYWxseSBhZGRzIGEgaGVhZGluZyBzZXBhcmF0aW5nIGZvb3Rub3RlcyBhdCB0aGUgYm90dG9tIG9mIHRoZSBub3RlIGZyb20gdGhlIHJlc3Qgb2YgdGhlIHRleHQuXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmcgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJTZWN0aW9uIGhlYWRpbmdcIilcclxuICAgICAgICAuc2V0RGVzYyhcIkhlYWRpbmcgdG8gcGxhY2UgYWJvdmUgdGhlIGZvb3Rub3RlcyBzZWN0aW9uLiBBY2NlcHRzIHN0YW5kYXJkIE1hcmtkb3duLCBpbmNsdWRpbmcgbXVsdGlwbGUgbGluZXMgYW5kIGRpdmlkZXJzLlwiKVxyXG4gICAgICAgIC5hZGRUZXh0QXJlYSgodGV4dCkgPT5cclxuICAgICAgICAgICAgdGV4dFxyXG4gICAgICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiRXg6ICcjIEZvb3Rub3RlcydcIilcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmcgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAudGhlbigodGV4dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHQuaW5wdXRFbC5hZGRDbGFzcyhcImZvb3Rub3RlLXNob3J0Y3V0LXNlY3Rpb24taGVhZGluZy1pbnB1dFwiKTtcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwucm93cyA9IDY7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgTWFya2Rvd25WaWV3IH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xyXG5pbXBvcnQgeyBBcHBXaXRoRW1iZWRSZWdpc3RyeSwgRWRpdG9yV2l0aENtIH0gZnJvbSBcIi4vb2JzaWRpYW4taW50ZXJuYWxzXCI7XHJcblxyXG4vLyBBIHNtYWxsIHBvcHVwIGFuY2hvcmVkIGF0IHRoZSBjdXJzb3IgY29udGFpbmluZyBPYnNpZGlhbidzIG93biBlZGl0YWJsZVxyXG4vLyBtYXJrZG93biBlbWJlZCwgYm91bmQgdG8ganVzdCB0aGUgZm9vdG5vdGUncyBkZXRhaWwgdmlhIHRoZSBgI1teaWRdYFxyXG4vLyBzdWJwYXRoICh0aGUgc2FtZSBtYWNoaW5lcnkgdGhlIGNvcmUgRm9vdG5vdGVzIHZpZXcgdXNlcykuIEVkaXRpbmcgaW4gdGhlXHJcbi8vIHBvcHVwIHNhdmVzIHN0cmFpZ2h0IGJhY2sgdG8gdGhlIGRldGFpbCBsaW5lIGF0IHRoZSBib3R0b20gb2YgdGhlIG5vdGUsXHJcbi8vIHNvIHRoZSB1c2VyJ3MgY3Vyc29yIG5ldmVyIGhhcyB0byBsZWF2ZSB0aGUgdGV4dC5cclxuXHJcbnR5cGUgQWN0aXZlUG9wdXAgPSB7XHJcbiAgICBjb250YWluZXJFbDogSFRNTEVsZW1lbnQ7XHJcbiAgICBjbG9zZTogKGZvY3VzRWRpdG9yOiBib29sZWFuKSA9PiB2b2lkO1xyXG59O1xyXG5cclxubGV0IGFjdGl2ZVBvcHVwOiBBY3RpdmVQb3B1cCB8IG51bGwgPSBudWxsO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKTogYm9vbGVhbiB7XHJcbiAgICAvLyBlbWJlZFJlZ2lzdHJ5IGlzIHVuZG9jdW1lbnRlZCBBUEksIHNvIGRlZ3JhZGUgdG8gdGhlIGxlZ2FjeVxyXG4gICAgLy8ganVtcC10by1ib3R0b20gYmVoYXZpb3IgaWYgaXQgZXZlciBjaGFuZ2VzIHNoYXBlXHJcbiAgICBjb25zdCByZWdpc3RyeSA9IChwbHVnaW4uYXBwIGFzIEFwcFdpdGhFbWJlZFJlZ2lzdHJ5KS5lbWJlZFJlZ2lzdHJ5O1xyXG4gICAgcmV0dXJuIHBsdWdpbi5zZXR0aW5ncy5lbmFibGVQb3B1cEVkaXRvciA9PT0gdHJ1ZVxyXG4gICAgICAgICYmIHR5cGVvZiByZWdpc3RyeT8uZW1iZWRCeUV4dGVuc2lvbj8ubWQgPT09IFwiZnVuY3Rpb25cIjtcclxufVxyXG5cclxuLy8gQ2xvc2UgZnJvbSB0aGUgZm9vdG5vdGUgaG90a2V5OyByZXR1cm5zIHdoZXRoZXIgYSBwb3B1cCB3YXMgb3Blbiwgc28gdGhlXHJcbi8vIGhvdGtleSBjYW4gdG9nZ2xlIHRoZSBwb3B1cCBpbnN0ZWFkIG9mIGluc2VydGluZyBhbm90aGVyIGZvb3Rub3RlLlxyXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlQ2xvc2VGb290bm90ZVBvcHVwKCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKGFjdGl2ZVBvcHVwKSB7XHJcbiAgICAgICAgYWN0aXZlUG9wdXAuY2xvc2UodHJ1ZSk7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbi8vIENsb3NlIHdpdGhvdXQgc3RlYWxpbmcgZm9jdXMgKGxlYWYgc3dpdGNoZWQsIHBsdWdpbiB1bmxvYWRpbmcpLlxyXG5leHBvcnQgZnVuY3Rpb24gZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKSB7XHJcbiAgICBpZiAoYWN0aXZlUG9wdXApIHtcclxuICAgICAgICBhY3RpdmVQb3B1cC5jbG9zZShmYWxzZSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuRm9vdG5vdGVQb3B1cChcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXHJcbiAgICBmb290bm90ZUlkOiBzdHJpbmcsXHJcbiAgICBvblVuYXZhaWxhYmxlPzogKCkgPT4gdm9pZCxcclxuKSB7XHJcbiAgICBkaXNtaXNzRm9vdG5vdGVQb3B1cCgpO1xyXG5cclxuICAgIGNvbnN0IG1kVmlldyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgIGlmICghbWRWaWV3IHx8ICFtZFZpZXcuZmlsZSkgcmV0dXJuO1xyXG5cclxuICAgIC8vIGNhbGxlcnMgZ2F0ZSBvbiBwb3B1cEVkaXRpbmdBdmFpbGFibGUsIGJ1dCByZS1jaGVjayBzbyBhIHJlZ2lzdHJ5XHJcbiAgICAvLyBzaGFwZSBjaGFuZ2UgZGVncmFkZXMgdG8gdGhlIGxlZ2FjeSBqdW1wIGluc3RlYWQgb2YgdGhyb3dpbmdcclxuICAgIGNvbnN0IGNyZWF0ZUVtYmVkID0gKHBsdWdpbi5hcHAgYXMgQXBwV2l0aEVtYmVkUmVnaXN0cnkpLmVtYmVkUmVnaXN0cnk/LmVtYmVkQnlFeHRlbnNpb24/Lm1kO1xyXG4gICAgaWYgKCFjcmVhdGVFbWJlZCkge1xyXG4gICAgICAgIG9uVW5hdmFpbGFibGU/LigpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8vIGNhcHR1cmU6IHRoZSBudWxsLWNoZWNrIGFib3ZlIGRvZXNuJ3QgbmFycm93IHByb3BlcnR5IGFjY2VzcyBpbnNpZGVcclxuICAgIC8vIHRoZSBidWlsZEVtYmVkIGNsb3N1cmVcclxuICAgIGNvbnN0IGZpbGUgPSBtZFZpZXcuZmlsZTtcclxuXHJcbiAgICAvLyBhIGp1c3QtaW5zZXJ0ZWQgZGV0YWlsIGlzIG9ubHkgaW5kZXhlZCBvbmNlIHRoZSBmaWxlIHNhdmVzIOKAlCBidXRcclxuICAgIC8vIG1kVmlldy5kYXRhIGxhZ3MgYSB0aWNrIGJlaGluZCBlZGl0b3IgQVBJIGNoYW5nZXMsIHNvIHNhdmluZyB0b28gZWFybHlcclxuICAgIC8vIHdvdWxkIHdyaXRlIHByZS1pbnNlcnRpb24gY29udGVudCB0byBkaXNrOyB3YWl0IGZvciB0aGUgYnVmZmVyIHRvXHJcbiAgICAvLyBjYXRjaCB1cCBmaXJzdC4gRmluaXNoaW5nIHRoZSBzYXZlIChhbmQgaXRzIGZvbGQtc3RhdGUgZXZlbnQpIGJlZm9yZVxyXG4gICAgLy8gdGhlIGVtYmVkIGV4aXN0cyBhbHNvIGtlZXBzIGl0IGZyb20gcmVhY2hpbmcgYSBoYWxmLWluaXRpYWxpemVkIGVtYmVkLlxyXG4gICAgY29uc3QgZWRpdG9yID0gbWRWaWV3LmVkaXRvcjtcclxuICAgIGNvbnN0IGRvYyA9IG1kVmlldy5jb250YWluZXJFbC5vd25lckRvY3VtZW50O1xyXG4gICAgY29uc3Qgd2luID0gZG9jLmRlZmF1bHRWaWV3IHx8IHdpbmRvdztcclxuXHJcbiAgICBjb25zdCBkZXRhaWxUb2tlbiA9IGBbXiR7Zm9vdG5vdGVJZH1dOmA7XHJcbiAgICBjb25zdCBkYXRhRGVhZGxpbmUgPSBEYXRlLm5vdygpICsgMjAwMDtcclxuICAgIHdoaWxlICghbWRWaWV3LmRhdGEuaW5jbHVkZXMoZGV0YWlsVG9rZW4pICYmIERhdGUubm93KCkgPCBkYXRhRGVhZGxpbmUpIHtcclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gd2luLnNldFRpbWVvdXQocmVzb2x2ZSwgNTApKTtcclxuICAgIH1cclxuICAgIGF3YWl0IG1kVmlldy5zYXZlKCk7XHJcblxyXG4gICAgLy8gYW5jaG9yIGp1c3QgYmVsb3cgdGhlIGN1cnNvciwgZmxpcHBpbmcgYWJvdmUgaXQgbmVhciB0aGUgd2luZG93IGJvdHRvbS5cclxuICAgIC8vIFdoZW4gZm9jdXMgaXMgaW4gYSBzdWItZWRpdG9yIChhIHRhYmxlIGNlbGwgYmVpbmcgZWRpdGVkKSwgdGhlIG1haW5cclxuICAgIC8vIGVkaXRvcidzIGNvb3Jkc0F0UG9zIG9ubHkga25vd3MgdGhlIHRhYmxlIHdpZGdldCdzIGVkZ2Ug4oCUIHdoaWNoIHBpbnNcclxuICAgIC8vIHRoZSBwb3B1cCB0byB0aGUgc2NyZWVuIGJvcmRlciDigJQgd2hpbGUgdGhlIHN1Yi1lZGl0b3IncyBET00gc2VsZWN0aW9uXHJcbiAgICAvLyB0cmFja3MgdGhlIHJlYWwgY2FyZXQuIFdpdGggdGhlIG1haW4gZWRpdG9yIGZvY3VzZWQsIGNvb3Jkc0F0UG9zIGlzXHJcbiAgICAvLyB0aGUgcmVsaWFibGUgb25lICh0aGUgRE9NIHNlbGVjdGlvbiBjYW4gbGFnIHRoZSBlZGl0b3IgQVBJKS5cclxuICAgIGNvbnN0IGNtID0gKGVkaXRvciBhcyBFZGl0b3JXaXRoQ20pLmNtO1xyXG4gICAgbGV0IGNvb3JkczogeyBsZWZ0OiBudW1iZXI7IHRvcDogbnVtYmVyOyBib3R0b206IG51bWJlciB9IHwgbnVsbCA9IG51bGw7XHJcbiAgICAvLyBmb2N1cyByZXN0cyBPTiB0aGUgY29udGVudERPTSBlbGVtZW50IGl0c2VsZjsgYSB0YWJsZSBjZWxsJ3NcclxuICAgIC8vIHN1Yi1lZGl0b3IgaGFzIGl0cyBvd24gY29udGVudERPTSBuZXN0ZWQgaW5zaWRlIHRoZSBtYWluIG9uZSwgc29cclxuICAgIC8vIHRoaXMgbXVzdCBiZSBhbiBpZGVudGl0eSBjaGVjaywgbm90IGNvbnRhaW5tZW50XHJcbiAgICBjb25zdCBtYWluRWRpdG9yRm9jdXNlZCA9ICEhY20gJiYgZG9jLmFjdGl2ZUVsZW1lbnQgPT09IGNtLmNvbnRlbnRET007XHJcbiAgICBpZiAoIW1haW5FZGl0b3JGb2N1c2VkKSB7XHJcbiAgICAgICAgY29uc3Qgc2VsID0gd2luLmdldFNlbGVjdGlvbigpO1xyXG4gICAgICAgIGlmIChzZWwgJiYgc2VsLnJhbmdlQ291bnQgPiAwKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlY3QgPSBzZWwuZ2V0UmFuZ2VBdCgwKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICAgICAgaWYgKHJlY3QuaGVpZ2h0ID4gMCkgY29vcmRzID0gcmVjdDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAoIWNvb3JkcyAmJiBjbSkgY29vcmRzID0gY20uY29vcmRzQXRQb3MoY20uc3RhdGUuc2VsZWN0aW9uLm1haW4uaGVhZCk7XHJcbiAgICBjb25zdCB3aWR0aCA9IE1hdGgubWluKDQ4MCwgd2luLmlubmVyV2lkdGggLSAzMik7XHJcbiAgICBjb25zdCBsZWZ0ID0gTWF0aC5tYXgoMTYsIE1hdGgubWluKGNvb3JkcyA/IGNvb3Jkcy5sZWZ0IDogMTAwLCB3aW4uaW5uZXJXaWR0aCAtIHdpZHRoIC0gMTYpKTtcclxuICAgIGxldCB0b3AgPSAoY29vcmRzID8gY29vcmRzLmJvdHRvbSA6IDEwMCkgKyA2O1xyXG4gICAgaWYgKHRvcCArIDI2MCA+IHdpbi5pbm5lckhlaWdodCkge1xyXG4gICAgICAgIHRvcCA9IE1hdGgubWF4KDE2LCAoY29vcmRzID8gY29vcmRzLnRvcCA6IDMwMCkgLSAyNjYpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnRhaW5lckVsID0gZG9jLmJvZHkuY3JlYXRlRGl2KFwiZm9vdG5vdGUtc2hvcnRjdXQtcG9wdXBcIik7XHJcbiAgICBjb250YWluZXJFbC5zdHlsZS5sZWZ0ID0gYCR7bGVmdH1weGA7XHJcbiAgICBjb250YWluZXJFbC5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xyXG4gICAgY29udGFpbmVyRWwuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XHJcbiAgICAvLyBzdGF5IGludmlzaWJsZSB1bnRpbCB0aGUgZm9vdG5vdGUgZGV0YWlsIGlzIGFjdHVhbGx5IGxvYWRlZFxyXG4gICAgY29udGFpbmVyRWwuYWRkQ2xhc3MoXCJmb290bm90ZS1zaG9ydGN1dC1wb3B1cC1sb2FkaW5nXCIpO1xyXG5cclxuICAgIC8vIG5hbWUgdGhlIGZvb3Rub3RlIGJlaW5nIGVkaXRlZCBzbyB0aGUgdXNlciBjYW4gdGVsbCBtYXJrZXJzIGFwYXJ0XHJcbiAgICBjb250YWluZXJFbC5jcmVhdGVEaXYoe1xyXG4gICAgICAgIGNsczogXCJmb290bm90ZS1zaG9ydGN1dC1wb3B1cC1sYWJlbFwiLFxyXG4gICAgICAgIHRleHQ6IGBbXiR7Zm9vdG5vdGVJZH1dOmAsXHJcbiAgICB9KTtcclxuICAgIGNvbnN0IGVtYmVkRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoXCJmb290bm90ZS1zaG9ydGN1dC1wb3B1cC1lbWJlZFwiKTtcclxuXHJcbiAgICBjb25zdCBzdWJwYXRoID0gYCNbXiR7Zm9vdG5vdGVJZH1dYDtcclxuICAgIGNvbnN0IGJ1aWxkRW1iZWQgPSAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgYnVpbHQgPSBjcmVhdGVFbWJlZChcclxuICAgICAgICAgICAgeyBhcHA6IHBsdWdpbi5hcHAsIGxpbmt0ZXh0OiBzdWJwYXRoLCBzb3VyY2VQYXRoOiBmaWxlLnBhdGgsIGNvbnRhaW5lckVsOiBlbWJlZEVsLCBkZXB0aDogMCB9LFxyXG4gICAgICAgICAgICBmaWxlLFxyXG4gICAgICAgICAgICBzdWJwYXRoLFxyXG4gICAgICAgICk7XHJcbiAgICAgICAgYnVpbHQuZWRpdGFibGUgPSB0cnVlO1xyXG4gICAgICAgIGJ1aWx0LmxvYWQoKTtcclxuICAgICAgICByZXR1cm4gYnVpbHQ7XHJcbiAgICB9O1xyXG4gICAgbGV0IGVtYmVkID0gYnVpbGRFbWJlZCgpO1xyXG5cclxuICAgIGxldCBjbG9zZWQgPSBmYWxzZTtcclxuICAgIGNvbnN0IGNsb3NlID0gKGZvY3VzRWRpdG9yOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgaWYgKGNsb3NlZCkgcmV0dXJuO1xyXG4gICAgICAgIGNsb3NlZCA9IHRydWU7XHJcbiAgICAgICAgYWN0aXZlUG9wdXAgPSBudWxsO1xyXG4gICAgICAgIGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIG9uRG9jTW91c2VEb3duLCB0cnVlKTtcclxuICAgICAgICBjb250YWluZXJFbC5hZGRDbGFzcyhcImZvb3Rub3RlLXNob3J0Y3V0LXBvcHVwLWNsb3NlZFwiKTtcclxuICAgICAgICBpZiAoZm9jdXNFZGl0b3IpIHtcclxuICAgICAgICAgICAgLy8gZWRpdG9yLmZvY3VzKCkgY2FuIHNpbGVudGx5IG5vLW9wIHJpZ2h0IGFmdGVyIHRoZSBwb3B1cCdzXHJcbiAgICAgICAgICAgIC8vIGVtYmVkIGhlbGQgZm9jdXMgKE9ic2lkaWFuJ3MgZm9jdXMgYm9va2tlZXBpbmcgbGFncyksIHNvXHJcbiAgICAgICAgICAgIC8vIGZvY3VzIHRoZSB1bmRlcmx5aW5nIENvZGVNaXJyb3IgdmlldyBkaXJlY3RseVxyXG4gICAgICAgICAgICBjb25zdCBjbVZpZXcgPSAoZWRpdG9yIGFzIEVkaXRvcldpdGhDbSkuY207XHJcbiAgICAgICAgICAgIGlmIChjbVZpZXcpIGNtVmlldy5mb2N1cygpO1xyXG4gICAgICAgICAgICBlbHNlIGVkaXRvci5mb2N1cygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gdGhlIGVtYmVkIHNhdmVzIGVkaXRzIG9uIGl0cyBvd24gZGVib3VuY2U7IGxldCB0aGF0IGN5Y2xlIGZpbmlzaFxyXG4gICAgICAgIC8vIGJlZm9yZSB1bmxvYWRpbmcsIHNpbmNlIHVubG9hZGluZyBtaWQtc2F2ZSBjbGVhcnMgdGhlIHN0YXRlIHRoZVxyXG4gICAgICAgIC8vIHNhdmUgcmVhZHNcclxuICAgICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xyXG4gICAgICAgIGNvbnN0IHRlYXJkb3duID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoKGVtYmVkLmRpcnR5IHx8IGVtYmVkLnNhdmluZyB8fCBlbWJlZC5zYXZlQWdhaW4pICYmIGF0dGVtcHRzKysgPCA1MCkge1xyXG4gICAgICAgICAgICAgICAgd2luLnNldFRpbWVvdXQodGVhcmRvd24sIDEwMCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZW1iZWQudW5sb2FkKCk7XHJcbiAgICAgICAgICAgIGNvbnRhaW5lckVsLnJlbW92ZSgpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgdGVhcmRvd24oKTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3Qgb25Eb2NNb3VzZURvd24gPSAoZXZ0OiBNb3VzZUV2ZW50KSA9PiB7XHJcbiAgICAgICAgaWYgKCFjb250YWluZXJFbC5jb250YWlucyhldnQudGFyZ2V0IGFzIE5vZGUpKSBjbG9zZShmYWxzZSk7XHJcbiAgICB9O1xyXG4gICAgZG9jLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgb25Eb2NNb3VzZURvd24sIHRydWUpO1xyXG5cclxuICAgIC8vIGJ1YmJsZSBwaGFzZSwgc28gdGhlIGVtYmVkZGVkIGVkaXRvciAoZS5nLiB2aW0gbW9kZSBsZWF2aW5nIGluc2VydFxyXG4gICAgLy8gbW9kZSkgZ2V0cyBmaXJzdCBjbGFpbSBvbiBFc2NhcGVcclxuICAgIGNvbnRhaW5lckVsLmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldnQ6IEtleWJvYXJkRXZlbnQpID0+IHtcclxuICAgICAgICBpZiAoZXZ0LmtleSA9PT0gXCJFc2NhcGVcIikge1xyXG4gICAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgY2xvc2UodHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgYWN0aXZlUG9wdXAgPSB7IGNvbnRhaW5lckVsLCBjbG9zZSB9O1xyXG5cclxuICAgIGNvbnN0IHRyeVNob3cgPSBhc3luYyAoKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XHJcbiAgICAgICAgYXdhaXQgZW1iZWQubG9hZEZpbGUoKTtcclxuICAgICAgICBpZiAoZW1iZWQuc3VicGF0aE5vdEZvdW5kKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29udGFpbmVyRWwucmVtb3ZlQ2xhc3MoXCJmb290bm90ZS1zaG9ydGN1dC1wb3B1cC1sb2FkaW5nXCIpO1xyXG4gICAgICAgIGVtYmVkLnNob3dFZGl0b3IoKTtcclxuICAgICAgICBlbWJlZC5lZGl0TW9kZT8uZWRpdG9yPy5mb2N1cygpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCB3YWl0Rm9yQ2FjaGVDaGFuZ2UgPSAoKSA9PlxyXG4gICAgICAgIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSB3aW4uc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBwbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUub2ZmcmVmKHJlZik7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0sIDUwMCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlZiA9IHBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5vbihcImNoYW5nZWRcIiwgKGZpbGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChmaWxlID09PSBtZFZpZXcuZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbi5jbGVhclRpbWVvdXQodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLm9mZnJlZihyZWYpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc2hvd0VkaXRvciA9IGFzeW5jICgpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcclxuICAgICAgICBpZiAoYXdhaXQgdHJ5U2hvdygpKSByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICAgICAgLy8gcmV0cnkgYXMgdGhlIG1ldGFkYXRhIGNhY2hlIGNhdGNoZXMgdXAgd2l0aCB0aGUgc2F2ZWQgZmlsZTsgYVxyXG4gICAgICAgIC8vIGxvYWRlZCBlbWJlZCB3b24ndCByZS1yZXNvbHZlIGl0cyBzdWJwYXRoLCBzbyByZWJ1aWxkIGVhY2ggdGltZVxyXG4gICAgICAgIGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIDMwMDA7XHJcbiAgICAgICAgd2hpbGUgKERhdGUubm93KCkgPCBkZWFkbGluZSkge1xyXG4gICAgICAgICAgICBhd2FpdCB3YWl0Rm9yQ2FjaGVDaGFuZ2UoKTtcclxuICAgICAgICAgICAgaWYgKGNsb3NlZCkgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIGVtYmVkLnVubG9hZCgpO1xyXG4gICAgICAgICAgICBlbWJlZEVsLmVtcHR5KCk7XHJcbiAgICAgICAgICAgIGVtYmVkID0gYnVpbGRFbWJlZCgpO1xyXG4gICAgICAgICAgICBpZiAoYXdhaXQgdHJ5U2hvdygpKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuXHJcbiAgICBzaG93RWRpdG9yKClcclxuICAgICAgICAudGhlbigoc2hvd24pID0+IHtcclxuICAgICAgICAgICAgaWYgKCFzaG93biAmJiAhY2xvc2VkKSB7XHJcbiAgICAgICAgICAgICAgICBjbG9zZShmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICBvblVuYXZhaWxhYmxlPy4oKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLmNhdGNoKCgpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFjbG9zZWQpIHtcclxuICAgICAgICAgICAgICAgIGNsb3NlKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIG9uVW5hdmFpbGFibGU/LigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbn1cclxuIiwiaW1wb3J0IHtcclxuXHRFZGl0b3IsXHJcblx0RWRpdG9yQ2hhbmdlLFxyXG5cdEVkaXRvclBvc2l0aW9uLFxyXG5cdE1hcmtkb3duVmlld1xyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuaW1wb3J0IEZvb3Rub3RlUGx1Z2luIGZyb20gXCIuL21haW5cIjtcclxuaW1wb3J0IHsgb3BlbkZvb3Rub3RlUG9wdXAsIHBvcHVwRWRpdGluZ0F2YWlsYWJsZSwgdG9nZ2xlQ2xvc2VGb290bm90ZVBvcHVwIH0gZnJvbSBcIi4vZm9vdG5vdGUtcG9wdXBcIjtcclxuaW1wb3J0IHsgRWRpdG9yV2l0aENtLCBWYXVsdFdpdGhDb25maWcsIFdpbmRvd1dpdGhWaW0gfSBmcm9tIFwiLi9vYnNpZGlhbi1pbnRlcm5hbHNcIjtcclxuXHJcbmV4cG9ydCBjb25zdCBBbGxNYXJrZXJzID0gL1xcW1xcXihbXltcXF1dKylcXF0oPyE6KS9nO1xyXG5jb25zdCBBbGxOdW1iZXJlZE1hcmtlcnMgPSAvXFxbXFxeKFxcZCspXFxdL2dpO1xyXG5jb25zdCBBbGxEZXRhaWxzTmFtZU9ubHkgPSAvXFxbXFxeKFteW1xcXV0rKVxcXTovZztcclxuY29uc3QgRGV0YWlsSW5MaW5lID0gL1xcW1xcXihbXltcXF1dKylcXF06LztcclxuZXhwb3J0IGNvbnN0IEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlID0gLyhcXFtcXF4pKFteW1xcXV0rKSg/PVxcXSkvO1xyXG5cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoXHJcbiAgICBkb2M6IEVkaXRvclxyXG4pIHtcclxuICAgIGxldCBGb290bm90ZURldGFpbExpc3Q6IHN0cmluZ1tdID0gW107XHJcbiAgICBcclxuICAgIC8vc2VhcmNoIGVhY2ggbGluZSBmb3IgZm9vdG5vdGUgZGV0YWlscyBhbmQgYWRkIHRvIGxpc3RcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xyXG4gICAgICAgIGxldCBsaW5lTWF0Y2ggPSB0aGVMaW5lLm1hdGNoKEFsbERldGFpbHNOYW1lT25seSk7XHJcbiAgICAgICAgaWYgKGxpbmVNYXRjaCkge1xyXG4gICAgICAgICAgICBsZXQgdGVtcCA9IGxpbmVNYXRjaFswXTtcclxuICAgICAgICAgICAgdGVtcCA9IHRlbXAucmVwbGFjZShcIlteXCIsXCJcIik7XHJcbiAgICAgICAgICAgIHRlbXAgPSB0ZW1wLnJlcGxhY2UoXCJdOlwiLFwiXCIpO1xyXG5cclxuICAgICAgICAgICAgRm9vdG5vdGVEZXRhaWxMaXN0LnB1c2godGVtcCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIEZvb3Rub3RlRGV0YWlsTGlzdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RFeGlzdGluZ0Zvb3Rub3RlTWFya2Vyc0FuZExvY2F0aW9ucyhcclxuICAgIGRvYzogRWRpdG9yXHJcbikge1xyXG4gICAgdHlwZSBtYXJrZXJFbnRyeSA9IHtcclxuICAgICAgICBmb290bm90ZTogc3RyaW5nO1xyXG4gICAgICAgIGxpbmVOdW06IG51bWJlcjtcclxuICAgICAgICBzdGFydEluZGV4OiBudW1iZXI7XHJcbiAgICB9XHJcbiAgICBsZXQgbWFya2VyRW50cnk7XHJcblxyXG4gICAgbGV0IEZvb3Rub3RlTWFya2VySW5mbyA9IFtdO1xyXG4gICAgLy9zZWFyY2ggZWFjaCBsaW5lIGZvciBmb290bm90ZSBtYXJrZXJzXHJcbiAgICAvL2ZvciBlYWNoLCBhZGQgdGhlaXIgbmFtZSwgbGluZSBudW1iZXIsIGFuZCBzdGFydCBpbmRleCB0byBGb290bm90ZU1hcmtlckluZm9cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xyXG4gICAgICAgIGxldCBsaW5lTWF0Y2g7XHJcblxyXG4gICAgICAgIHdoaWxlICgobGluZU1hdGNoID0gQWxsTWFya2Vycy5leGVjKHRoZUxpbmUpKSAhPSBudWxsKSB7XHJcbiAgICAgICAgbWFya2VyRW50cnkgPSB7XHJcbiAgICAgICAgICAgIGZvb3Rub3RlOiBsaW5lTWF0Y2hbMF0sXHJcbiAgICAgICAgICAgIGxpbmVOdW06IGksXHJcbiAgICAgICAgICAgIHN0YXJ0SW5kZXg6IGxpbmVNYXRjaC5pbmRleFxyXG4gICAgICAgIH1cclxuICAgICAgICBGb290bm90ZU1hcmtlckluZm8ucHVzaChtYXJrZXJFbnRyeSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIEZvb3Rub3RlTWFya2VySW5mbztcclxufVxyXG5cclxuZnVuY3Rpb24gbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgb2xkQ3Vyc29yUG9zOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIG5ld0N1cnNvclBvczogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4gICAgY2hhbmdlcz86IEVkaXRvckNoYW5nZVtdLFxyXG4pOiB2b2lkIHtcclxuICAgIC8vIHdoZW4gZm9jdXMgc2l0cyBpbiBhIHN1Yi1lZGl0b3IgKGEgdGFibGUgY2VsbCBiZWluZyBlZGl0ZWQg4oCUIGl0c1xyXG4gICAgLy8gY29udGVudERPTSBpcyBuZXN0ZWQgaW5zaWRlIHRoZSBtYWluIGVkaXRvcidzKSwgcmV0dXJuIGl0IHRvIHRoZSBtYWluXHJcbiAgICAvLyBlZGl0b3IgQkVGT1JFIG1vdmluZyB0aGUgY3Vyc29yOiBhIGp1bXAgb3V0IG9mIHRoZSB0YWJsZSB3b3VsZFxyXG4gICAgLy8gb3RoZXJ3aXNlIGxlYXZlIGtleXN0cm9rZXMgZ29pbmcgdG8gdGhlIGFiYW5kb25lZCBjZWxsIGVkaXRvciwgd2hpbGVcclxuICAgIC8vIGEganVtcCBpbnRvIGEgdGFibGUgcmUtYWN0aXZhdGVzIGNlbGwgZWRpdGluZyBvbiBpdHMgb3duXHJcbiAgICBjb25zdCBjbVZpZXcgPSAoZG9jIGFzIEVkaXRvcldpdGhDbSkuY207XHJcbiAgICBpZiAoY21WaWV3KSB7XHJcbiAgICAgICAgY29uc3QgYWN0aXZlID0gY21WaWV3LmNvbnRlbnRET00ub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50O1xyXG4gICAgICAgIGlmIChhY3RpdmUgIT09IGNtVmlldy5jb250ZW50RE9NICYmIGNtVmlldy5jb250ZW50RE9NLmNvbnRhaW5zKGFjdGl2ZSkpIHtcclxuICAgICAgICAgICAgY21WaWV3LmZvY3VzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChjaGFuZ2VzICYmIGNoYW5nZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIC8vIHRleHQgZWRpdHMgYW5kIHRoZSBjdXJzb3IgbW92ZSBtdXN0IGdvIG91dCBhcyBPTkUgdHJhbnNhY3Rpb246XHJcbiAgICAgICAgLy8gd2hpbGUgYSB0YWJsZSBjZWxsIGlzIGJlaW5nIGVkaXRlZCAoT2JzaWRpYW4gMS41KyB0YWJsZSBlZGl0b3IpLFxyXG4gICAgICAgIC8vIHNlcGFyYXRlIGRpc3BhdGNoZXMgaW4gdGhlIHNhbWUgdGljayByYWNlIHRoZSBjZWxsIGVkaXRvcidzXHJcbiAgICAgICAgLy8gc3luYy1iYWNrIGFuZCBjb3JydXB0IHRoZSBkb2N1bWVudCAoaXNzdWUgIzI4KS4gYHNlbGVjdGlvbmAgaGVyZVxyXG4gICAgICAgIC8vIGlzIHJlc29sdmVkIGFnYWluc3QgdGhlIHBvc3QtY2hhbmdlIGRvY3VtZW50LlxyXG4gICAgICAgIGRvYy50cmFuc2FjdGlvbih7IGNoYW5nZXMsIHNlbGVjdGlvbjogeyBmcm9tOiBuZXdDdXJzb3JQb3MgfSB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZG9jLnNldEN1cnNvcihuZXdDdXJzb3JQb3MpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGlmIHVzZXIgaGFzIHZpbSBtb2RlIGVuYWJsZWQsIHNldCBqdW1wIHBvaW50XHJcbiAgICAvLyBnZXRDb25maWcgaXMgcHJpdmF0ZSBBUEksIGxpa2UgdGhlIHZpbSBpbnRlcm5hbHMgYmVsb3dcclxuICAgIGlmICgocGx1Z2luLmFwcC52YXVsdCBhcyBWYXVsdFdpdGhDb25maWcpLmdldENvbmZpZz8uKFwidmltTW9kZVwiKSkge1xyXG4gICAgICAgIChhY3RpdmVXaW5kb3cgYXMgV2luZG93V2l0aFZpbSkuQ29kZU1pcnJvckFkYXB0ZXI/LlZpbS5nZXRWaW1HbG9iYWxTdGF0ZV8oKS5qdW1wTGlzdC5hZGQoXHJcbiAgICAgICAgICAgIChkb2MgYXMgRWRpdG9yV2l0aENtKS5jbT8uY20sIC8vIFNJQyB0d28gbGV2ZWxzIGRlZXBcclxuICAgICAgICAgICAgb2xkQ3Vyc29yUG9zLFxyXG4gICAgICAgICAgICBuZXdDdXJzb3JQb3MsXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXHJcbikge1xyXG4gICAgLy8gY2hlY2sgaWYgd2UncmUgaW4gYSBmb290bm90ZSBkZXRhaWwgbGluZSAoXCJbXjFdOiBmb290bm90ZVwiKVxyXG4gICAgLy8gaWYgc28sIGp1bXAgY3Vyc29yIGJhY2sgdG8gdGhlIGZvb3Rub3RlIGluIHRoZSB0ZXh0XHJcblxyXG4gICAgbGV0IG1hdGNoID0gbGluZVRleHQubWF0Y2goRGV0YWlsSW5MaW5lKTtcclxuICAgIGlmIChtYXRjaCkge1xyXG4gICAgICAgIGxldCBzID0gbWF0Y2hbMF07XHJcbiAgICAgICAgbGV0IGZvb3Rub3RlID0gcy5yZXBsYWNlKFwiOlwiLCBcIlwiKTtcclxuXHJcbiAgICAgICAgbGV0IHJldHVybkxpbmVJbmRleCA9IGN1cnNvclBvc2l0aW9uLmxpbmU7XHJcbiAgICAgICAgLy8gZmluZCB0aGUgRklSU1QgT0NDVVJFTkNFIHdoZXJlIHRoaXMgZm9vdG5vdGUgZXhpc3RzIGluIHRoZSB0ZXh0XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgc2NhbkxpbmUgPSBkb2MuZ2V0TGluZShpKTtcclxuICAgICAgICAgICAgaWYgKHNjYW5MaW5lLmNvbnRhaW5zKGZvb3Rub3RlKSkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGN1cnNvckxvY2F0aW9uSW5kZXggPSBzY2FuTGluZS5pbmRleE9mKGZvb3Rub3RlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybkxpbmVJbmRleCA9IGk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IHJldHVybkxpbmVJbmRleCwgY2g6IGN1cnNvckxvY2F0aW9uSW5kZXggKyBmb290bm90ZS5sZW5ndGggfTtcclxuICAgICAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zLCBwbHVnaW4pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBqdW1wVG9Gb290bm90ZURldGFpbChcclxuICAgIGZvb3Rub3RlTmFtZTogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXHJcbikge1xyXG4gICAgLy8gZmluZCB0aGUgZmlyc3QgbGluZSB3aXRoIHRoaXMgZGV0YWlsIG1hcmtlciBuYW1lIGluIGl0LlxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xyXG4gICAgICAgIGxldCB0aGVMaW5lID0gZG9jLmdldExpbmUoaSk7XHJcbiAgICAgICAgbGV0IGxpbmVNYXRjaCA9IHRoZUxpbmUubWF0Y2goRGV0YWlsSW5MaW5lKTtcclxuICAgICAgICBpZiAobGluZU1hdGNoKSB7XHJcbiAgICAgICAgICAgIC8vIGNvbXBhcmUgdG8gdGhlIGluZGV4XHJcbiAgICAgICAgICAgIGxldCBuYW1lTWF0Y2ggPSBsaW5lTWF0Y2hbMV07XHJcbiAgICAgICAgICAgIGlmIChuYW1lTWF0Y2ggPT0gZm9vdG5vdGVOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGksIGNoOiBsaW5lTWF0Y2hbMF0ubGVuZ3RoICsgMSB9O1xyXG4gICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBuZXdDdXJzb3JQb3MsIHBsdWdpbik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZEp1bXBGcm9tTWFya2VyVG9EZXRhaWwoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXHJcbikge1xyXG4gICAgLy8gSnVtcCBjdXJzb3IgVE8gZGV0YWlsIG1hcmtlclxyXG5cclxuICAgIC8vIGRvZXMgdGhpcyBsaW5lIGhhdmUgYSBmb290bm90ZSBtYXJrZXI/XHJcbiAgICAvLyBkb2VzIHRoZSBjdXJzb3Igb3ZlcmxhcCB3aXRoIG9uZSBvZiB0aGVtP1xyXG4gICAgLy8gaWYgc28sIHdoaWNoIG9uZT9cclxuICAgIC8vIGZpbmQgdGhpcyBmb290bm90ZSBtYXJrZXIncyBkZXRhaWwgbGluZVxyXG4gICAgLy8gcGxhY2UgY3Vyc29yIHRoZXJlXHJcbiAgICBsZXQgbWFya2VyVGFyZ2V0ID0gbnVsbDtcclxuXHJcbiAgICBsZXQgRm9vdG5vdGVNYXJrZXJJbmZvID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVNYXJrZXJzQW5kTG9jYXRpb25zKGRvYyk7XHJcbiAgICBsZXQgY3VycmVudExpbmUgPSBjdXJzb3JQb3NpdGlvbi5saW5lO1xyXG4gICAgbGV0IGZvb3Rub3Rlc09uTGluZSA9IEZvb3Rub3RlTWFya2VySW5mby5maWx0ZXIoKG1hcmtlckVudHJ5OiB7IGxpbmVOdW06IG51bWJlcjsgfSkgPT4gbWFya2VyRW50cnkubGluZU51bSA9PT0gY3VycmVudExpbmUpO1xyXG5cclxuICAgIGlmIChmb290bm90ZXNPbkxpbmUgIT0gbnVsbCkge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IGZvb3Rub3Rlc09uTGluZS5sZW5ndGgtMTsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChmb290bm90ZXNPbkxpbmVbaV0uZm9vdG5vdGUgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGxldCBtYXJrZXIgPSBmb290bm90ZXNPbkxpbmVbaV0uZm9vdG5vdGU7XHJcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXhPZk1hcmtlckluTGluZSA9IGZvb3Rub3Rlc09uTGluZVtpXS5zdGFydEluZGV4O1xyXG4gICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPj0gaW5kZXhPZk1hcmtlckluTGluZSAmJlxyXG4gICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPD0gaW5kZXhPZk1hcmtlckluTGluZSArIG1hcmtlci5sZW5ndGhcclxuICAgICAgICAgICAgICAgICkge1xyXG4gICAgICAgICAgICAgICAgbWFya2VyVGFyZ2V0ID0gbWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAobWFya2VyVGFyZ2V0ICE9PSBudWxsKSB7XHJcbiAgICAgICAgLy8gZXh0cmFjdCBuYW1lXHJcbiAgICAgICAgbGV0IG1hdGNoID0gbWFya2VyVGFyZ2V0Lm1hdGNoKEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlKTtcclxuICAgICAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgbGV0IGZvb3Rub3RlTmFtZSA9IG1hdGNoWzJdO1xyXG5cclxuICAgICAgICAgICAgLy8gbWFya2VycyB3aXRob3V0IGEgZGV0YWlsIGxpbmUgZmFsbCB0aHJvdWdoIHRvIHRoZVxyXG4gICAgICAgICAgICAvLyBkZXRhaWwtY3JlYXRpb24gcGF0aHNcclxuICAgICAgICAgICAgbGV0IGRldGFpbHMgPSBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoZG9jKTtcclxuICAgICAgICAgICAgaWYgKCFkZXRhaWxzLmluY2x1ZGVzKGZvb3Rub3RlTmFtZSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHBvcHVwRWRpdGluZ0F2YWlsYWJsZShwbHVnaW4pKSB7XHJcbiAgICAgICAgICAgICAgICB2b2lkIG9wZW5Gb290bm90ZVBvcHVwKHBsdWdpbiwgZm9vdG5vdGVOYW1lLCAoKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgIGp1bXBUb0Zvb3Rub3RlRGV0YWlsKGZvb3Rub3RlTmFtZSwgY3Vyc29yUG9zaXRpb24sIGRvYywgcGx1Z2luKVxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBqdW1wVG9Gb290bm90ZURldGFpbChmb290bm90ZU5hbWUsIGN1cnNvclBvc2l0aW9uLCBkb2MsIHBsdWdpbik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYWRkRm9vdG5vdGVTZWN0aW9uSGVhZGVyKFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcclxuKTogc3RyaW5nIHtcclxuICAgIC8vY2hlY2sgaWYgJ0VuYWJsZSBGb290bm90ZSBTZWN0aW9uIEhlYWRpbmcnIGlzIHRydWVcclxuICAgIC8vaWYgc28sIHJldHVybiB0aGUgXCJGb290bm90ZSBTZWN0aW9uIEhlYWRpbmdcIlxyXG4gICAgLy8gZWxzZSwgcmV0dXJuIFwiXCJcclxuXHJcbiAgICBpZiAocGx1Z2luLnNldHRpbmdzLmVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmcgPT0gdHJ1ZSkge1xyXG4gICAgICAgIGxldCByZXR1cm5IZWFkaW5nID0gcGx1Z2luLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmc7XHJcbiAgICAgICAgLy8gdGhlIHNldHRpbmcgaG9sZHMgbGl0ZXJhbCBtYXJrZG93biAobGVnYWN5IHBsYWluLXRleHQgdmFsdWVzIGFyZVxyXG4gICAgICAgIC8vIG1pZ3JhdGVkIG9uIGxvYWQpOyBhIGRpdmlkZXIgZGlyZWN0bHkgYmVsb3cgYSB0ZXh0IGxpbmUgd291bGQgdHVyblxyXG4gICAgICAgIC8vIHRoYXQgbGluZSBpbnRvIGEgc2V0ZXh0IGhlYWRpbmcsIHNvIGtlZXAgYSBibGFuayBsaW5lIGluIGJldHdlZW5cclxuICAgICAgICBjb25zdCBkaXZpZGVyUmVnZXggPSAvXigtLS18XFwqXFwqXFwqfF9fXykvO1xyXG4gICAgICAgIGlmIChkaXZpZGVyUmVnZXgudGVzdChyZXR1cm5IZWFkaW5nKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gYFxcblxcbiR7cmV0dXJuSGVhZGluZ31gO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gYFxcbiR7cmV0dXJuSGVhZGluZ31gO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFwiXCI7XHJcbn1cclxuXHJcbi8vIEJ1aWxkIChkb24ndCBhcHBseSkgdGhlIGVkaXQgdGhhdCBhcHBlbmRzIGBbXmlkXTogYCBhZnRlciB0aGUgbGFzdFxyXG4vLyBub24tYmxhbmsgbGluZSDigJQgdHJpbW1pbmcgdHJhaWxpbmcgYmxhbmsgbGluZXMgaWYgZW5hYmxlZCwgYW5kIGFkZGluZyBhXHJcbi8vIGJsYW5rIHNlcGFyYXRvciBwbHVzIHRoZSBvcHRpb25hbCBzZWN0aW9uIGhlYWRpbmcgYmVmb3JlIHRoZSBmaXJzdFxyXG4vLyBmb290bm90ZS4gUmV0dXJuZWQgYXMgZGF0YSBzbyB0aGUgY2FsbGVyIGNhbiBidW5kbGUgaXQgd2l0aCB0aGUgbWFya2VyXHJcbi8vIGluc2VydGlvbiBpbnRvIGEgc2luZ2xlIHRyYW5zYWN0aW9uIChzZWUgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludCkuXHJcbmZ1bmN0aW9uIGJ1aWxkRGV0YWlsQXBwZW5kKFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBmb290bm90ZUlkOiBzdHJpbmcsXHJcbiAgICBpc0ZpcnN0Rm9vdG5vdGU6IGJvb2xlYW4sXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4pOiB7IGNoYW5nZTogRWRpdG9yQ2hhbmdlOyBjdXJzb3I6IEVkaXRvclBvc2l0aW9uIH0ge1xyXG4gICAgbGV0IHRleHQgPSBgXFxuW14ke2Zvb3Rub3RlSWR9XTogYDtcclxuICAgIGlmIChpc0ZpcnN0Rm9vdG5vdGUpIHtcclxuICAgICAgICB0ZXh0ID0gYWRkRm9vdG5vdGVTZWN0aW9uSGVhZGVyKHBsdWdpbikgKyBcIlxcblwiICsgdGV4dDtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgZnJvbUxpbmUgPSBkb2MubGFzdExpbmUoKTtcclxuICAgIGxldCB0bzogRWRpdG9yUG9zaXRpb24gfCB1bmRlZmluZWQ7XHJcbiAgICBpZiAocGx1Z2luLnNldHRpbmdzLmVuYWJsZVJlbW92ZUJsYW5rTGFzdExpbmVzID09PSB0cnVlKSB7XHJcbiAgICAgICAgd2hpbGUgKGZyb21MaW5lID4gMCAmJiBkb2MuZ2V0TGluZShmcm9tTGluZSkubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIGZyb21MaW5lLS07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRvID0geyBsaW5lOiBkb2MubGFzdExpbmUoKSwgY2g6IGRvYy5nZXRMaW5lKGRvYy5sYXN0TGluZSgpKS5sZW5ndGggfTtcclxuICAgIH1cclxuICAgIGNvbnN0IGZyb20gPSB7IGxpbmU6IGZyb21MaW5lLCBjaDogZG9jLmdldExpbmUoZnJvbUxpbmUpLmxlbmd0aCB9O1xyXG5cclxuICAgIC8vIGN1cnNvciBsYW5kcyBhdCB0aGUgZW5kIG9mIHRoZSBpbnNlcnRlZCBkZXRhaWwgbGluZVxyXG4gICAgY29uc3QgbGluZXNBZGRlZCA9IHRleHQuc3BsaXQoXCJcXG5cIikubGVuZ3RoIC0gMTtcclxuICAgIGNvbnN0IGN1cnNvciA9IHtcclxuICAgICAgICBsaW5lOiBmcm9tTGluZSArIGxpbmVzQWRkZWQsXHJcbiAgICAgICAgY2g6IHRleHQubGVuZ3RoIC0gdGV4dC5sYXN0SW5kZXhPZihcIlxcblwiKSAtIDEsXHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIHsgY2hhbmdlOiB7IGZyb20sIHRvLCB0ZXh0IH0sIGN1cnNvciB9O1xyXG59XHJcblxyXG4vKiogYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB0byBpbnNlcnQgYSBmb290bm90ZSBvbmx5IGF0IHRoZSBlbmQgb2Ygd29yZCAqL1xyXG5mdW5jdGlvbiBhZGp1c3RGb290bm90ZVBvc2l0aW9uKFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLmluc2VydEF0RW5kT2ZXb3JkKSByZXR1cm4gY3Vyc29yUG9zaXRpb247XHJcbiAgICBjb25zdCBlbmRPZldvcmRVbmRlckN1cnNvciA9IGRvYy53b3JkQXQoY3Vyc29yUG9zaXRpb24pPy50bztcclxuICAgIGlmICghZW5kT2ZXb3JkVW5kZXJDdXJzb3IpIHJldHVybiBjdXJzb3JQb3NpdGlvbjsgLy8gbm8gd29yZCB1bmRlciBjdXJzb3JcclxuXHJcbiAgICAvLyBhZGp1c3QgY3Vyc29yIHBvc2l0aW9uIHRvIGluc2VydCBhIGZvb3Rub3RlIG9ubHkgYXQgdGhlIGVuZCBvZiB3b3JkXHJcbiAgICBjb25zdCBuZXh0Q2hhciA9IGxpbmVUZXh0LmNoYXJBdChlbmRPZldvcmRVbmRlckN1cnNvci5jaCk7XHJcbiAgICBpZiAoW1wiLlwiLCBcIixcIiwgXCI6XCIsIFwiO1wiXS5pbmNsdWRlcyhuZXh0Q2hhcikpIGVuZE9mV29yZFVuZGVyQ3Vyc29yLmNoKys7XHJcbiAgICBjdXJzb3JQb3NpdGlvbiA9IGVuZE9mV29yZFVuZGVyQ3Vyc29yO1xyXG4gICAgcmV0dXJuIGN1cnNvclBvc2l0aW9uO1xyXG59XHJcblxyXG4vL0ZVTkNUSU9OUyBGT1IgQVVUT05VTUJFUkVEIEZPT1ROT1RFU1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGluc2VydEF1dG9udW1Gb290bm90ZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKSB7XHJcbiAgICAvLyBwcmVzc2luZyB0aGUgaG90a2V5IHdoaWxlIHRoZSBwb3B1cCBlZGl0b3IgaXMgb3BlbiBjbG9zZXMgaXRcclxuICAgIGlmICh0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAoKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG1kVmlldyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHJcbiAgICBpZiAoIW1kVmlldykgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKG1kVmlldy5lZGl0b3IgPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmVkaXRvcjtcclxuICAgIGNvbnN0IGN1cnNvclBvc2l0aW9uID0gZG9jLmdldEN1cnNvcigpO1xyXG4gICAgY29uc3QgbGluZVRleHQgPSBkb2MuZ2V0TGluZShjdXJzb3JQb3NpdGlvbi5saW5lKTtcclxuICAgIGNvbnN0IG1hcmtkb3duVGV4dCA9IG1kVmlldy5kYXRhO1xyXG5cclxuICAgIGlmIChzaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIGlmIChzaG91bGRKdW1wRnJvbU1hcmtlclRvRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxyXG4gICAgICAgIHJldHVybjtcclxuXHJcbiAgICByZXR1cm4gc2hvdWxkQ3JlYXRlQXV0b251bUZvb3Rub3RlKFxyXG4gICAgICAgIGxpbmVUZXh0LFxyXG4gICAgICAgIGN1cnNvclBvc2l0aW9uLFxyXG4gICAgICAgIHBsdWdpbixcclxuICAgICAgICBkb2MsXHJcbiAgICAgICAgbWFya2Rvd25UZXh0XHJcbiAgICApO1xyXG59XHJcblxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZUF1dG9udW1Gb290bm90ZShcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBtYXJrZG93blRleHQ6IHN0cmluZ1xyXG4pIHtcclxuICAgIGN1cnNvclBvc2l0aW9uID0gYWRqdXN0Rm9vdG5vdGVQb3NpdGlvbihjdXJzb3JQb3NpdGlvbiwgZG9jLCBsaW5lVGV4dCwgcGx1Z2luKTtcclxuXHJcbiAgICAvLyBjcmVhdGUgbmV3IGZvb3Rub3RlIHdpdGggdGhlIG5leHQgbnVtZXJpY2FsIGluZGV4XHJcbiAgICBsZXQgbWF0Y2hlcyA9IG1hcmtkb3duVGV4dC5tYXRjaChBbGxOdW1iZXJlZE1hcmtlcnMpO1xyXG4gICAgbGV0IG51bWJlcnM6IEFycmF5PG51bWJlcj4gPSBbXTtcclxuICAgIGxldCBjdXJyZW50TWF4ID0gMTtcclxuXHJcbiAgICBpZiAobWF0Y2hlcyAhPSBudWxsKSB7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gbWF0Y2hlcy5sZW5ndGggLSAxOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IG1hdGNoID0gbWF0Y2hlc1tpXTtcclxuICAgICAgICAgICAgbWF0Y2ggPSBtYXRjaC5yZXBsYWNlKFwiW15cIiwgXCJcIik7XHJcbiAgICAgICAgICAgIG1hdGNoID0gbWF0Y2gucmVwbGFjZShcIl1cIiwgXCJcIik7XHJcbiAgICAgICAgICAgIGxldCBtYXRjaE51bWJlciA9IE51bWJlcihtYXRjaCk7XHJcbiAgICAgICAgICAgIG51bWJlcnNbaV0gPSBtYXRjaE51bWJlcjtcclxuICAgICAgICAgICAgaWYgKG1hdGNoTnVtYmVyICsgMSA+IGN1cnJlbnRNYXgpIHtcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRNYXggPSBtYXRjaE51bWJlciArIDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGZvb3ROb3RlSWQgPSBjdXJyZW50TWF4O1xyXG4gICAgbGV0IGZvb3Rub3RlTWFya2VyID0gYFteJHtmb290Tm90ZUlkfV1gO1xyXG5cclxuICAgIGNvbnN0IGxpc3QgPSBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoZG9jKTtcclxuICAgIGNvbnN0IGlzRmlyc3RGb290bm90ZSA9IGxpc3QubGVuZ3RoID09PSAwICYmIGN1cnJlbnRNYXggPT0gMTtcclxuICAgIGNvbnN0IGRldGFpbCA9IGJ1aWxkRGV0YWlsQXBwZW5kKGRvYywgU3RyaW5nKGZvb3ROb3RlSWQpLCBpc0ZpcnN0Rm9vdG5vdGUsIHBsdWdpbik7XHJcbiAgICBjb25zdCBjaGFuZ2VzOiBFZGl0b3JDaGFuZ2VbXSA9IFtcclxuICAgICAgICB7IGZyb206IGN1cnNvclBvc2l0aW9uLCB0ZXh0OiBmb290bm90ZU1hcmtlciB9LFxyXG4gICAgICAgIGRldGFpbC5jaGFuZ2UsXHJcbiAgICBdO1xyXG5cclxuICAgIGlmIChwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luKSkge1xyXG4gICAgICAgIC8vIHR5cGUgdGhlIGRldGFpbCBpbiBhIHBvcHVwIGluc3RlYWQgb2YganVtcGluZyB0byB0aGUgYm90dG9tO1xyXG4gICAgICAgIC8vIHRoZSBjdXJzb3Igb25seSBtb3ZlcyBwYXN0IHRoZSBuZXcgbWFya2VyXHJcbiAgICAgICAgY29uc3QgYWZ0ZXJNYXJrZXIgPSB7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiBjdXJzb3JQb3NpdGlvbi5jaCArIGZvb3Rub3RlTWFya2VyLmxlbmd0aCB9O1xyXG4gICAgICAgIGRvYy50cmFuc2FjdGlvbih7IGNoYW5nZXMsIHNlbGVjdGlvbjogeyBmcm9tOiBhZnRlck1hcmtlciB9IH0pO1xyXG4gICAgICAgIHZvaWQgb3BlbkZvb3Rub3RlUG9wdXAocGx1Z2luLCBTdHJpbmcoZm9vdE5vdGVJZCksICgpID0+XHJcbiAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgZGV0YWlsLmN1cnNvciwgcGx1Z2luKVxyXG4gICAgICAgICk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgZGV0YWlsLmN1cnNvciwgcGx1Z2luLCBjaGFuZ2VzKTtcclxuICAgIH1cclxufVxyXG5cclxuXHJcbi8vRlVOQ1RJT05TIEZPUiBOQU1FRCBGT09UTk9URVNcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpbnNlcnROYW1lZEZvb3Rub3RlKHBsdWdpbjogRm9vdG5vdGVQbHVnaW4pIHtcclxuICAgIC8vIHByZXNzaW5nIHRoZSBob3RrZXkgd2hpbGUgdGhlIHBvcHVwIGVkaXRvciBpcyBvcGVuIGNsb3NlcyBpdFxyXG4gICAgaWYgKHRvZ2dsZUNsb3NlRm9vdG5vdGVQb3B1cCgpKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgbWRWaWV3ID0gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG5cclxuICAgIGlmICghbWRWaWV3KSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAobWRWaWV3LmVkaXRvciA9PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICBjb25zdCBkb2MgPSBtZFZpZXcuZWRpdG9yO1xyXG4gICAgY29uc3QgY3Vyc29yUG9zaXRpb24gPSBkb2MuZ2V0Q3Vyc29yKCk7XHJcbiAgICBjb25zdCBsaW5lVGV4dCA9IGRvYy5nZXRMaW5lKGN1cnNvclBvc2l0aW9uLmxpbmUpO1xyXG4gICAgY29uc3QgbWFya2Rvd25UZXh0ID0gbWRWaWV3LmRhdGE7XHJcblxyXG4gICAgaWYgKHNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MsIHBsdWdpbikpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgaWYgKHNob3VsZEp1bXBGcm9tTWFya2VyVG9EZXRhaWwobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MsIHBsdWdpbikpXHJcbiAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgIGlmIChzaG91bGRDcmVhdGVNYXRjaGluZ0Zvb3Rub3RlRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgcGx1Z2luLCBkb2MpKVxyXG4gICAgICAgIHJldHVybjsgXHJcbiAgICByZXR1cm4gc2hvdWxkQ3JlYXRlRm9vdG5vdGVNYXJrZXIoXHJcbiAgICAgICAgbGluZVRleHQsXHJcbiAgICAgICAgY3Vyc29yUG9zaXRpb24sXHJcbiAgICAgICAgZG9jLFxyXG4gICAgICAgIG1hcmtkb3duVGV4dCxcclxuICAgICAgICBwbHVnaW5cclxuICAgICk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDcmVhdGVNYXRjaGluZ0Zvb3Rub3RlRGV0YWlsKFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXHJcbiAgICBkb2M6IEVkaXRvclxyXG4pIHtcclxuICAgIC8vIENyZWF0ZSBtYXRjaGluZyBmb290bm90ZSBkZXRhaWwgZm9yIGZvb3Rub3RlIG1hcmtlclxyXG4gICAgXHJcbiAgICAvLyBkb2VzIHRoaXMgbGluZSBoYXZlIGEgZm9vdG5vdGUgbWFya2VyP1xyXG4gICAgLy8gZG9lcyB0aGUgY3Vyc29yIG92ZXJsYXAgd2l0aCBvbmUgb2YgdGhlbT9cclxuICAgIC8vIGlmIHNvLCB3aGljaCBvbmU/XHJcbiAgICAvLyBkb2VzIHRoaXMgZm9vdG5vdGUgbWFya2VyIGhhdmUgYSBkZXRhaWwgbGluZT9cclxuICAgIC8vIGlmIG5vdCwgY3JlYXRlIGl0IGFuZCBwbGFjZSBjdXJzb3IgdGhlcmVcclxuICAgIGxldCByZU9ubHlNYXJrZXJzTWF0Y2hlcyA9IGxpbmVUZXh0Lm1hdGNoKEFsbE1hcmtlcnMpO1xyXG5cclxuICAgIGxldCBtYXJrZXJUYXJnZXQgPSBudWxsO1xyXG5cclxuICAgIGlmIChyZU9ubHlNYXJrZXJzTWF0Y2hlcyl7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gcmVPbmx5TWFya2Vyc01hdGNoZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IG1hcmtlciA9IHJlT25seU1hcmtlcnNNYXRjaGVzW2ldO1xyXG4gICAgICAgICAgICBpZiAobWFya2VyICE9IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGluZGV4T2ZNYXJrZXJJbkxpbmUgPSBsaW5lVGV4dC5pbmRleE9mKG1hcmtlcik7XHJcbiAgICAgICAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPj0gaW5kZXhPZk1hcmtlckluTGluZSAmJlxyXG4gICAgICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoIDw9IGluZGV4T2ZNYXJrZXJJbkxpbmUgKyBtYXJrZXIubGVuZ3RoXHJcbiAgICAgICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgICAgICBtYXJrZXJUYXJnZXQgPSBtYXJrZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1hcmtlclRhcmdldCAhPSBudWxsKSB7XHJcbiAgICAgICAgLy9leHRyYWN0IGZvb3Rub3RlXHJcbiAgICAgICAgbGV0IG1hdGNoID0gbWFya2VyVGFyZ2V0Lm1hdGNoKEV4dHJhY3ROYW1lRnJvbUZvb3Rub3RlKVxyXG4gICAgICAgIC8vZmluZCBpZiB0aGlzIGZvb3Rub3RlIGV4aXN0cyBieSBsaXN0aW5nIGV4aXN0aW5nIGZvb3Rub3RlIGRldGFpbHNcclxuICAgICAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgbGV0IGZvb3Rub3RlSWQgPSBtYXRjaFsyXTtcclxuXHJcbiAgICAgICAgICAgIGxldCBsaXN0OiBzdHJpbmdbXSA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhkb2MpO1xyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIGxpc3QgZG9lc24ndCBpbmNsdWRlIGN1cnJlbnQgZm9vdG5vdGVcclxuICAgICAgICAgICAgLy8gaWYgc28sIGFkZCBkZXRhaWwgZm9yIHRoZSBjdXJyZW50IGZvb3Rub3RlXHJcbiAgICAgICAgICAgIGlmKCFsaXN0LmluY2x1ZGVzKGZvb3Rub3RlSWQpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBkZXRhaWwgPSBidWlsZERldGFpbEFwcGVuZChkb2MsIGZvb3Rub3RlSWQsIGxpc3QubGVuZ3RoID09PSAwLCBwbHVnaW4pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHR5cGUgdGhlIGRldGFpbCBpbiBhIHBvcHVwIGluc3RlYWQgb2YganVtcGluZyB0byB0aGVcclxuICAgICAgICAgICAgICAgICAgICAvLyBib3R0b207IHRoZSBjdXJzb3Igc3RheXMgb24gdGhlIG1hcmtlclxyXG4gICAgICAgICAgICAgICAgICAgIGRvYy50cmFuc2FjdGlvbih7IGNoYW5nZXM6IFtkZXRhaWwuY2hhbmdlXSB9KTtcclxuICAgICAgICAgICAgICAgICAgICB2b2lkIG9wZW5Gb290bm90ZVBvcHVwKHBsdWdpbiwgZm9vdG5vdGVJZCwgKCkgPT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBkZXRhaWwuY3Vyc29yLCBwbHVnaW4pXHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbW92ZUN1cnNvckFuZFNldEp1bXBQb2ludChkb2MsIGN1cnNvclBvc2l0aW9uLCBkZXRhaWwuY3Vyc29yLCBwbHVnaW4sIFtkZXRhaWwuY2hhbmdlXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENyZWF0ZUZvb3Rub3RlTWFya2VyKFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgbWFya2Rvd25UZXh0OiBzdHJpbmcsXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luXHJcbikge1xyXG4gICAgY3Vyc29yUG9zaXRpb24gPSBhZGp1c3RGb290bm90ZVBvc2l0aW9uKGN1cnNvclBvc2l0aW9uLCBkb2MsIGxpbmVUZXh0LCBwbHVnaW4pO1xyXG5cclxuICAgIC8vY3JlYXRlIGVtcHR5IGZvb3Rub3RlIG1hcmtlciBmb3IgbmFtZSBpbnB1dCwgY3Vyc29yIGluIGJldHdlZW4gW14gYW5kIF1cclxuICAgIGxldCBlbXB0eU1hcmtlciA9IGBbXl1gO1xyXG4gICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogY3Vyc29yUG9zaXRpb24uY2ggKyAyIH1cclxuICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zLCBwbHVnaW4sIFtcclxuICAgICAgICB7IGZyb206IGN1cnNvclBvc2l0aW9uLCB0ZXh0OiBlbXB0eU1hcmtlciB9LFxyXG4gICAgXSlcclxufVxyXG4iLCJpbXBvcnQge1xyXG4gIGFkZEljb24sXHJcbiAgTWFya2Rvd25WaWV3LFxyXG4gIFBsdWdpblxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuaW1wb3J0IHsgRm9vdG5vdGVQbHVnaW5TZXR0aW5nVGFiLCBGb290bm90ZVBsdWdpblNldHRpbmdzLCBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuaW1wb3J0IHsgZGlzbWlzc0Zvb3Rub3RlUG9wdXAgfSBmcm9tIFwiLi9mb290bm90ZS1wb3B1cFwiO1xyXG5pbXBvcnQgeyBpbnNlcnRBdXRvbnVtRm9vdG5vdGUsaW5zZXJ0TmFtZWRGb290bm90ZSB9IGZyb20gXCIuL2luc2VydC1vci1uYXZpZ2F0ZS1mb290bm90ZXNcIjtcclxuXHJcbi8vQWRkIGNoZXZyb24tdXAtc3F1YXJlIGljb24gZnJvbSBsdWNpZGUgZm9yIG1vYmlsZSB0b29sYmFyICh0ZW1wb3JhcnkgdW50aWwgT2JzaWRpYW4gdXBkYXRlcyB0byBMdWNpZGUgdjAuMTMwLjApXHJcbmFkZEljb24oXCJjaGV2cm9uLXVwLXNxdWFyZVwiLCBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIGNsYXNzPVwibHVjaWRlIGx1Y2lkZS1jaGV2cm9uLXVwLXNxdWFyZVwiPjxyZWN0IHdpZHRoPVwiMThcIiBoZWlnaHQ9XCIxOFwiIHg9XCIzXCIgeT1cIjNcIiByeD1cIjJcIiByeT1cIjJcIj48L3JlY3Q+PHBvbHlsaW5lIHBvaW50cz1cIjgsMTQgMTIsMTAgMTYsMTRcIj48L3BvbHlsaW5lPjwvc3ZnPmApO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRm9vdG5vdGVQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gIHB1YmxpYyBzZXR0aW5ncyE6IEZvb3Rub3RlUGx1Z2luU2V0dGluZ3M7XHJcblxyXG4gIGFzeW5jIG9ubG9hZCgpIHtcclxuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiaW5zZXJ0LWF1dG9udW1iZXJlZC1mb290bm90ZVwiLFxyXG4gICAgICBuYW1lOiBcIkluc2VydCAvIG5hdmlnYXRlIGF1dG8tbnVtYmVyZWQgZm9vdG5vdGVcIixcclxuICAgICAgaWNvbjogXCJwbHVzLXNxdWFyZVwiLFxyXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcclxuICAgICAgICBpZiAoY2hlY2tpbmcpXHJcbiAgICAgICAgICByZXR1cm4gISF0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgICAgIGluc2VydEF1dG9udW1Gb290bm90ZSh0aGlzKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiaW5zZXJ0LW5hbWVkLWZvb3Rub3RlXCIsXHJcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IC8gbmF2aWdhdGUgbmFtZWQgZm9vdG5vdGVcIixcclxuICAgICAgaWNvbjogXCJjaGV2cm9uLXVwLXNxdWFyZVwiLFxyXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcclxuICAgICAgICBpZiAoY2hlY2tpbmcpXHJcbiAgICAgICAgICByZXR1cm4gISF0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgICAgIGluc2VydE5hbWVkRm9vdG5vdGUodGhpcyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIFxyXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBGb290bm90ZVBsdWdpblNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiBkaXNtaXNzRm9vdG5vdGVQb3B1cCgpKVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIG9udW5sb2FkKCkge1xyXG4gICAgZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKFxyXG4gICAgICB7fSxcclxuICAgICAgREVGQVVMVF9TRVRUSU5HUyxcclxuICAgICAgKGF3YWl0IHRoaXMubG9hZERhdGEoKSkgYXMgUGFydGlhbDxGb290bm90ZVBsdWdpblNldHRpbmdzPiB8IG51bGwsXHJcbiAgICApO1xyXG5cclxuICAgIC8vIG1pZ3JhdGUgcHJlLTEuMC40IHNlY3Rpb24gaGVhZGluZyB2YWx1ZXM6IHRoZSBvbGQgdGV4dCBpbnB1dCBpbXBsaWVkXHJcbiAgICAvLyBhbiBIMSwgdGhlIHRleHRhcmVhIHRha2VzIGxpdGVyYWwgbWFya2Rvd24sIHNvIGNvbnZlcnQgb25jZSBhbmQgc2F2ZVxyXG4gICAgY29uc3QgaGVhZGluZyA9IHRoaXMuc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZztcclxuICAgIGlmIChoZWFkaW5nICYmICEvXigjezEsNn0gfC0tLXxcXCpcXCpcXCp8X19fKS8udGVzdChoZWFkaW5nKSkge1xyXG4gICAgICB0aGlzLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmcgPSBgIyAke2hlYWRpbmd9YDtcclxuICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBkcm9wIHRoZSBzZXR0aW5nIGZvciB0aGUgcmVtb3ZlZCBhdXRvc3VnZ2VzdCBmZWF0dXJlIChPYnNpZGlhbiBub3dcclxuICAgIC8vIHN1Z2dlc3RzIGZvb3Rub3RlcyBuYXRpdmVseSlcclxuICAgIGlmIChcImVuYWJsZUF1dG9TdWdnZXN0XCIgaW4gdGhpcy5zZXR0aW5ncykge1xyXG4gICAgICBkZWxldGUgKHRoaXMuc2V0dGluZ3MgYXMgeyBlbmFibGVBdXRvU3VnZ2VzdD86IGJvb2xlYW4gfSkuZW5hYmxlQXV0b1N1Z2dlc3Q7XHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gIH1cclxufSJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIk1hcmtkb3duVmlldyIsImFkZEljb24i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
