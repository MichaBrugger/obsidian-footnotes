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
                heading: "Footnotes section",
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
            .setDesc("Remove blank lines from the end of the note when inserting a new footnotes section.")
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
                // land the cursor right after the marker so typing continues
                // seamlessly (a named footnote would otherwise leave it inside
                // the brackets); string search, since the id isn't regex-safe
                const cursor = editor.getCursor();
                const line = editor.getLine(cursor.line);
                const marker = `[^${footnoteId}]`;
                for (let idx = line.indexOf(marker); idx !== -1; idx = line.indexOf(marker, idx + 1)) {
                    if (cursor.ch >= idx && cursor.ch <= idx + marker.length) {
                        editor.setCursor({ line: cursor.line, ch: idx + marker.length });
                        break;
                    }
                }
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
            var _a;
            yield embed.loadFile();
            if (embed.subpathNotFound)
                return false;
            containerEl.removeClass("footnote-shortcut-popup-loading");
            embed.showEditor();
            const inner = (_a = embed.editMode) === null || _a === void 0 ? void 0 : _a.editor;
            if (inner) {
                inner.focus();
                // cursor at the END of the detail so the user can backspace
                // or keep writing without reaching for the arrow keys
                if (inner.lastLine && inner.getLine && inner.setCursor) {
                    const last = inner.lastLine();
                    inner.setCursor({ line: last, ch: inner.getLine(last).length });
                }
            }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9mb290bm90ZS1wb3B1cC50cyIsInNyYy9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlLCBTdXBwcmVzc2VkRXJyb3IsIFN5bWJvbCwgSXRlcmF0b3IgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXNEZWNvcmF0ZShjdG9yLCBkZXNjcmlwdG9ySW4sIGRlY29yYXRvcnMsIGNvbnRleHRJbiwgaW5pdGlhbGl6ZXJzLCBleHRyYUluaXRpYWxpemVycykge1xyXG4gICAgZnVuY3Rpb24gYWNjZXB0KGYpIHsgaWYgKGYgIT09IHZvaWQgMCAmJiB0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRnVuY3Rpb24gZXhwZWN0ZWRcIik7IHJldHVybiBmOyB9XHJcbiAgICB2YXIga2luZCA9IGNvbnRleHRJbi5raW5kLCBrZXkgPSBraW5kID09PSBcImdldHRlclwiID8gXCJnZXRcIiA6IGtpbmQgPT09IFwic2V0dGVyXCIgPyBcInNldFwiIDogXCJ2YWx1ZVwiO1xyXG4gICAgdmFyIHRhcmdldCA9ICFkZXNjcmlwdG9ySW4gJiYgY3RvciA/IGNvbnRleHRJbltcInN0YXRpY1wiXSA/IGN0b3IgOiBjdG9yLnByb3RvdHlwZSA6IG51bGw7XHJcbiAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JJbiB8fCAodGFyZ2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGNvbnRleHRJbi5uYW1lKSA6IHt9KTtcclxuICAgIHZhciBfLCBkb25lID0gZmFsc2U7XHJcbiAgICBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4pIGNvbnRleHRbcF0gPSBwID09PSBcImFjY2Vzc1wiID8ge30gOiBjb250ZXh0SW5bcF07XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4uYWNjZXNzKSBjb250ZXh0LmFjY2Vzc1twXSA9IGNvbnRleHRJbi5hY2Nlc3NbcF07XHJcbiAgICAgICAgY29udGV4dC5hZGRJbml0aWFsaXplciA9IGZ1bmN0aW9uIChmKSB7IGlmIChkb25lKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFkZCBpbml0aWFsaXplcnMgYWZ0ZXIgZGVjb3JhdGlvbiBoYXMgY29tcGxldGVkXCIpOyBleHRyYUluaXRpYWxpemVycy5wdXNoKGFjY2VwdChmIHx8IG51bGwpKTsgfTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gKDAsIGRlY29yYXRvcnNbaV0pKGtpbmQgPT09IFwiYWNjZXNzb3JcIiA/IHsgZ2V0OiBkZXNjcmlwdG9yLmdldCwgc2V0OiBkZXNjcmlwdG9yLnNldCB9IDogZGVzY3JpcHRvcltrZXldLCBjb250ZXh0KTtcclxuICAgICAgICBpZiAoa2luZCA9PT0gXCJhY2Nlc3NvclwiKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHZvaWQgMCkgY29udGludWU7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZFwiKTtcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmdldCkpIGRlc2NyaXB0b3IuZ2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LnNldCkpIGRlc2NyaXB0b3Iuc2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmluaXQpKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoXyA9IGFjY2VwdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIGlmIChraW5kID09PSBcImZpZWxkXCIpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgICAgICBlbHNlIGRlc2NyaXB0b3Jba2V5XSA9IF87XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRhcmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgY29udGV4dEluLm5hbWUsIGRlc2NyaXB0b3IpO1xyXG4gICAgZG9uZSA9IHRydWU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19ydW5Jbml0aWFsaXplcnModGhpc0FyZywgaW5pdGlhbGl6ZXJzLCB2YWx1ZSkge1xyXG4gICAgdmFyIHVzZVZhbHVlID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRpYWxpemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhbHVlID0gdXNlVmFsdWUgPyBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnLCB2YWx1ZSkgOiBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1c2VWYWx1ZSA/IHZhbHVlIDogdm9pZCAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcHJvcEtleSh4KSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwic3ltYm9sXCIgPyB4IDogXCJcIi5jb25jYXQoeCk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zZXRGdW5jdGlvbk5hbWUoZiwgbmFtZSwgcHJlZml4KSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3ltYm9sXCIpIG5hbWUgPSBuYW1lLmRlc2NyaXB0aW9uID8gXCJbXCIuY29uY2F0KG5hbWUuZGVzY3JpcHRpb24sIFwiXVwiKSA6IFwiXCI7XHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGYsIFwibmFtZVwiLCB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHByZWZpeCA/IFwiXCIuY29uY2F0KHByZWZpeCwgXCIgXCIsIG5hbWUpIDogbmFtZSB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGcgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEl0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpO1xyXG4gICAgcmV0dXJuIGcubmV4dCA9IHZlcmIoMCksIGdbXCJ0aHJvd1wiXSA9IHZlcmIoMSksIGdbXCJyZXR1cm5cIl0gPSB2ZXJiKDIpLCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBBc3luY0l0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBBc3luY0l0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpLCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIsIGF3YWl0UmV0dXJuKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gYXdhaXRSZXR1cm4oZikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGYsIHJlamVjdCk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpZiAoZ1tuXSkgeyBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyBpZiAoZikgaVtuXSA9IGYoaVtuXSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IGZhbHNlIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbnZhciBvd25LZXlzID0gZnVuY3Rpb24obykge1xyXG4gICAgb3duS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIHx8IGZ1bmN0aW9uIChvKSB7XHJcbiAgICAgICAgdmFyIGFyID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgayBpbiBvKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIGspKSBhclthci5sZW5ndGhdID0gaztcclxuICAgICAgICByZXR1cm4gYXI7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIG93bktleXMobyk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayA9IG93bktleXMobW9kKSwgaSA9IDA7IGkgPCBrLmxlbmd0aDsgaSsrKSBpZiAoa1tpXSAhPT0gXCJkZWZhdWx0XCIpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwga1tpXSk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4oc3RhdGUsIHJlY2VpdmVyKSB7XHJcbiAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwgfHwgKHR5cGVvZiByZWNlaXZlciAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcmVjZWl2ZXIgIT09IFwiZnVuY3Rpb25cIikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgdXNlICdpbicgb3BlcmF0b3Igb24gbm9uLW9iamVjdFwiKTtcclxuICAgIHJldHVybiB0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyID09PSBzdGF0ZSA6IHN0YXRlLmhhcyhyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZShlbnYsIHZhbHVlLCBhc3luYykge1xyXG4gICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkLlwiKTtcclxuICAgICAgICB2YXIgZGlzcG9zZSwgaW5uZXI7XHJcbiAgICAgICAgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmFzeW5jRGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0Rpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmFzeW5jRGlzcG9zZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkaXNwb3NlID09PSB2b2lkIDApIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuZGlzcG9zZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5kaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5kaXNwb3NlXTtcclxuICAgICAgICAgICAgaWYgKGFzeW5jKSBpbm5lciA9IGRpc3Bvc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2YgZGlzcG9zZSAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IG5vdCBkaXNwb3NhYmxlLlwiKTtcclxuICAgICAgICBpZiAoaW5uZXIpIGRpc3Bvc2UgPSBmdW5jdGlvbigpIHsgdHJ5IHsgaW5uZXIuY2FsbCh0aGlzKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7IH0gfTtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IHZhbHVlOiB2YWx1ZSwgZGlzcG9zZTogZGlzcG9zZSwgYXN5bmM6IGFzeW5jIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoYXN5bmMpIHtcclxuICAgICAgICBlbnYuc3RhY2sucHVzaCh7IGFzeW5jOiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG5cclxufVxyXG5cclxudmFyIF9TdXBwcmVzc2VkRXJyb3IgPSB0eXBlb2YgU3VwcHJlc3NlZEVycm9yID09PSBcImZ1bmN0aW9uXCIgPyBTdXBwcmVzc2VkRXJyb3IgOiBmdW5jdGlvbiAoZXJyb3IsIHN1cHByZXNzZWQsIG1lc3NhZ2UpIHtcclxuICAgIHZhciBlID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xyXG4gICAgcmV0dXJuIGUubmFtZSA9IFwiU3VwcHJlc3NlZEVycm9yXCIsIGUuZXJyb3IgPSBlcnJvciwgZS5zdXBwcmVzc2VkID0gc3VwcHJlc3NlZCwgZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2Rpc3Bvc2VSZXNvdXJjZXMoZW52KSB7XHJcbiAgICBmdW5jdGlvbiBmYWlsKGUpIHtcclxuICAgICAgICBlbnYuZXJyb3IgPSBlbnYuaGFzRXJyb3IgPyBuZXcgX1N1cHByZXNzZWRFcnJvcihlLCBlbnYuZXJyb3IsIFwiQW4gZXJyb3Igd2FzIHN1cHByZXNzZWQgZHVyaW5nIGRpc3Bvc2FsLlwiKSA6IGU7XHJcbiAgICAgICAgZW52Lmhhc0Vycm9yID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIHZhciByLCBzID0gMDtcclxuICAgIGZ1bmN0aW9uIG5leHQoKSB7XHJcbiAgICAgICAgd2hpbGUgKHIgPSBlbnYuc3RhY2sucG9wKCkpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmICghci5hc3luYyAmJiBzID09PSAxKSByZXR1cm4gcyA9IDAsIGVudi5zdGFjay5wdXNoKHIpLCBQcm9taXNlLnJlc29sdmUoKS50aGVuKG5leHQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHIuZGlzcG9zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSByLmRpc3Bvc2UuY2FsbChyLnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoci5hc3luYykgcmV0dXJuIHMgfD0gMiwgUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCkudGhlbihuZXh0LCBmdW5jdGlvbihlKSB7IGZhaWwoZSk7IHJldHVybiBuZXh0KCk7IH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBzIHw9IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIGZhaWwoZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHMgPT09IDEpIHJldHVybiBlbnYuaGFzRXJyb3IgPyBQcm9taXNlLnJlamVjdChlbnYuZXJyb3IpIDogUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgaWYgKGVudi5oYXNFcnJvcikgdGhyb3cgZW52LmVycm9yO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5leHQoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uKHBhdGgsIHByZXNlcnZlSnN4KSB7XHJcbiAgICBpZiAodHlwZW9mIHBhdGggPT09IFwic3RyaW5nXCIgJiYgL15cXC5cXC4/XFwvLy50ZXN0KHBhdGgpKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhdGgucmVwbGFjZSgvXFwuKHRzeCkkfCgoPzpcXC5kKT8pKCg/OlxcLlteLi9dKz8pPylcXC4oW2NtXT8pdHMkL2ksIGZ1bmN0aW9uIChtLCB0c3gsIGQsIGV4dCwgY20pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRzeCA/IHByZXNlcnZlSnN4ID8gXCIuanN4XCIgOiBcIi5qc1wiIDogZCAmJiAoIWV4dCB8fCAhY20pID8gbSA6IChkICsgZXh0ICsgXCIuXCIgKyBjbS50b0xvd2VyQ2FzZSgpICsgXCJqc1wiKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiBwYXRoO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBfX2V4dGVuZHM6IF9fZXh0ZW5kcyxcclxuICAgIF9fYXNzaWduOiBfX2Fzc2lnbixcclxuICAgIF9fcmVzdDogX19yZXN0LFxyXG4gICAgX19kZWNvcmF0ZTogX19kZWNvcmF0ZSxcclxuICAgIF9fcGFyYW06IF9fcGFyYW0sXHJcbiAgICBfX2VzRGVjb3JhdGU6IF9fZXNEZWNvcmF0ZSxcclxuICAgIF9fcnVuSW5pdGlhbGl6ZXJzOiBfX3J1bkluaXRpYWxpemVycyxcclxuICAgIF9fcHJvcEtleTogX19wcm9wS2V5LFxyXG4gICAgX19zZXRGdW5jdGlvbk5hbWU6IF9fc2V0RnVuY3Rpb25OYW1lLFxyXG4gICAgX19tZXRhZGF0YTogX19tZXRhZGF0YSxcclxuICAgIF9fYXdhaXRlcjogX19hd2FpdGVyLFxyXG4gICAgX19nZW5lcmF0b3I6IF9fZ2VuZXJhdG9yLFxyXG4gICAgX19jcmVhdGVCaW5kaW5nOiBfX2NyZWF0ZUJpbmRpbmcsXHJcbiAgICBfX2V4cG9ydFN0YXI6IF9fZXhwb3J0U3RhcixcclxuICAgIF9fdmFsdWVzOiBfX3ZhbHVlcyxcclxuICAgIF9fcmVhZDogX19yZWFkLFxyXG4gICAgX19zcHJlYWQ6IF9fc3ByZWFkLFxyXG4gICAgX19zcHJlYWRBcnJheXM6IF9fc3ByZWFkQXJyYXlzLFxyXG4gICAgX19zcHJlYWRBcnJheTogX19zcHJlYWRBcnJheSxcclxuICAgIF9fYXdhaXQ6IF9fYXdhaXQsXHJcbiAgICBfX2FzeW5jR2VuZXJhdG9yOiBfX2FzeW5jR2VuZXJhdG9yLFxyXG4gICAgX19hc3luY0RlbGVnYXRvcjogX19hc3luY0RlbGVnYXRvcixcclxuICAgIF9fYXN5bmNWYWx1ZXM6IF9fYXN5bmNWYWx1ZXMsXHJcbiAgICBfX21ha2VUZW1wbGF0ZU9iamVjdDogX19tYWtlVGVtcGxhdGVPYmplY3QsXHJcbiAgICBfX2ltcG9ydFN0YXI6IF9faW1wb3J0U3RhcixcclxuICAgIF9faW1wb3J0RGVmYXVsdDogX19pbXBvcnREZWZhdWx0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldDogX19jbGFzc1ByaXZhdGVGaWVsZEdldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRTZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkSW46IF9fY2xhc3NQcml2YXRlRmllbGRJbixcclxuICAgIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlOiBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZSxcclxuICAgIF9fZGlzcG9zZVJlc291cmNlczogX19kaXNwb3NlUmVzb3VyY2VzLFxyXG4gICAgX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb246IF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uLFxyXG59O1xyXG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIFNldHRpbmdEZWZpbml0aW9uSXRlbSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgRm9vdG5vdGVQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBGb290bm90ZVBsdWdpblNldHRpbmdzIHtcclxuICAgIGluc2VydEF0RW5kT2ZXb3JkOiBib29sZWFuO1xyXG4gICAgZW5hYmxlUG9wdXBFZGl0b3I6IGJvb2xlYW47XHJcblxyXG4gICAgZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogYm9vbGVhbjtcclxuICAgIEZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IHN0cmluZztcclxuXHJcbiAgICBlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lczogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEZvb3Rub3RlUGx1Z2luU2V0dGluZ3MgPSB7XHJcbiAgICBpbnNlcnRBdEVuZE9mV29yZDogdHJ1ZSxcclxuICAgIGVuYWJsZVBvcHVwRWRpdG9yOiB0cnVlLFxyXG5cclxuICAgIGVuYWJsZUZvb3Rub3RlU2VjdGlvbkhlYWRpbmc6IGZhbHNlLFxyXG4gICAgRm9vdG5vdGVTZWN0aW9uSGVhZGluZzogXCIjIEZvb3Rub3Rlc1wiLFxyXG5cclxuICAgIGVuYWJsZVJlbW92ZUJsYW5rTGFzdExpbmVzOiB0cnVlLFxyXG59O1xyXG5cclxuZXhwb3J0IGNsYXNzIEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xyXG4gICAgICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBPYnNpZGlhbiAxLjEzLjArIHJlbmRlcnMgdGhlIHRhYiBmcm9tIHRoZXNlIGRlZmluaXRpb25zIGFuZCBza2lwc1xyXG4gICAgLy8gZGlzcGxheSgpOyBjb250cm9scyBiaW5kIHRvIHRoaXMucGx1Z2luLnNldHRpbmdzW2tleV0gYW5kIGF1dG8tc2F2ZVxyXG4gICAgZ2V0U2V0dGluZ0RlZmluaXRpb25zKCk6IFNldHRpbmdEZWZpbml0aW9uSXRlbVtdIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiLFxyXG4gICAgICAgICAgICAgICAgZGVzYzogXCJBIG5ldyBmb290bm90ZSBpcyBvbmx5IGluc2VydGVkIGF0IHRoZSBlbmQgb2YgdGhlIHdvcmQgYW5kIGFmdGVyIGFueSBwdW5jdHVhdGlvbi5cIixcclxuICAgICAgICAgICAgICAgIGNvbnRyb2w6IHsgdHlwZTogXCJ0b2dnbGVcIiwga2V5OiBcImluc2VydEF0RW5kT2ZXb3JkXCIgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJFZGl0IGZvb3Rub3RlcyBpbiBhIHBvcHVwXCIsXHJcbiAgICAgICAgICAgICAgICBkZXNjOiBcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciBhdCB5b3VyIGN1cnNvciBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCBFc2NhcGUsIG9yIGJ5IGNsaWNraW5nIG91dHNpZGUuXCIsXHJcbiAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVQb3B1cEVkaXRvclwiIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiZ3JvdXBcIixcclxuICAgICAgICAgICAgICAgIGhlYWRpbmc6IFwiRm9vdG5vdGVzIHNlY3Rpb25cIixcclxuICAgICAgICAgICAgICAgIGl0ZW1zOiBbXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIlRyaW0gYmxhbmsgbGluZXNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzYzogXCJSZW1vdmUgYmxhbmsgbGluZXMgZnJvbSB0aGUgZW5kIG9mIHRoZSBub3RlIHdoZW4gaW5zZXJ0aW5nIGEgbmV3IGZvb3Rub3RlcyBzZWN0aW9uLlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lc1wiIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiRW5hYmxlIHNlY3Rpb24gaGVhZGluZ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjOiBcIkF1dG9tYXRpY2FsbHkgYWRkcyBhIGhlYWRpbmcgc2VwYXJhdGluZyBmb290bm90ZXMgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbm90ZSBmcm9tIHRoZSByZXN0IG9mIHRoZSB0ZXh0LlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sOiB7IHR5cGU6IFwidG9nZ2xlXCIsIGtleTogXCJlbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nXCIgfSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJTZWN0aW9uIGhlYWRpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzYzogXCJIZWFkaW5nIHRvIHBsYWNlIGFib3ZlIHRoZSBmb290bm90ZXMgc2VjdGlvbi4gQWNjZXB0cyBzdGFuZGFyZCBtYXJrZG93biwgaW5jbHVkaW5nIG11bHRpcGxlIGxpbmVzIGFuZCBkaXZpZGVycy5cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udHJvbDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ0ZXh0YXJlYVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBcIkZvb3Rub3RlU2VjdGlvbkhlYWRpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3M6IDYsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcjogXCJFeDogJyMgRm9vdG5vdGVzJ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ6ICgpID0+ICF0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIF07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gT2JzaWRpYW4gPCAxLjEzLjAgZmFsbHMgYmFjayB0byB0aGlzIGltcGVyYXRpdmUgaW1wbGVtZW50YXRpb247XHJcbiAgICAvLyBrZWVwIGl0IGluIHN5bmMgd2l0aCBnZXRTZXR0aW5nRGVmaW5pdGlvbnMoKSBhYm92ZVxyXG4gICAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcclxuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkluc2VydCBmb290bm90ZSBhdCBlbmQgb2Ygd29yZFwiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiQSBuZXcgZm9vdG5vdGUgaXMgb25seSBpbnNlcnRlZCBhdCB0aGUgZW5kIG9mIHRoZSB3b3JkIGFuZCBhZnRlciBhbnkgcHVuY3R1YXRpb24uXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZClcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZCA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkVkaXQgZm9vdG5vdGVzIGluIGEgcG9wdXBcIilcclxuICAgICAgICAuc2V0RGVzYyhcIk9wZW4gdGhlIGZvb3Rub3RlIGRldGFpbCBpbiBhIHNtYWxsIGVkaXRvciB3aGVyZSB5b3UncmUgdHlwaW5nLCBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbSBvZiB0aGUgbm90ZS4gQ2xvc2Ugd2l0aCB0aGUgZm9vdG5vdGUgaG90a2V5LCB0aGUgZXNjYXBlIGtleSwgb3IgYnkgY2xpY2tpbmcgb3V0c2lkZS5cIilcclxuICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XHJcbiAgICAgICAgICAgIHRvZ2dsZVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVBvcHVwRWRpdG9yKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVBvcHVwRWRpdG9yID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKFwiRm9vdG5vdGVzIHNlY3Rpb25cIilcclxuICAgICAgICAuc2V0SGVhZGluZygpO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIlRyaW0gYmxhbmsgbGluZXNcIilcclxuICAgICAgICAuc2V0RGVzYyhcIlJlbW92ZSBibGFuayBsaW5lcyBmcm9tIHRoZSBlbmQgb2YgdGhlIG5vdGUgd2hlbiBpbnNlcnRpbmcgYSBuZXcgZm9vdG5vdGVzIHNlY3Rpb24uXCIpXHJcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgICAgICB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIkVuYWJsZSBzZWN0aW9uIGhlYWRpbmdcIilcclxuICAgICAgICAuc2V0RGVzYyhcIkF1dG9tYXRpY2FsbHkgYWRkcyBhIGhlYWRpbmcgc2VwYXJhdGluZyBmb290bm90ZXMgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbm90ZSBmcm9tIHRoZSByZXN0IG9mIHRoZSB0ZXh0LlwiKVxyXG4gICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICAgICAgdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRm9vdG5vdGVTZWN0aW9uSGVhZGluZylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKFwiU2VjdGlvbiBoZWFkaW5nXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJIZWFkaW5nIHRvIHBsYWNlIGFib3ZlIHRoZSBmb290bm90ZXMgc2VjdGlvbi4gQWNjZXB0cyBzdGFuZGFyZCBNYXJrZG93biwgaW5jbHVkaW5nIG11bHRpcGxlIGxpbmVzIGFuZCBkaXZpZGVycy5cIilcclxuICAgICAgICAuYWRkVGV4dEFyZWEoKHRleHQpID0+XHJcbiAgICAgICAgICAgIHRleHRcclxuICAgICAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIkV4OiAnIyBGb290bm90ZXMnXCIpXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuRm9vdG5vdGVTZWN0aW9uSGVhZGluZylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oKHRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwuYWRkQ2xhc3MoXCJmb290bm90ZS1zaG9ydGN1dC1zZWN0aW9uLWhlYWRpbmctaW5wdXRcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnJvd3MgPSA2O1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCB7IE1hcmtkb3duVmlldyB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuaW1wb3J0IEZvb3Rub3RlUGx1Z2luIGZyb20gXCIuL21haW5cIjtcclxuaW1wb3J0IHsgQXBwV2l0aEVtYmVkUmVnaXN0cnksIEVkaXRvcldpdGhDbSB9IGZyb20gXCIuL29ic2lkaWFuLWludGVybmFsc1wiO1xyXG5cclxuLy8gQSBzbWFsbCBwb3B1cCBhbmNob3JlZCBhdCB0aGUgY3Vyc29yIGNvbnRhaW5pbmcgT2JzaWRpYW4ncyBvd24gZWRpdGFibGVcclxuLy8gbWFya2Rvd24gZW1iZWQsIGJvdW5kIHRvIGp1c3QgdGhlIGZvb3Rub3RlJ3MgZGV0YWlsIHZpYSB0aGUgYCNbXmlkXWBcclxuLy8gc3VicGF0aCAodGhlIHNhbWUgbWFjaGluZXJ5IHRoZSBjb3JlIEZvb3Rub3RlcyB2aWV3IHVzZXMpLiBFZGl0aW5nIGluIHRoZVxyXG4vLyBwb3B1cCBzYXZlcyBzdHJhaWdodCBiYWNrIHRvIHRoZSBkZXRhaWwgbGluZSBhdCB0aGUgYm90dG9tIG9mIHRoZSBub3RlLFxyXG4vLyBzbyB0aGUgdXNlcidzIGN1cnNvciBuZXZlciBoYXMgdG8gbGVhdmUgdGhlIHRleHQuXHJcblxyXG50eXBlIEFjdGl2ZVBvcHVwID0ge1xyXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50O1xyXG4gICAgY2xvc2U6IChmb2N1c0VkaXRvcjogYm9vbGVhbikgPT4gdm9pZDtcclxufTtcclxuXHJcbmxldCBhY3RpdmVQb3B1cDogQWN0aXZlUG9wdXAgfCBudWxsID0gbnVsbDtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luOiBGb290bm90ZVBsdWdpbik6IGJvb2xlYW4ge1xyXG4gICAgLy8gZW1iZWRSZWdpc3RyeSBpcyB1bmRvY3VtZW50ZWQgQVBJLCBzbyBkZWdyYWRlIHRvIHRoZSBsZWdhY3lcclxuICAgIC8vIGp1bXAtdG8tYm90dG9tIGJlaGF2aW9yIGlmIGl0IGV2ZXIgY2hhbmdlcyBzaGFwZVxyXG4gICAgY29uc3QgcmVnaXN0cnkgPSAocGx1Z2luLmFwcCBhcyBBcHBXaXRoRW1iZWRSZWdpc3RyeSkuZW1iZWRSZWdpc3RyeTtcclxuICAgIHJldHVybiBwbHVnaW4uc2V0dGluZ3MuZW5hYmxlUG9wdXBFZGl0b3IgPT09IHRydWVcclxuICAgICAgICAmJiB0eXBlb2YgcmVnaXN0cnk/LmVtYmVkQnlFeHRlbnNpb24/Lm1kID09PSBcImZ1bmN0aW9uXCI7XHJcbn1cclxuXHJcbi8vIENsb3NlIGZyb20gdGhlIGZvb3Rub3RlIGhvdGtleTsgcmV0dXJucyB3aGV0aGVyIGEgcG9wdXAgd2FzIG9wZW4sIHNvIHRoZVxyXG4vLyBob3RrZXkgY2FuIHRvZ2dsZSB0aGUgcG9wdXAgaW5zdGVhZCBvZiBpbnNlcnRpbmcgYW5vdGhlciBmb290bm90ZS5cclxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUNsb3NlRm9vdG5vdGVQb3B1cCgpOiBib29sZWFuIHtcclxuICAgIGlmIChhY3RpdmVQb3B1cCkge1xyXG4gICAgICAgIGFjdGl2ZVBvcHVwLmNsb3NlKHRydWUpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG4vLyBDbG9zZSB3aXRob3V0IHN0ZWFsaW5nIGZvY3VzIChsZWFmIHN3aXRjaGVkLCBwbHVnaW4gdW5sb2FkaW5nKS5cclxuZXhwb3J0IGZ1bmN0aW9uIGRpc21pc3NGb290bm90ZVBvcHVwKCkge1xyXG4gICAgaWYgKGFjdGl2ZVBvcHVwKSB7XHJcbiAgICAgICAgYWN0aXZlUG9wdXAuY2xvc2UoZmFsc2UpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlbkZvb3Rub3RlUG9wdXAoXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4gICAgZm9vdG5vdGVJZDogc3RyaW5nLFxyXG4gICAgb25VbmF2YWlsYWJsZT86ICgpID0+IHZvaWQsXHJcbikge1xyXG4gICAgZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKTtcclxuXHJcbiAgICBjb25zdCBtZFZpZXcgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICBpZiAoIW1kVmlldyB8fCAhbWRWaWV3LmZpbGUpIHJldHVybjtcclxuXHJcbiAgICAvLyBjYWxsZXJzIGdhdGUgb24gcG9wdXBFZGl0aW5nQXZhaWxhYmxlLCBidXQgcmUtY2hlY2sgc28gYSByZWdpc3RyeVxyXG4gICAgLy8gc2hhcGUgY2hhbmdlIGRlZ3JhZGVzIHRvIHRoZSBsZWdhY3kganVtcCBpbnN0ZWFkIG9mIHRocm93aW5nXHJcbiAgICBjb25zdCBjcmVhdGVFbWJlZCA9IChwbHVnaW4uYXBwIGFzIEFwcFdpdGhFbWJlZFJlZ2lzdHJ5KS5lbWJlZFJlZ2lzdHJ5Py5lbWJlZEJ5RXh0ZW5zaW9uPy5tZDtcclxuICAgIGlmICghY3JlYXRlRW1iZWQpIHtcclxuICAgICAgICBvblVuYXZhaWxhYmxlPy4oKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICAvLyBjYXB0dXJlOiB0aGUgbnVsbC1jaGVjayBhYm92ZSBkb2Vzbid0IG5hcnJvdyBwcm9wZXJ0eSBhY2Nlc3MgaW5zaWRlXHJcbiAgICAvLyB0aGUgYnVpbGRFbWJlZCBjbG9zdXJlXHJcbiAgICBjb25zdCBmaWxlID0gbWRWaWV3LmZpbGU7XHJcblxyXG4gICAgLy8gYSBqdXN0LWluc2VydGVkIGRldGFpbCBpcyBvbmx5IGluZGV4ZWQgb25jZSB0aGUgZmlsZSBzYXZlcyDigJQgYnV0XHJcbiAgICAvLyBtZFZpZXcuZGF0YSBsYWdzIGEgdGljayBiZWhpbmQgZWRpdG9yIEFQSSBjaGFuZ2VzLCBzbyBzYXZpbmcgdG9vIGVhcmx5XHJcbiAgICAvLyB3b3VsZCB3cml0ZSBwcmUtaW5zZXJ0aW9uIGNvbnRlbnQgdG8gZGlzazsgd2FpdCBmb3IgdGhlIGJ1ZmZlciB0b1xyXG4gICAgLy8gY2F0Y2ggdXAgZmlyc3QuIEZpbmlzaGluZyB0aGUgc2F2ZSAoYW5kIGl0cyBmb2xkLXN0YXRlIGV2ZW50KSBiZWZvcmVcclxuICAgIC8vIHRoZSBlbWJlZCBleGlzdHMgYWxzbyBrZWVwcyBpdCBmcm9tIHJlYWNoaW5nIGEgaGFsZi1pbml0aWFsaXplZCBlbWJlZC5cclxuICAgIGNvbnN0IGVkaXRvciA9IG1kVmlldy5lZGl0b3I7XHJcbiAgICBjb25zdCBkb2MgPSBtZFZpZXcuY29udGFpbmVyRWwub3duZXJEb2N1bWVudDtcclxuICAgIGNvbnN0IHdpbiA9IGRvYy5kZWZhdWx0VmlldyB8fCB3aW5kb3c7XHJcblxyXG4gICAgY29uc3QgZGV0YWlsVG9rZW4gPSBgW14ke2Zvb3Rub3RlSWR9XTpgO1xyXG4gICAgY29uc3QgZGF0YURlYWRsaW5lID0gRGF0ZS5ub3coKSArIDIwMDA7XHJcbiAgICB3aGlsZSAoIW1kVmlldy5kYXRhLmluY2x1ZGVzKGRldGFpbFRva2VuKSAmJiBEYXRlLm5vdygpIDwgZGF0YURlYWRsaW5lKSB7XHJcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHdpbi5zZXRUaW1lb3V0KHJlc29sdmUsIDUwKSk7XHJcbiAgICB9XHJcbiAgICBhd2FpdCBtZFZpZXcuc2F2ZSgpO1xyXG5cclxuICAgIC8vIGFuY2hvciBqdXN0IGJlbG93IHRoZSBjdXJzb3IsIGZsaXBwaW5nIGFib3ZlIGl0IG5lYXIgdGhlIHdpbmRvdyBib3R0b20uXHJcbiAgICAvLyBXaGVuIGZvY3VzIGlzIGluIGEgc3ViLWVkaXRvciAoYSB0YWJsZSBjZWxsIGJlaW5nIGVkaXRlZCksIHRoZSBtYWluXHJcbiAgICAvLyBlZGl0b3IncyBjb29yZHNBdFBvcyBvbmx5IGtub3dzIHRoZSB0YWJsZSB3aWRnZXQncyBlZGdlIOKAlCB3aGljaCBwaW5zXHJcbiAgICAvLyB0aGUgcG9wdXAgdG8gdGhlIHNjcmVlbiBib3JkZXIg4oCUIHdoaWxlIHRoZSBzdWItZWRpdG9yJ3MgRE9NIHNlbGVjdGlvblxyXG4gICAgLy8gdHJhY2tzIHRoZSByZWFsIGNhcmV0LiBXaXRoIHRoZSBtYWluIGVkaXRvciBmb2N1c2VkLCBjb29yZHNBdFBvcyBpc1xyXG4gICAgLy8gdGhlIHJlbGlhYmxlIG9uZSAodGhlIERPTSBzZWxlY3Rpb24gY2FuIGxhZyB0aGUgZWRpdG9yIEFQSSkuXHJcbiAgICBjb25zdCBjbSA9IChlZGl0b3IgYXMgRWRpdG9yV2l0aENtKS5jbTtcclxuICAgIGxldCBjb29yZHM6IHsgbGVmdDogbnVtYmVyOyB0b3A6IG51bWJlcjsgYm90dG9tOiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xyXG4gICAgLy8gZm9jdXMgcmVzdHMgT04gdGhlIGNvbnRlbnRET00gZWxlbWVudCBpdHNlbGY7IGEgdGFibGUgY2VsbCdzXHJcbiAgICAvLyBzdWItZWRpdG9yIGhhcyBpdHMgb3duIGNvbnRlbnRET00gbmVzdGVkIGluc2lkZSB0aGUgbWFpbiBvbmUsIHNvXHJcbiAgICAvLyB0aGlzIG11c3QgYmUgYW4gaWRlbnRpdHkgY2hlY2ssIG5vdCBjb250YWlubWVudFxyXG4gICAgY29uc3QgbWFpbkVkaXRvckZvY3VzZWQgPSAhIWNtICYmIGRvYy5hY3RpdmVFbGVtZW50ID09PSBjbS5jb250ZW50RE9NO1xyXG4gICAgaWYgKCFtYWluRWRpdG9yRm9jdXNlZCkge1xyXG4gICAgICAgIGNvbnN0IHNlbCA9IHdpbi5nZXRTZWxlY3Rpb24oKTtcclxuICAgICAgICBpZiAoc2VsICYmIHNlbC5yYW5nZUNvdW50ID4gMCkge1xyXG4gICAgICAgICAgICBjb25zdCByZWN0ID0gc2VsLmdldFJhbmdlQXQoMCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgICAgIGlmIChyZWN0LmhlaWdodCA+IDApIGNvb3JkcyA9IHJlY3Q7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKCFjb29yZHMgJiYgY20pIGNvb3JkcyA9IGNtLmNvb3Jkc0F0UG9zKGNtLnN0YXRlLnNlbGVjdGlvbi5tYWluLmhlYWQpO1xyXG4gICAgY29uc3Qgd2lkdGggPSBNYXRoLm1pbig0ODAsIHdpbi5pbm5lcldpZHRoIC0gMzIpO1xyXG4gICAgY29uc3QgbGVmdCA9IE1hdGgubWF4KDE2LCBNYXRoLm1pbihjb29yZHMgPyBjb29yZHMubGVmdCA6IDEwMCwgd2luLmlubmVyV2lkdGggLSB3aWR0aCAtIDE2KSk7XHJcbiAgICBsZXQgdG9wID0gKGNvb3JkcyA/IGNvb3Jkcy5ib3R0b20gOiAxMDApICsgNjtcclxuICAgIGlmICh0b3AgKyAyNjAgPiB3aW4uaW5uZXJIZWlnaHQpIHtcclxuICAgICAgICB0b3AgPSBNYXRoLm1heCgxNiwgKGNvb3JkcyA/IGNvb3Jkcy50b3AgOiAzMDApIC0gMjY2KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb250YWluZXJFbCA9IGRvYy5ib2R5LmNyZWF0ZURpdihcImZvb3Rub3RlLXNob3J0Y3V0LXBvcHVwXCIpO1xyXG4gICAgY29udGFpbmVyRWwuc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xyXG4gICAgY29udGFpbmVyRWwuc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcclxuICAgIGNvbnRhaW5lckVsLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xyXG4gICAgLy8gc3RheSBpbnZpc2libGUgdW50aWwgdGhlIGZvb3Rub3RlIGRldGFpbCBpcyBhY3R1YWxseSBsb2FkZWRcclxuICAgIGNvbnRhaW5lckVsLmFkZENsYXNzKFwiZm9vdG5vdGUtc2hvcnRjdXQtcG9wdXAtbG9hZGluZ1wiKTtcclxuXHJcbiAgICAvLyBuYW1lIHRoZSBmb290bm90ZSBiZWluZyBlZGl0ZWQgc28gdGhlIHVzZXIgY2FuIHRlbGwgbWFya2VycyBhcGFydFxyXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRGl2KHtcclxuICAgICAgICBjbHM6IFwiZm9vdG5vdGUtc2hvcnRjdXQtcG9wdXAtbGFiZWxcIixcclxuICAgICAgICB0ZXh0OiBgW14ke2Zvb3Rub3RlSWR9XTpgLFxyXG4gICAgfSk7XHJcbiAgICBjb25zdCBlbWJlZEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KFwiZm9vdG5vdGUtc2hvcnRjdXQtcG9wdXAtZW1iZWRcIik7XHJcblxyXG4gICAgY29uc3Qgc3VicGF0aCA9IGAjW14ke2Zvb3Rub3RlSWR9XWA7XHJcbiAgICBjb25zdCBidWlsZEVtYmVkID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGJ1aWx0ID0gY3JlYXRlRW1iZWQoXHJcbiAgICAgICAgICAgIHsgYXBwOiBwbHVnaW4uYXBwLCBsaW5rdGV4dDogc3VicGF0aCwgc291cmNlUGF0aDogZmlsZS5wYXRoLCBjb250YWluZXJFbDogZW1iZWRFbCwgZGVwdGg6IDAgfSxcclxuICAgICAgICAgICAgZmlsZSxcclxuICAgICAgICAgICAgc3VicGF0aCxcclxuICAgICAgICApO1xyXG4gICAgICAgIGJ1aWx0LmVkaXRhYmxlID0gdHJ1ZTtcclxuICAgICAgICBidWlsdC5sb2FkKCk7XHJcbiAgICAgICAgcmV0dXJuIGJ1aWx0O1xyXG4gICAgfTtcclxuICAgIGxldCBlbWJlZCA9IGJ1aWxkRW1iZWQoKTtcclxuXHJcbiAgICBsZXQgY2xvc2VkID0gZmFsc2U7XHJcbiAgICBjb25zdCBjbG9zZSA9IChmb2N1c0VkaXRvcjogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgIGlmIChjbG9zZWQpIHJldHVybjtcclxuICAgICAgICBjbG9zZWQgPSB0cnVlO1xyXG4gICAgICAgIGFjdGl2ZVBvcHVwID0gbnVsbDtcclxuICAgICAgICBkb2MucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBvbkRvY01vdXNlRG93biwgdHJ1ZSk7XHJcbiAgICAgICAgY29udGFpbmVyRWwuYWRkQ2xhc3MoXCJmb290bm90ZS1zaG9ydGN1dC1wb3B1cC1jbG9zZWRcIik7XHJcbiAgICAgICAgaWYgKGZvY3VzRWRpdG9yKSB7XHJcbiAgICAgICAgICAgIC8vIGVkaXRvci5mb2N1cygpIGNhbiBzaWxlbnRseSBuby1vcCByaWdodCBhZnRlciB0aGUgcG9wdXAnc1xyXG4gICAgICAgICAgICAvLyBlbWJlZCBoZWxkIGZvY3VzIChPYnNpZGlhbidzIGZvY3VzIGJvb2trZWVwaW5nIGxhZ3MpLCBzb1xyXG4gICAgICAgICAgICAvLyBmb2N1cyB0aGUgdW5kZXJseWluZyBDb2RlTWlycm9yIHZpZXcgZGlyZWN0bHlcclxuICAgICAgICAgICAgY29uc3QgY21WaWV3ID0gKGVkaXRvciBhcyBFZGl0b3JXaXRoQ20pLmNtO1xyXG4gICAgICAgICAgICBpZiAoY21WaWV3KSBjbVZpZXcuZm9jdXMoKTtcclxuICAgICAgICAgICAgZWxzZSBlZGl0b3IuZm9jdXMoKTtcclxuXHJcbiAgICAgICAgICAgIC8vIGxhbmQgdGhlIGN1cnNvciByaWdodCBhZnRlciB0aGUgbWFya2VyIHNvIHR5cGluZyBjb250aW51ZXNcclxuICAgICAgICAgICAgLy8gc2VhbWxlc3NseSAoYSBuYW1lZCBmb290bm90ZSB3b3VsZCBvdGhlcndpc2UgbGVhdmUgaXQgaW5zaWRlXHJcbiAgICAgICAgICAgIC8vIHRoZSBicmFja2V0cyk7IHN0cmluZyBzZWFyY2gsIHNpbmNlIHRoZSBpZCBpc24ndCByZWdleC1zYWZlXHJcbiAgICAgICAgICAgIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcclxuICAgICAgICAgICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGN1cnNvci5saW5lKTtcclxuICAgICAgICAgICAgY29uc3QgbWFya2VyID0gYFteJHtmb290bm90ZUlkfV1gO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpZHggPSBsaW5lLmluZGV4T2YobWFya2VyKTsgaWR4ICE9PSAtMTsgaWR4ID0gbGluZS5pbmRleE9mKG1hcmtlciwgaWR4ICsgMSkpIHtcclxuICAgICAgICAgICAgICAgIGlmIChjdXJzb3IuY2ggPj0gaWR4ICYmIGN1cnNvci5jaCA8PSBpZHggKyBtYXJrZXIubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZWRpdG9yLnNldEN1cnNvcih7IGxpbmU6IGN1cnNvci5saW5lLCBjaDogaWR4ICsgbWFya2VyLmxlbmd0aCB9KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gdGhlIGVtYmVkIHNhdmVzIGVkaXRzIG9uIGl0cyBvd24gZGVib3VuY2U7IGxldCB0aGF0IGN5Y2xlIGZpbmlzaFxyXG4gICAgICAgIC8vIGJlZm9yZSB1bmxvYWRpbmcsIHNpbmNlIHVubG9hZGluZyBtaWQtc2F2ZSBjbGVhcnMgdGhlIHN0YXRlIHRoZVxyXG4gICAgICAgIC8vIHNhdmUgcmVhZHNcclxuICAgICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xyXG4gICAgICAgIGNvbnN0IHRlYXJkb3duID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoKGVtYmVkLmRpcnR5IHx8IGVtYmVkLnNhdmluZyB8fCBlbWJlZC5zYXZlQWdhaW4pICYmIGF0dGVtcHRzKysgPCA1MCkge1xyXG4gICAgICAgICAgICAgICAgd2luLnNldFRpbWVvdXQodGVhcmRvd24sIDEwMCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZW1iZWQudW5sb2FkKCk7XHJcbiAgICAgICAgICAgIGNvbnRhaW5lckVsLnJlbW92ZSgpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgdGVhcmRvd24oKTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3Qgb25Eb2NNb3VzZURvd24gPSAoZXZ0OiBNb3VzZUV2ZW50KSA9PiB7XHJcbiAgICAgICAgaWYgKCFjb250YWluZXJFbC5jb250YWlucyhldnQudGFyZ2V0IGFzIE5vZGUpKSBjbG9zZShmYWxzZSk7XHJcbiAgICB9O1xyXG4gICAgZG9jLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgb25Eb2NNb3VzZURvd24sIHRydWUpO1xyXG5cclxuICAgIC8vIGJ1YmJsZSBwaGFzZSwgc28gdGhlIGVtYmVkZGVkIGVkaXRvciAoZS5nLiB2aW0gbW9kZSBsZWF2aW5nIGluc2VydFxyXG4gICAgLy8gbW9kZSkgZ2V0cyBmaXJzdCBjbGFpbSBvbiBFc2NhcGVcclxuICAgIGNvbnRhaW5lckVsLmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldnQ6IEtleWJvYXJkRXZlbnQpID0+IHtcclxuICAgICAgICBpZiAoZXZ0LmtleSA9PT0gXCJFc2NhcGVcIikge1xyXG4gICAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgY2xvc2UodHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgYWN0aXZlUG9wdXAgPSB7IGNvbnRhaW5lckVsLCBjbG9zZSB9O1xyXG5cclxuICAgIGNvbnN0IHRyeVNob3cgPSBhc3luYyAoKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XHJcbiAgICAgICAgYXdhaXQgZW1iZWQubG9hZEZpbGUoKTtcclxuICAgICAgICBpZiAoZW1iZWQuc3VicGF0aE5vdEZvdW5kKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29udGFpbmVyRWwucmVtb3ZlQ2xhc3MoXCJmb290bm90ZS1zaG9ydGN1dC1wb3B1cC1sb2FkaW5nXCIpO1xyXG4gICAgICAgIGVtYmVkLnNob3dFZGl0b3IoKTtcclxuICAgICAgICBjb25zdCBpbm5lciA9IGVtYmVkLmVkaXRNb2RlPy5lZGl0b3I7XHJcbiAgICAgICAgaWYgKGlubmVyKSB7XHJcbiAgICAgICAgICAgIGlubmVyLmZvY3VzKCk7XHJcbiAgICAgICAgICAgIC8vIGN1cnNvciBhdCB0aGUgRU5EIG9mIHRoZSBkZXRhaWwgc28gdGhlIHVzZXIgY2FuIGJhY2tzcGFjZVxyXG4gICAgICAgICAgICAvLyBvciBrZWVwIHdyaXRpbmcgd2l0aG91dCByZWFjaGluZyBmb3IgdGhlIGFycm93IGtleXNcclxuICAgICAgICAgICAgaWYgKGlubmVyLmxhc3RMaW5lICYmIGlubmVyLmdldExpbmUgJiYgaW5uZXIuc2V0Q3Vyc29yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsYXN0ID0gaW5uZXIubGFzdExpbmUoKTtcclxuICAgICAgICAgICAgICAgIGlubmVyLnNldEN1cnNvcih7IGxpbmU6IGxhc3QsIGNoOiBpbm5lci5nZXRMaW5lKGxhc3QpLmxlbmd0aCB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3Qgd2FpdEZvckNhY2hlQ2hhbmdlID0gKCkgPT5cclxuICAgICAgICBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB0aW1lb3V0ID0gd2luLnNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLm9mZnJlZihyZWYpO1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9LCA1MDApO1xyXG4gICAgICAgICAgICBjb25zdCByZWYgPSBwbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZmlsZSA9PT0gbWRWaWV3LmZpbGUpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW4uY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5vZmZyZWYocmVmKTtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHNob3dFZGl0b3IgPSBhc3luYyAoKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XHJcbiAgICAgICAgaWYgKGF3YWl0IHRyeVNob3coKSkgcmV0dXJuIHRydWU7XHJcblxyXG4gICAgICAgIC8vIHJldHJ5IGFzIHRoZSBtZXRhZGF0YSBjYWNoZSBjYXRjaGVzIHVwIHdpdGggdGhlIHNhdmVkIGZpbGU7IGFcclxuICAgICAgICAvLyBsb2FkZWQgZW1iZWQgd29uJ3QgcmUtcmVzb2x2ZSBpdHMgc3VicGF0aCwgc28gcmVidWlsZCBlYWNoIHRpbWVcclxuICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyAzMDAwO1xyXG4gICAgICAgIHdoaWxlIChEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcclxuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckNhY2hlQ2hhbmdlKCk7XHJcbiAgICAgICAgICAgIGlmIChjbG9zZWQpIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICBlbWJlZC51bmxvYWQoKTtcclxuICAgICAgICAgICAgZW1iZWRFbC5lbXB0eSgpO1xyXG4gICAgICAgICAgICBlbWJlZCA9IGJ1aWxkRW1iZWQoKTtcclxuICAgICAgICAgICAgaWYgKGF3YWl0IHRyeVNob3coKSkgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcblxyXG4gICAgc2hvd0VkaXRvcigpXHJcbiAgICAgICAgLnRoZW4oKHNob3duKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghc2hvd24gJiYgIWNsb3NlZCkge1xyXG4gICAgICAgICAgICAgICAgY2xvc2UoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgb25VbmF2YWlsYWJsZT8uKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KVxyXG4gICAgICAgIC5jYXRjaCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghY2xvc2VkKSB7XHJcbiAgICAgICAgICAgICAgICBjbG9zZShmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICBvblVuYXZhaWxhYmxlPy4oKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG59XHJcbiIsImltcG9ydCB7XHJcblx0RWRpdG9yLFxyXG5cdEVkaXRvckNoYW5nZSxcclxuXHRFZGl0b3JQb3NpdGlvbixcclxuXHRNYXJrZG93blZpZXdcclxufSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmltcG9ydCBGb290bm90ZVBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcbmltcG9ydCB7IG9wZW5Gb290bm90ZVBvcHVwLCBwb3B1cEVkaXRpbmdBdmFpbGFibGUsIHRvZ2dsZUNsb3NlRm9vdG5vdGVQb3B1cCB9IGZyb20gXCIuL2Zvb3Rub3RlLXBvcHVwXCI7XHJcbmltcG9ydCB7IEVkaXRvcldpdGhDbSwgVmF1bHRXaXRoQ29uZmlnLCBXaW5kb3dXaXRoVmltIH0gZnJvbSBcIi4vb2JzaWRpYW4taW50ZXJuYWxzXCI7XHJcblxyXG5leHBvcnQgY29uc3QgQWxsTWFya2VycyA9IC9cXFtcXF4oW15bXFxdXSspXFxdKD8hOikvZztcclxuY29uc3QgQWxsTnVtYmVyZWRNYXJrZXJzID0gL1xcW1xcXihcXGQrKVxcXS9naTtcclxuY29uc3QgQWxsRGV0YWlsc05hbWVPbmx5ID0gL1xcW1xcXihbXltcXF1dKylcXF06L2c7XHJcbmNvbnN0IERldGFpbEluTGluZSA9IC9cXFtcXF4oW15bXFxdXSspXFxdOi87XHJcbmV4cG9ydCBjb25zdCBFeHRyYWN0TmFtZUZyb21Gb290bm90ZSA9IC8oXFxbXFxeKShbXltcXF1dKykoPz1cXF0pLztcclxuXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKFxyXG4gICAgZG9jOiBFZGl0b3JcclxuKSB7XHJcbiAgICBsZXQgRm9vdG5vdGVEZXRhaWxMaXN0OiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgXHJcbiAgICAvL3NlYXJjaCBlYWNoIGxpbmUgZm9yIGZvb3Rub3RlIGRldGFpbHMgYW5kIGFkZCB0byBsaXN0XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XHJcbiAgICAgICAgbGV0IHRoZUxpbmUgPSBkb2MuZ2V0TGluZShpKTtcclxuICAgICAgICBsZXQgbGluZU1hdGNoID0gdGhlTGluZS5tYXRjaChBbGxEZXRhaWxzTmFtZU9ubHkpO1xyXG4gICAgICAgIGlmIChsaW5lTWF0Y2gpIHtcclxuICAgICAgICAgICAgbGV0IHRlbXAgPSBsaW5lTWF0Y2hbMF07XHJcbiAgICAgICAgICAgIHRlbXAgPSB0ZW1wLnJlcGxhY2UoXCJbXlwiLFwiXCIpO1xyXG4gICAgICAgICAgICB0ZW1wID0gdGVtcC5yZXBsYWNlKFwiXTpcIixcIlwiKTtcclxuXHJcbiAgICAgICAgICAgIEZvb3Rub3RlRGV0YWlsTGlzdC5wdXNoKHRlbXApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBGb290bm90ZURldGFpbExpc3Q7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsaXN0RXhpc3RpbmdGb290bm90ZU1hcmtlcnNBbmRMb2NhdGlvbnMoXHJcbiAgICBkb2M6IEVkaXRvclxyXG4pIHtcclxuICAgIHR5cGUgbWFya2VyRW50cnkgPSB7XHJcbiAgICAgICAgZm9vdG5vdGU6IHN0cmluZztcclxuICAgICAgICBsaW5lTnVtOiBudW1iZXI7XHJcbiAgICAgICAgc3RhcnRJbmRleDogbnVtYmVyO1xyXG4gICAgfVxyXG4gICAgbGV0IG1hcmtlckVudHJ5O1xyXG5cclxuICAgIGxldCBGb290bm90ZU1hcmtlckluZm8gPSBbXTtcclxuICAgIC8vc2VhcmNoIGVhY2ggbGluZSBmb3IgZm9vdG5vdGUgbWFya2Vyc1xyXG4gICAgLy9mb3IgZWFjaCwgYWRkIHRoZWlyIG5hbWUsIGxpbmUgbnVtYmVyLCBhbmQgc3RhcnQgaW5kZXggdG8gRm9vdG5vdGVNYXJrZXJJbmZvXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XHJcbiAgICAgICAgbGV0IHRoZUxpbmUgPSBkb2MuZ2V0TGluZShpKTtcclxuICAgICAgICBsZXQgbGluZU1hdGNoO1xyXG5cclxuICAgICAgICB3aGlsZSAoKGxpbmVNYXRjaCA9IEFsbE1hcmtlcnMuZXhlYyh0aGVMaW5lKSkgIT0gbnVsbCkge1xyXG4gICAgICAgIG1hcmtlckVudHJ5ID0ge1xyXG4gICAgICAgICAgICBmb290bm90ZTogbGluZU1hdGNoWzBdLFxyXG4gICAgICAgICAgICBsaW5lTnVtOiBpLFxyXG4gICAgICAgICAgICBzdGFydEluZGV4OiBsaW5lTWF0Y2guaW5kZXhcclxuICAgICAgICB9XHJcbiAgICAgICAgRm9vdG5vdGVNYXJrZXJJbmZvLnB1c2gobWFya2VyRW50cnkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBGb290bm90ZU1hcmtlckluZm87XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoXHJcbiAgICBkb2M6IEVkaXRvcixcclxuICAgIG9sZEN1cnNvclBvczogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBuZXdDdXJzb3JQb3M6IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcclxuICAgIGNoYW5nZXM/OiBFZGl0b3JDaGFuZ2VbXSxcclxuKTogdm9pZCB7XHJcbiAgICAvLyB3aGVuIGZvY3VzIHNpdHMgaW4gYSBzdWItZWRpdG9yIChhIHRhYmxlIGNlbGwgYmVpbmcgZWRpdGVkIOKAlCBpdHNcclxuICAgIC8vIGNvbnRlbnRET00gaXMgbmVzdGVkIGluc2lkZSB0aGUgbWFpbiBlZGl0b3IncyksIHJldHVybiBpdCB0byB0aGUgbWFpblxyXG4gICAgLy8gZWRpdG9yIEJFRk9SRSBtb3ZpbmcgdGhlIGN1cnNvcjogYSBqdW1wIG91dCBvZiB0aGUgdGFibGUgd291bGRcclxuICAgIC8vIG90aGVyd2lzZSBsZWF2ZSBrZXlzdHJva2VzIGdvaW5nIHRvIHRoZSBhYmFuZG9uZWQgY2VsbCBlZGl0b3IsIHdoaWxlXHJcbiAgICAvLyBhIGp1bXAgaW50byBhIHRhYmxlIHJlLWFjdGl2YXRlcyBjZWxsIGVkaXRpbmcgb24gaXRzIG93blxyXG4gICAgY29uc3QgY21WaWV3ID0gKGRvYyBhcyBFZGl0b3JXaXRoQ20pLmNtO1xyXG4gICAgaWYgKGNtVmlldykge1xyXG4gICAgICAgIGNvbnN0IGFjdGl2ZSA9IGNtVmlldy5jb250ZW50RE9NLm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcclxuICAgICAgICBpZiAoYWN0aXZlICE9PSBjbVZpZXcuY29udGVudERPTSAmJiBjbVZpZXcuY29udGVudERPTS5jb250YWlucyhhY3RpdmUpKSB7XHJcbiAgICAgICAgICAgIGNtVmlldy5mb2N1cygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoY2hhbmdlcyAmJiBjaGFuZ2VzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAvLyB0ZXh0IGVkaXRzIGFuZCB0aGUgY3Vyc29yIG1vdmUgbXVzdCBnbyBvdXQgYXMgT05FIHRyYW5zYWN0aW9uOlxyXG4gICAgICAgIC8vIHdoaWxlIGEgdGFibGUgY2VsbCBpcyBiZWluZyBlZGl0ZWQgKE9ic2lkaWFuIDEuNSsgdGFibGUgZWRpdG9yKSxcclxuICAgICAgICAvLyBzZXBhcmF0ZSBkaXNwYXRjaGVzIGluIHRoZSBzYW1lIHRpY2sgcmFjZSB0aGUgY2VsbCBlZGl0b3Inc1xyXG4gICAgICAgIC8vIHN5bmMtYmFjayBhbmQgY29ycnVwdCB0aGUgZG9jdW1lbnQgKGlzc3VlICMyOCkuIGBzZWxlY3Rpb25gIGhlcmVcclxuICAgICAgICAvLyBpcyByZXNvbHZlZCBhZ2FpbnN0IHRoZSBwb3N0LWNoYW5nZSBkb2N1bWVudC5cclxuICAgICAgICBkb2MudHJhbnNhY3Rpb24oeyBjaGFuZ2VzLCBzZWxlY3Rpb246IHsgZnJvbTogbmV3Q3Vyc29yUG9zIH0gfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRvYy5zZXRDdXJzb3IobmV3Q3Vyc29yUG9zKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBpZiB1c2VyIGhhcyB2aW0gbW9kZSBlbmFibGVkLCBzZXQganVtcCBwb2ludFxyXG4gICAgLy8gZ2V0Q29uZmlnIGlzIHByaXZhdGUgQVBJLCBsaWtlIHRoZSB2aW0gaW50ZXJuYWxzIGJlbG93XHJcbiAgICBpZiAoKHBsdWdpbi5hcHAudmF1bHQgYXMgVmF1bHRXaXRoQ29uZmlnKS5nZXRDb25maWc/LihcInZpbU1vZGVcIikpIHtcclxuICAgICAgICAoYWN0aXZlV2luZG93IGFzIFdpbmRvd1dpdGhWaW0pLkNvZGVNaXJyb3JBZGFwdGVyPy5WaW0uZ2V0VmltR2xvYmFsU3RhdGVfKCkuanVtcExpc3QuYWRkKFxyXG4gICAgICAgICAgICAoZG9jIGFzIEVkaXRvcldpdGhDbSkuY20/LmNtLCAvLyBTSUMgdHdvIGxldmVscyBkZWVwXHJcbiAgICAgICAgICAgIG9sZEN1cnNvclBvcyxcclxuICAgICAgICAgICAgbmV3Q3Vyc29yUG9zLFxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIC8vIGNoZWNrIGlmIHdlJ3JlIGluIGEgZm9vdG5vdGUgZGV0YWlsIGxpbmUgKFwiW14xXTogZm9vdG5vdGVcIilcclxuICAgIC8vIGlmIHNvLCBqdW1wIGN1cnNvciBiYWNrIHRvIHRoZSBmb290bm90ZSBpbiB0aGUgdGV4dFxyXG5cclxuICAgIGxldCBtYXRjaCA9IGxpbmVUZXh0Lm1hdGNoKERldGFpbEluTGluZSk7XHJcbiAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICBsZXQgcyA9IG1hdGNoWzBdO1xyXG4gICAgICAgIGxldCBmb290bm90ZSA9IHMucmVwbGFjZShcIjpcIiwgXCJcIik7XHJcblxyXG4gICAgICAgIGxldCByZXR1cm5MaW5lSW5kZXggPSBjdXJzb3JQb3NpdGlvbi5saW5lO1xyXG4gICAgICAgIC8vIGZpbmQgdGhlIEZJUlNUIE9DQ1VSRU5DRSB3aGVyZSB0aGlzIGZvb3Rub3RlIGV4aXN0cyBpbiB0aGUgdGV4dFxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IHNjYW5MaW5lID0gZG9jLmdldExpbmUoaSk7XHJcbiAgICAgICAgICAgIGlmIChzY2FuTGluZS5jb250YWlucyhmb290bm90ZSkpIHtcclxuICAgICAgICAgICAgICAgIGxldCBjdXJzb3JMb2NhdGlvbkluZGV4ID0gc2NhbkxpbmUuaW5kZXhPZihmb290bm90ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm5MaW5lSW5kZXggPSBpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q3Vyc29yUG9zID0geyBsaW5lOiByZXR1cm5MaW5lSW5kZXgsIGNoOiBjdXJzb3JMb2NhdGlvbkluZGV4ICsgZm9vdG5vdGUubGVuZ3RoIH07XHJcbiAgICAgICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcywgcGx1Z2luKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24ganVtcFRvRm9vdG5vdGVEZXRhaWwoXHJcbiAgICBmb290bm90ZU5hbWU6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIC8vIGZpbmQgdGhlIGZpcnN0IGxpbmUgd2l0aCB0aGlzIGRldGFpbCBtYXJrZXIgbmFtZSBpbiBpdC5cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xyXG4gICAgICAgIGxldCBsaW5lTWF0Y2ggPSB0aGVMaW5lLm1hdGNoKERldGFpbEluTGluZSk7XHJcbiAgICAgICAgaWYgKGxpbmVNYXRjaCkge1xyXG4gICAgICAgICAgICAvLyBjb21wYXJlIHRvIHRoZSBpbmRleFxyXG4gICAgICAgICAgICBsZXQgbmFtZU1hdGNoID0gbGluZU1hdGNoWzFdO1xyXG4gICAgICAgICAgICBpZiAobmFtZU1hdGNoID09IGZvb3Rub3RlTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gbGFuZCBhdCB0aGUgRU5EIG9mIHRoZSBkZXRhaWwgKGluZGVudGVkIGxpbmVzIGJlbG9uZyB0b1xyXG4gICAgICAgICAgICAgICAgLy8gaXQpIHNvIHRoZSB1c2VyIGNhbiBiYWNrc3BhY2UvdHlwZSB3aXRob3V0IGFycm93IGtleXNcclxuICAgICAgICAgICAgICAgIGxldCBlbmRMaW5lID0gaTtcclxuICAgICAgICAgICAgICAgIHdoaWxlIChlbmRMaW5lIDwgZG9jLmxhc3RMaW5lKCkgJiYgL15cXHMrXFxTLy50ZXN0KGRvYy5nZXRMaW5lKGVuZExpbmUgKyAxKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBlbmRMaW5lKys7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDdXJzb3JQb3MgPSB7IGxpbmU6IGVuZExpbmUsIGNoOiBkb2MuZ2V0TGluZShlbmRMaW5lKS5sZW5ndGggfTtcclxuICAgICAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgbmV3Q3Vyc29yUG9zLCBwbHVnaW4pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRKdW1wRnJvbU1hcmtlclRvRGV0YWlsKFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIC8vIEp1bXAgY3Vyc29yIFRPIGRldGFpbCBtYXJrZXJcclxuXHJcbiAgICAvLyBkb2VzIHRoaXMgbGluZSBoYXZlIGEgZm9vdG5vdGUgbWFya2VyP1xyXG4gICAgLy8gZG9lcyB0aGUgY3Vyc29yIG92ZXJsYXAgd2l0aCBvbmUgb2YgdGhlbT9cclxuICAgIC8vIGlmIHNvLCB3aGljaCBvbmU/XHJcbiAgICAvLyBmaW5kIHRoaXMgZm9vdG5vdGUgbWFya2VyJ3MgZGV0YWlsIGxpbmVcclxuICAgIC8vIHBsYWNlIGN1cnNvciB0aGVyZVxyXG4gICAgbGV0IG1hcmtlclRhcmdldCA9IG51bGw7XHJcblxyXG4gICAgbGV0IEZvb3Rub3RlTWFya2VySW5mbyA9IGxpc3RFeGlzdGluZ0Zvb3Rub3RlTWFya2Vyc0FuZExvY2F0aW9ucyhkb2MpO1xyXG4gICAgbGV0IGN1cnJlbnRMaW5lID0gY3Vyc29yUG9zaXRpb24ubGluZTtcclxuICAgIGxldCBmb290bm90ZXNPbkxpbmUgPSBGb290bm90ZU1hcmtlckluZm8uZmlsdGVyKChtYXJrZXJFbnRyeTogeyBsaW5lTnVtOiBudW1iZXI7IH0pID0+IG1hcmtlckVudHJ5LmxpbmVOdW0gPT09IGN1cnJlbnRMaW5lKTtcclxuXHJcbiAgICBpZiAoZm9vdG5vdGVzT25MaW5lICE9IG51bGwpIHtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBmb290bm90ZXNPbkxpbmUubGVuZ3RoLTE7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZm9vdG5vdGVzT25MaW5lW2ldLmZvb3Rub3RlICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbWFya2VyID0gZm9vdG5vdGVzT25MaW5lW2ldLmZvb3Rub3RlO1xyXG4gICAgICAgICAgICAgICAgbGV0IGluZGV4T2ZNYXJrZXJJbkxpbmUgPSBmb290bm90ZXNPbkxpbmVbaV0uc3RhcnRJbmRleDtcclxuICAgICAgICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoID49IGluZGV4T2ZNYXJrZXJJbkxpbmUgJiZcclxuICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoIDw9IGluZGV4T2ZNYXJrZXJJbkxpbmUgKyBtYXJrZXIubGVuZ3RoXHJcbiAgICAgICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgIG1hcmtlclRhcmdldCA9IG1hcmtlcjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKG1hcmtlclRhcmdldCAhPT0gbnVsbCkge1xyXG4gICAgICAgIC8vIGV4dHJhY3QgbmFtZVxyXG4gICAgICAgIGxldCBtYXRjaCA9IG1hcmtlclRhcmdldC5tYXRjaChFeHRyYWN0TmFtZUZyb21Gb290bm90ZSk7XHJcbiAgICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgICAgIGxldCBmb290bm90ZU5hbWUgPSBtYXRjaFsyXTtcclxuXHJcbiAgICAgICAgICAgIC8vIG1hcmtlcnMgd2l0aG91dCBhIGRldGFpbCBsaW5lIGZhbGwgdGhyb3VnaCB0byB0aGVcclxuICAgICAgICAgICAgLy8gZGV0YWlsLWNyZWF0aW9uIHBhdGhzXHJcbiAgICAgICAgICAgIGxldCBkZXRhaWxzID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKGRvYyk7XHJcbiAgICAgICAgICAgIGlmICghZGV0YWlscy5pbmNsdWRlcyhmb290bm90ZU5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChwb3B1cEVkaXRpbmdBdmFpbGFibGUocGx1Z2luKSkge1xyXG4gICAgICAgICAgICAgICAgdm9pZCBvcGVuRm9vdG5vdGVQb3B1cChwbHVnaW4sIGZvb3Rub3RlTmFtZSwgKCkgPT5cclxuICAgICAgICAgICAgICAgICAgICBqdW1wVG9Gb290bm90ZURldGFpbChmb290bm90ZU5hbWUsIGN1cnNvclBvc2l0aW9uLCBkb2MsIHBsdWdpbilcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4ganVtcFRvRm9vdG5vdGVEZXRhaWwoZm9vdG5vdGVOYW1lLCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW4sXHJcbik6IHN0cmluZyB7XHJcbiAgICAvL2NoZWNrIGlmICdFbmFibGUgRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nJyBpcyB0cnVlXHJcbiAgICAvL2lmIHNvLCByZXR1cm4gdGhlIFwiRm9vdG5vdGUgU2VjdGlvbiBIZWFkaW5nXCJcclxuICAgIC8vIGVsc2UsIHJldHVybiBcIlwiXHJcblxyXG4gICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVGb290bm90ZVNlY3Rpb25IZWFkaW5nID09IHRydWUpIHtcclxuICAgICAgICBsZXQgcmV0dXJuSGVhZGluZyA9IHBsdWdpbi5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nO1xyXG4gICAgICAgIC8vIHRoZSBzZXR0aW5nIGhvbGRzIGxpdGVyYWwgbWFya2Rvd24gKGxlZ2FjeSBwbGFpbi10ZXh0IHZhbHVlcyBhcmVcclxuICAgICAgICAvLyBtaWdyYXRlZCBvbiBsb2FkKTsgYSBkaXZpZGVyIGRpcmVjdGx5IGJlbG93IGEgdGV4dCBsaW5lIHdvdWxkIHR1cm5cclxuICAgICAgICAvLyB0aGF0IGxpbmUgaW50byBhIHNldGV4dCBoZWFkaW5nLCBzbyBrZWVwIGEgYmxhbmsgbGluZSBpbiBiZXR3ZWVuXHJcbiAgICAgICAgY29uc3QgZGl2aWRlclJlZ2V4ID0gL14oLS0tfFxcKlxcKlxcKnxfX18pLztcclxuICAgICAgICBpZiAoZGl2aWRlclJlZ2V4LnRlc3QocmV0dXJuSGVhZGluZykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGBcXG5cXG4ke3JldHVybkhlYWRpbmd9YDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGBcXG4ke3JldHVybkhlYWRpbmd9YDtcclxuICAgIH1cclxuICAgIHJldHVybiBcIlwiO1xyXG59XHJcblxyXG4vLyBCdWlsZCAoZG9uJ3QgYXBwbHkpIHRoZSBlZGl0IHRoYXQgYXBwZW5kcyBgW15pZF06IGAgYWZ0ZXIgdGhlIGxhc3RcclxuLy8gbm9uLWJsYW5rIGxpbmUg4oCUIHRyaW1taW5nIHRyYWlsaW5nIGJsYW5rIGxpbmVzIGlmIGVuYWJsZWQsIGFuZCBhZGRpbmcgYVxyXG4vLyBibGFuayBzZXBhcmF0b3IgcGx1cyB0aGUgb3B0aW9uYWwgc2VjdGlvbiBoZWFkaW5nIGJlZm9yZSB0aGUgZmlyc3RcclxuLy8gZm9vdG5vdGUuIFJldHVybmVkIGFzIGRhdGEgc28gdGhlIGNhbGxlciBjYW4gYnVuZGxlIGl0IHdpdGggdGhlIG1hcmtlclxyXG4vLyBpbnNlcnRpb24gaW50byBhIHNpbmdsZSB0cmFuc2FjdGlvbiAoc2VlIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQpLlxyXG5mdW5jdGlvbiBidWlsZERldGFpbEFwcGVuZChcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgZm9vdG5vdGVJZDogc3RyaW5nLFxyXG4gICAgaXNGaXJzdEZvb3Rub3RlOiBib29sZWFuLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcclxuKTogeyBjaGFuZ2U6IEVkaXRvckNoYW5nZTsgY3Vyc29yOiBFZGl0b3JQb3NpdGlvbiB9IHtcclxuICAgIGxldCB0ZXh0ID0gYFxcblteJHtmb290bm90ZUlkfV06IGA7XHJcbiAgICBpZiAoaXNGaXJzdEZvb3Rub3RlKSB7XHJcbiAgICAgICAgdGV4dCA9IGFkZEZvb3Rub3RlU2VjdGlvbkhlYWRlcihwbHVnaW4pICsgXCJcXG5cIiArIHRleHQ7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGZyb21MaW5lID0gZG9jLmxhc3RMaW5lKCk7XHJcbiAgICBsZXQgdG86IEVkaXRvclBvc2l0aW9uIHwgdW5kZWZpbmVkO1xyXG4gICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5lbmFibGVSZW1vdmVCbGFua0xhc3RMaW5lcyA9PT0gdHJ1ZSkge1xyXG4gICAgICAgIHdoaWxlIChmcm9tTGluZSA+IDAgJiYgZG9jLmdldExpbmUoZnJvbUxpbmUpLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICBmcm9tTGluZS0tO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0byA9IHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiBkb2MuZ2V0TGluZShkb2MubGFzdExpbmUoKSkubGVuZ3RoIH07XHJcbiAgICB9XHJcbiAgICBjb25zdCBmcm9tID0geyBsaW5lOiBmcm9tTGluZSwgY2g6IGRvYy5nZXRMaW5lKGZyb21MaW5lKS5sZW5ndGggfTtcclxuXHJcbiAgICAvLyBjdXJzb3IgbGFuZHMgYXQgdGhlIGVuZCBvZiB0aGUgaW5zZXJ0ZWQgZGV0YWlsIGxpbmVcclxuICAgIGNvbnN0IGxpbmVzQWRkZWQgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpLmxlbmd0aCAtIDE7XHJcbiAgICBjb25zdCBjdXJzb3IgPSB7XHJcbiAgICAgICAgbGluZTogZnJvbUxpbmUgKyBsaW5lc0FkZGVkLFxyXG4gICAgICAgIGNoOiB0ZXh0Lmxlbmd0aCAtIHRleHQubGFzdEluZGV4T2YoXCJcXG5cIikgLSAxLFxyXG4gICAgfTtcclxuICAgIHJldHVybiB7IGNoYW5nZTogeyBmcm9tLCB0bywgdGV4dCB9LCBjdXJzb3IgfTtcclxufVxyXG5cclxuLyoqIGFkanVzdCBjdXJzb3IgcG9zaXRpb24gdG8gaW5zZXJ0IGEgZm9vdG5vdGUgb25seSBhdCB0aGUgZW5kIG9mIHdvcmQgKi9cclxuZnVuY3Rpb24gYWRqdXN0Rm9vdG5vdGVQb3NpdGlvbihcclxuICAgIGN1cnNvclBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgbGluZVRleHQ6IHN0cmluZyxcclxuICAgIHBsdWdpbjogRm9vdG5vdGVQbHVnaW5cclxuKSB7XHJcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5pbnNlcnRBdEVuZE9mV29yZCkgcmV0dXJuIGN1cnNvclBvc2l0aW9uO1xyXG4gICAgY29uc3QgZW5kT2ZXb3JkVW5kZXJDdXJzb3IgPSBkb2Mud29yZEF0KGN1cnNvclBvc2l0aW9uKT8udG87XHJcbiAgICBpZiAoIWVuZE9mV29yZFVuZGVyQ3Vyc29yKSByZXR1cm4gY3Vyc29yUG9zaXRpb247IC8vIG5vIHdvcmQgdW5kZXIgY3Vyc29yXHJcblxyXG4gICAgLy8gYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB0byBpbnNlcnQgYSBmb290bm90ZSBvbmx5IGF0IHRoZSBlbmQgb2Ygd29yZFxyXG4gICAgY29uc3QgbmV4dENoYXIgPSBsaW5lVGV4dC5jaGFyQXQoZW5kT2ZXb3JkVW5kZXJDdXJzb3IuY2gpO1xyXG4gICAgaWYgKFtcIi5cIiwgXCIsXCIsIFwiOlwiLCBcIjtcIl0uaW5jbHVkZXMobmV4dENoYXIpKSBlbmRPZldvcmRVbmRlckN1cnNvci5jaCsrO1xyXG4gICAgY3Vyc29yUG9zaXRpb24gPSBlbmRPZldvcmRVbmRlckN1cnNvcjtcclxuICAgIHJldHVybiBjdXJzb3JQb3NpdGlvbjtcclxufVxyXG5cclxuLy9GVU5DVElPTlMgRk9SIEFVVE9OVU1CRVJFRCBGT09UTk9URVNcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpbnNlcnRBdXRvbnVtRm9vdG5vdGUocGx1Z2luOiBGb290bm90ZVBsdWdpbikge1xyXG4gICAgLy8gcHJlc3NpbmcgdGhlIGhvdGtleSB3aGlsZSB0aGUgcG9wdXAgZWRpdG9yIGlzIG9wZW4gY2xvc2VzIGl0XHJcbiAgICBpZiAodG9nZ2xlQ2xvc2VGb290bm90ZVBvcHVwKCkpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBtZFZpZXcgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcblxyXG4gICAgaWYgKCFtZFZpZXcpIHJldHVybiBmYWxzZTtcclxuICAgIGlmIChtZFZpZXcuZWRpdG9yID09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgIGNvbnN0IGRvYyA9IG1kVmlldy5lZGl0b3I7XHJcbiAgICBjb25zdCBjdXJzb3JQb3NpdGlvbiA9IGRvYy5nZXRDdXJzb3IoKTtcclxuICAgIGNvbnN0IGxpbmVUZXh0ID0gZG9jLmdldExpbmUoY3Vyc29yUG9zaXRpb24ubGluZSk7XHJcbiAgICBjb25zdCBtYXJrZG93blRleHQgPSBtZFZpZXcuZGF0YTtcclxuXHJcbiAgICBpZiAoc2hvdWxkSnVtcEZyb21EZXRhaWxUb01hcmtlcihsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYywgcGx1Z2luKSlcclxuICAgICAgICByZXR1cm47XHJcbiAgICBpZiAoc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYywgcGx1Z2luKSlcclxuICAgICAgICByZXR1cm47XHJcblxyXG4gICAgcmV0dXJuIHNob3VsZENyZWF0ZUF1dG9udW1Gb290bm90ZShcclxuICAgICAgICBsaW5lVGV4dCxcclxuICAgICAgICBjdXJzb3JQb3NpdGlvbixcclxuICAgICAgICBwbHVnaW4sXHJcbiAgICAgICAgZG9jLFxyXG4gICAgICAgIG1hcmtkb3duVGV4dFxyXG4gICAgKTtcclxufVxyXG5cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDcmVhdGVBdXRvbnVtRm9vdG5vdGUoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpbixcclxuICAgIGRvYzogRWRpdG9yLFxyXG4gICAgbWFya2Rvd25UZXh0OiBzdHJpbmdcclxuKSB7XHJcbiAgICBjdXJzb3JQb3NpdGlvbiA9IGFkanVzdEZvb3Rub3RlUG9zaXRpb24oY3Vyc29yUG9zaXRpb24sIGRvYywgbGluZVRleHQsIHBsdWdpbik7XHJcblxyXG4gICAgLy8gY3JlYXRlIG5ldyBmb290bm90ZSB3aXRoIHRoZSBuZXh0IG51bWVyaWNhbCBpbmRleFxyXG4gICAgbGV0IG1hdGNoZXMgPSBtYXJrZG93blRleHQubWF0Y2goQWxsTnVtYmVyZWRNYXJrZXJzKTtcclxuICAgIGxldCBudW1iZXJzOiBBcnJheTxudW1iZXI+ID0gW107XHJcbiAgICBsZXQgY3VycmVudE1heCA9IDE7XHJcblxyXG4gICAgaWYgKG1hdGNoZXMgIT0gbnVsbCkge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IG1hdGNoZXMubGVuZ3RoIC0gMTsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBtYXRjaCA9IG1hdGNoZXNbaV07XHJcbiAgICAgICAgICAgIG1hdGNoID0gbWF0Y2gucmVwbGFjZShcIlteXCIsIFwiXCIpO1xyXG4gICAgICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoXCJdXCIsIFwiXCIpO1xyXG4gICAgICAgICAgICBsZXQgbWF0Y2hOdW1iZXIgPSBOdW1iZXIobWF0Y2gpO1xyXG4gICAgICAgICAgICBudW1iZXJzW2ldID0gbWF0Y2hOdW1iZXI7XHJcbiAgICAgICAgICAgIGlmIChtYXRjaE51bWJlciArIDEgPiBjdXJyZW50TWF4KSB7XHJcbiAgICAgICAgICAgICAgICBjdXJyZW50TWF4ID0gbWF0Y2hOdW1iZXIgKyAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGxldCBmb290Tm90ZUlkID0gY3VycmVudE1heDtcclxuICAgIGxldCBmb290bm90ZU1hcmtlciA9IGBbXiR7Zm9vdE5vdGVJZH1dYDtcclxuXHJcbiAgICBjb25zdCBsaXN0ID0gbGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKGRvYyk7XHJcbiAgICBjb25zdCBpc0ZpcnN0Rm9vdG5vdGUgPSBsaXN0Lmxlbmd0aCA9PT0gMCAmJiBjdXJyZW50TWF4ID09IDE7XHJcbiAgICBjb25zdCBkZXRhaWwgPSBidWlsZERldGFpbEFwcGVuZChkb2MsIFN0cmluZyhmb290Tm90ZUlkKSwgaXNGaXJzdEZvb3Rub3RlLCBwbHVnaW4pO1xyXG4gICAgY29uc3QgY2hhbmdlczogRWRpdG9yQ2hhbmdlW10gPSBbXHJcbiAgICAgICAgeyBmcm9tOiBjdXJzb3JQb3NpdGlvbiwgdGV4dDogZm9vdG5vdGVNYXJrZXIgfSxcclxuICAgICAgICBkZXRhaWwuY2hhbmdlLFxyXG4gICAgXTtcclxuXHJcbiAgICBpZiAocG9wdXBFZGl0aW5nQXZhaWxhYmxlKHBsdWdpbikpIHtcclxuICAgICAgICAvLyB0eXBlIHRoZSBkZXRhaWwgaW4gYSBwb3B1cCBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlIGJvdHRvbTtcclxuICAgICAgICAvLyB0aGUgY3Vyc29yIG9ubHkgbW92ZXMgcGFzdCB0aGUgbmV3IG1hcmtlclxyXG4gICAgICAgIGNvbnN0IGFmdGVyTWFya2VyID0geyBsaW5lOiBjdXJzb3JQb3NpdGlvbi5saW5lLCBjaDogY3Vyc29yUG9zaXRpb24uY2ggKyBmb290bm90ZU1hcmtlci5sZW5ndGggfTtcclxuICAgICAgICBkb2MudHJhbnNhY3Rpb24oeyBjaGFuZ2VzLCBzZWxlY3Rpb246IHsgZnJvbTogYWZ0ZXJNYXJrZXIgfSB9KTtcclxuICAgICAgICB2b2lkIG9wZW5Gb290bm90ZVBvcHVwKHBsdWdpbiwgU3RyaW5nKGZvb3ROb3RlSWQpLCAoKSA9PlxyXG4gICAgICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIGRldGFpbC5jdXJzb3IsIHBsdWdpbilcclxuICAgICAgICApO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIGRldGFpbC5jdXJzb3IsIHBsdWdpbiwgY2hhbmdlcyk7XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG4vL0ZVTkNUSU9OUyBGT1IgTkFNRUQgRk9PVE5PVEVTXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0TmFtZWRGb290bm90ZShwbHVnaW46IEZvb3Rub3RlUGx1Z2luKSB7XHJcbiAgICAvLyBwcmVzc2luZyB0aGUgaG90a2V5IHdoaWxlIHRoZSBwb3B1cCBlZGl0b3IgaXMgb3BlbiBjbG9zZXMgaXRcclxuICAgIGlmICh0b2dnbGVDbG9zZUZvb3Rub3RlUG9wdXAoKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG1kVmlldyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHJcbiAgICBpZiAoIW1kVmlldykgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKG1kVmlldy5lZGl0b3IgPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmVkaXRvcjtcclxuICAgIGNvbnN0IGN1cnNvclBvc2l0aW9uID0gZG9jLmdldEN1cnNvcigpO1xyXG4gICAgY29uc3QgbGluZVRleHQgPSBkb2MuZ2V0TGluZShjdXJzb3JQb3NpdGlvbi5saW5lKTtcclxuICAgIGNvbnN0IG1hcmtkb3duVGV4dCA9IG1kVmlldy5kYXRhO1xyXG5cclxuICAgIGlmIChzaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIGlmIChzaG91bGRKdW1wRnJvbU1hcmtlclRvRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jLCBwbHVnaW4pKVxyXG4gICAgICAgIHJldHVybjtcclxuXHJcbiAgICBpZiAoc2hvdWxkQ3JlYXRlTWF0Y2hpbmdGb290bm90ZURldGFpbChsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIHBsdWdpbiwgZG9jKSlcclxuICAgICAgICByZXR1cm47IFxyXG4gICAgcmV0dXJuIHNob3VsZENyZWF0ZUZvb3Rub3RlTWFya2VyKFxyXG4gICAgICAgIGxpbmVUZXh0LFxyXG4gICAgICAgIGN1cnNvclBvc2l0aW9uLFxyXG4gICAgICAgIGRvYyxcclxuICAgICAgICBtYXJrZG93blRleHQsXHJcbiAgICAgICAgcGx1Z2luXHJcbiAgICApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ3JlYXRlTWF0Y2hpbmdGb290bm90ZURldGFpbChcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBwbHVnaW46IEZvb3Rub3RlUGx1Z2luLFxyXG4gICAgZG9jOiBFZGl0b3JcclxuKSB7XHJcbiAgICAvLyBDcmVhdGUgbWF0Y2hpbmcgZm9vdG5vdGUgZGV0YWlsIGZvciBmb290bm90ZSBtYXJrZXJcclxuICAgIFxyXG4gICAgLy8gZG9lcyB0aGlzIGxpbmUgaGF2ZSBhIGZvb3Rub3RlIG1hcmtlcj9cclxuICAgIC8vIGRvZXMgdGhlIGN1cnNvciBvdmVybGFwIHdpdGggb25lIG9mIHRoZW0/XHJcbiAgICAvLyBpZiBzbywgd2hpY2ggb25lP1xyXG4gICAgLy8gZG9lcyB0aGlzIGZvb3Rub3RlIG1hcmtlciBoYXZlIGEgZGV0YWlsIGxpbmU/XHJcbiAgICAvLyBpZiBub3QsIGNyZWF0ZSBpdCBhbmQgcGxhY2UgY3Vyc29yIHRoZXJlXHJcbiAgICBsZXQgcmVPbmx5TWFya2Vyc01hdGNoZXMgPSBsaW5lVGV4dC5tYXRjaChBbGxNYXJrZXJzKTtcclxuXHJcbiAgICBsZXQgbWFya2VyVGFyZ2V0ID0gbnVsbDtcclxuXHJcbiAgICBpZiAocmVPbmx5TWFya2Vyc01hdGNoZXMpe1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IHJlT25seU1hcmtlcnNNYXRjaGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBtYXJrZXIgPSByZU9ubHlNYXJrZXJzTWF0Y2hlc1tpXTtcclxuICAgICAgICAgICAgaWYgKG1hcmtlciAhPSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGxldCBpbmRleE9mTWFya2VySW5MaW5lID0gbGluZVRleHQuaW5kZXhPZihtYXJrZXIpO1xyXG4gICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoID49IGluZGV4T2ZNYXJrZXJJbkxpbmUgJiZcclxuICAgICAgICAgICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA8PSBpbmRleE9mTWFya2VySW5MaW5lICsgbWFya2VyLmxlbmd0aFxyXG4gICAgICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWFya2VyVGFyZ2V0ID0gbWFya2VyO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChtYXJrZXJUYXJnZXQgIT0gbnVsbCkge1xyXG4gICAgICAgIC8vZXh0cmFjdCBmb290bm90ZVxyXG4gICAgICAgIGxldCBtYXRjaCA9IG1hcmtlclRhcmdldC5tYXRjaChFeHRyYWN0TmFtZUZyb21Gb290bm90ZSlcclxuICAgICAgICAvL2ZpbmQgaWYgdGhpcyBmb290bm90ZSBleGlzdHMgYnkgbGlzdGluZyBleGlzdGluZyBmb290bm90ZSBkZXRhaWxzXHJcbiAgICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgICAgIGxldCBmb290bm90ZUlkID0gbWF0Y2hbMl07XHJcblxyXG4gICAgICAgICAgICBsZXQgbGlzdDogc3RyaW5nW10gPSBsaXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoZG9jKTtcclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBsaXN0IGRvZXNuJ3QgaW5jbHVkZSBjdXJyZW50IGZvb3Rub3RlXHJcbiAgICAgICAgICAgIC8vIGlmIHNvLCBhZGQgZGV0YWlsIGZvciB0aGUgY3VycmVudCBmb290bm90ZVxyXG4gICAgICAgICAgICBpZighbGlzdC5pbmNsdWRlcyhmb290bm90ZUlkKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGV0YWlsID0gYnVpbGREZXRhaWxBcHBlbmQoZG9jLCBmb290bm90ZUlkLCBsaXN0Lmxlbmd0aCA9PT0gMCwgcGx1Z2luKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAocG9wdXBFZGl0aW5nQXZhaWxhYmxlKHBsdWdpbikpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyB0eXBlIHRoZSBkZXRhaWwgaW4gYSBwb3B1cCBpbnN0ZWFkIG9mIGp1bXBpbmcgdG8gdGhlXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gYm90dG9tOyB0aGUgY3Vyc29yIHN0YXlzIG9uIHRoZSBtYXJrZXJcclxuICAgICAgICAgICAgICAgICAgICBkb2MudHJhbnNhY3Rpb24oeyBjaGFuZ2VzOiBbZGV0YWlsLmNoYW5nZV0gfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdm9pZCBvcGVuRm9vdG5vdGVQb3B1cChwbHVnaW4sIGZvb3Rub3RlSWQsICgpID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgZGV0YWlsLmN1cnNvciwgcGx1Z2luKVxyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG1vdmVDdXJzb3JBbmRTZXRKdW1wUG9pbnQoZG9jLCBjdXJzb3JQb3NpdGlvbiwgZGV0YWlsLmN1cnNvciwgcGx1Z2luLCBbZGV0YWlsLmNoYW5nZV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDcmVhdGVGb290bm90ZU1hcmtlcihcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBkb2M6IEVkaXRvcixcclxuICAgIG1hcmtkb3duVGV4dDogc3RyaW5nLFxyXG4gICAgcGx1Z2luOiBGb290bm90ZVBsdWdpblxyXG4pIHtcclxuICAgIGN1cnNvclBvc2l0aW9uID0gYWRqdXN0Rm9vdG5vdGVQb3NpdGlvbihjdXJzb3JQb3NpdGlvbiwgZG9jLCBsaW5lVGV4dCwgcGx1Z2luKTtcclxuXHJcbiAgICAvL2NyZWF0ZSBlbXB0eSBmb290bm90ZSBtYXJrZXIgZm9yIG5hbWUgaW5wdXQsIGN1cnNvciBpbiBiZXR3ZWVuIFteIGFuZCBdXHJcbiAgICBsZXQgZW1wdHlNYXJrZXIgPSBgW15dYDtcclxuICAgIGNvbnN0IG5ld0N1cnNvclBvcyA9IHsgbGluZTogY3Vyc29yUG9zaXRpb24ubGluZSwgY2g6IGN1cnNvclBvc2l0aW9uLmNoICsgMiB9XHJcbiAgICBtb3ZlQ3Vyc29yQW5kU2V0SnVtcFBvaW50KGRvYywgY3Vyc29yUG9zaXRpb24sIG5ld0N1cnNvclBvcywgcGx1Z2luLCBbXHJcbiAgICAgICAgeyBmcm9tOiBjdXJzb3JQb3NpdGlvbiwgdGV4dDogZW1wdHlNYXJrZXIgfSxcclxuICAgIF0pXHJcbn1cclxuIiwiaW1wb3J0IHtcclxuICBhZGRJY29uLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBQbHVnaW5cclxufSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmltcG9ydCB7IEZvb3Rub3RlUGx1Z2luU2V0dGluZ1RhYiwgRm9vdG5vdGVQbHVnaW5TZXR0aW5ncywgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XHJcbmltcG9ydCB7IGRpc21pc3NGb290bm90ZVBvcHVwIH0gZnJvbSBcIi4vZm9vdG5vdGUtcG9wdXBcIjtcclxuaW1wb3J0IHsgaW5zZXJ0QXV0b251bUZvb3Rub3RlLGluc2VydE5hbWVkRm9vdG5vdGUgfSBmcm9tIFwiLi9pbnNlcnQtb3ItbmF2aWdhdGUtZm9vdG5vdGVzXCI7XHJcblxyXG4vL0FkZCBjaGV2cm9uLXVwLXNxdWFyZSBpY29uIGZyb20gbHVjaWRlIGZvciBtb2JpbGUgdG9vbGJhciAodGVtcG9yYXJ5IHVudGlsIE9ic2lkaWFuIHVwZGF0ZXMgdG8gTHVjaWRlIHYwLjEzMC4wKVxyXG5hZGRJY29uKFwiY2hldnJvbi11cC1zcXVhcmVcIiwgYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBjbGFzcz1cImx1Y2lkZSBsdWNpZGUtY2hldnJvbi11cC1zcXVhcmVcIj48cmVjdCB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB4PVwiM1wiIHk9XCIzXCIgcng9XCIyXCIgcnk9XCIyXCI+PC9yZWN0Pjxwb2x5bGluZSBwb2ludHM9XCI4LDE0IDEyLDEwIDE2LDE0XCI+PC9wb2x5bGluZT48L3N2Zz5gKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvb3Rub3RlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICBwdWJsaWMgc2V0dGluZ3MhOiBGb290bm90ZVBsdWdpblNldHRpbmdzO1xyXG5cclxuICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImluc2VydC1hdXRvbnVtYmVyZWQtZm9vdG5vdGVcIixcclxuICAgICAgbmFtZTogXCJJbnNlcnQgLyBuYXZpZ2F0ZSBhdXRvLW51bWJlcmVkIGZvb3Rub3RlXCIsXHJcbiAgICAgIGljb246IFwicGx1cy1zcXVhcmVcIixcclxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgaWYgKGNoZWNraW5nKVxyXG4gICAgICAgICAgcmV0dXJuICEhdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgICAgICBpbnNlcnRBdXRvbnVtRm9vdG5vdGUodGhpcyk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImluc2VydC1uYW1lZC1mb290bm90ZVwiLFxyXG4gICAgICBuYW1lOiBcIkluc2VydCAvIG5hdmlnYXRlIG5hbWVkIGZvb3Rub3RlXCIsXHJcbiAgICAgIGljb246IFwiY2hldnJvbi11cC1zcXVhcmVcIixcclxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgaWYgKGNoZWNraW5nKVxyXG4gICAgICAgICAgcmV0dXJuICEhdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgICAgICBpbnNlcnROYW1lZEZvb3Rub3RlKHRoaXMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICBcclxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgRm9vdG5vdGVQbHVnaW5TZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxyXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJhY3RpdmUtbGVhZi1jaGFuZ2VcIiwgKCkgPT4gZGlzbWlzc0Zvb3Rub3RlUG9wdXAoKSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBvbnVubG9hZCgpIHtcclxuICAgIGRpc21pc3NGb290bm90ZVBvcHVwKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XHJcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbihcclxuICAgICAge30sXHJcbiAgICAgIERFRkFVTFRfU0VUVElOR1MsXHJcbiAgICAgIChhd2FpdCB0aGlzLmxvYWREYXRhKCkpIGFzIFBhcnRpYWw8Rm9vdG5vdGVQbHVnaW5TZXR0aW5ncz4gfCBudWxsLFxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBtaWdyYXRlIHByZS0xLjAuNCBzZWN0aW9uIGhlYWRpbmcgdmFsdWVzOiB0aGUgb2xkIHRleHQgaW5wdXQgaW1wbGllZFxyXG4gICAgLy8gYW4gSDEsIHRoZSB0ZXh0YXJlYSB0YWtlcyBsaXRlcmFsIG1hcmtkb3duLCBzbyBjb252ZXJ0IG9uY2UgYW5kIHNhdmVcclxuICAgIGNvbnN0IGhlYWRpbmcgPSB0aGlzLnNldHRpbmdzLkZvb3Rub3RlU2VjdGlvbkhlYWRpbmc7XHJcbiAgICBpZiAoaGVhZGluZyAmJiAhL14oI3sxLDZ9IHwtLS18XFwqXFwqXFwqfF9fXykvLnRlc3QoaGVhZGluZykpIHtcclxuICAgICAgdGhpcy5zZXR0aW5ncy5Gb290bm90ZVNlY3Rpb25IZWFkaW5nID0gYCMgJHtoZWFkaW5nfWA7XHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZHJvcCB0aGUgc2V0dGluZyBmb3IgdGhlIHJlbW92ZWQgYXV0b3N1Z2dlc3QgZmVhdHVyZSAoT2JzaWRpYW4gbm93XHJcbiAgICAvLyBzdWdnZXN0cyBmb290bm90ZXMgbmF0aXZlbHkpXHJcbiAgICBpZiAoXCJlbmFibGVBdXRvU3VnZ2VzdFwiIGluIHRoaXMuc2V0dGluZ3MpIHtcclxuICAgICAgZGVsZXRlICh0aGlzLnNldHRpbmdzIGFzIHsgZW5hYmxlQXV0b1N1Z2dlc3Q/OiBib29sZWFuIH0pLmVuYWJsZUF1dG9TdWdnZXN0O1xyXG4gICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xyXG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICB9XHJcbn0iXSwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJNYXJrZG93blZpZXciLCJhZGRJY29uIiwiUGx1Z2luIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQW9HQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDdEcsUUFBUSxTQUFTLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFDdEgsUUFBUSxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDOUUsS0FBSyxDQUFDLENBQUM7QUFDUCxDQUFDO0FBNk1EO0FBQ3VCLE9BQU8sZUFBZSxLQUFLLFVBQVUsR0FBRyxlQUFlLEdBQUcsVUFBVSxLQUFLLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRTtBQUN2SCxJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksS0FBSyxD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
