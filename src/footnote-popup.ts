import { MarkdownView } from "obsidian";

import FootnotePlugin from "./main";
import { AppWithEmbedRegistry, EditorWithCm } from "./obsidian-internals";

// A small popup anchored at the cursor containing Obsidian's own editable
// markdown embed, bound to just the footnote's detail via the `#[^id]`
// subpath (the same machinery the core Footnotes view uses). Editing in the
// popup saves straight back to the detail line at the bottom of the note,
// so the user's cursor never has to leave the text.

type ActivePopup = {
    containerEl: HTMLElement;
    close: (focusEditor: boolean) => void;
};

let activePopup: ActivePopup | null = null;

export function popupEditingAvailable(plugin: FootnotePlugin): boolean {
    // embedRegistry is undocumented API, so degrade to the legacy
    // jump-to-bottom behavior if it ever changes shape
    const registry = (plugin.app as AppWithEmbedRegistry).embedRegistry;
    return plugin.settings.enablePopupEditor === true
        && typeof registry?.embedByExtension?.md === "function";
}

// Close from the footnote hotkey; returns whether a popup was open, so the
// hotkey can toggle the popup instead of inserting another footnote.
export function toggleCloseFootnotePopup(): boolean {
    if (activePopup) {
        activePopup.close(true);
        return true;
    }
    return false;
}

// Close without stealing focus (leaf switched, plugin unloading).
export function dismissFootnotePopup() {
    if (activePopup) {
        activePopup.close(false);
    }
}

export async function openFootnotePopup(
    plugin: FootnotePlugin,
    footnoteId: string,
    onUnavailable?: () => void,
) {
    dismissFootnotePopup();

    const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView || !mdView.file) return;

    // callers gate on popupEditingAvailable, but re-check so a registry
    // shape change degrades to the legacy jump instead of throwing
    const createEmbed = (plugin.app as AppWithEmbedRegistry).embedRegistry?.embedByExtension?.md;
    if (!createEmbed) {
        onUnavailable?.();
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
        await new Promise((resolve) => win.setTimeout(resolve, 50));
    }
    await mdView.save();

    // anchor just below the cursor, flipping above it near the window bottom.
    // When focus is in a sub-editor (a table cell being edited), the main
    // editor's coordsAtPos only knows the table widget's edge — which pins
    // the popup to the screen border — while the sub-editor's DOM selection
    // tracks the real caret. With the main editor focused, coordsAtPos is
    // the reliable one (the DOM selection can lag the editor API).
    const cm = (editor as EditorWithCm).cm;
    let coords: { left: number; top: number; bottom: number } | null = null;
    // focus rests ON the contentDOM element itself; a table cell's
    // sub-editor has its own contentDOM nested inside the main one, so
    // this must be an identity check, not containment
    const mainEditorFocused = !!cm && doc.activeElement === cm.contentDOM;
    if (!mainEditorFocused) {
        const sel = win.getSelection();
        if (sel && sel.rangeCount > 0) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            if (rect.height > 0) coords = rect;
        }
    }
    if (!coords && cm) coords = cm.coordsAtPos(cm.state.selection.main.head);
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
        const built = createEmbed(
            { app: plugin.app, linktext: subpath, sourcePath: file.path, containerEl: embedEl, depth: 0 },
            file,
            subpath,
        );
        built.editable = true;
        built.load();
        return built;
    };
    let embed = buildEmbed();

    let closed = false;
    const close = (focusEditor: boolean) => {
        if (closed) return;
        closed = true;
        activePopup = null;
        doc.removeEventListener("mousedown", onDocMouseDown, true);
        containerEl.addClass("footnote-shortcut-popup-closed");
        if (focusEditor) {
            // editor.focus() can silently no-op right after the popup's
            // embed held focus (Obsidian's focus bookkeeping lags), so
            // focus the underlying CodeMirror view directly
            const cmView = (editor as EditorWithCm).cm;
            if (cmView) cmView.focus();
            else editor.focus();

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

    const onDocMouseDown = (evt: MouseEvent) => {
        if (!containerEl.contains(evt.target as Node)) close(false);
    };
    doc.addEventListener("mousedown", onDocMouseDown, true);

    // bubble phase, so the embedded editor (e.g. vim mode leaving insert
    // mode) gets first claim on Escape
    containerEl.addEventListener("keydown", (evt: KeyboardEvent) => {
        if (evt.key === "Escape") {
            evt.preventDefault();
            close(true);
        }
    });

    activePopup = { containerEl, close };

    const tryShow = async (): Promise<boolean> => {
        await embed.loadFile();
        if (embed.subpathNotFound) return false;
        containerEl.removeClass("footnote-shortcut-popup-loading");
        embed.showEditor();
        const inner = embed.editMode?.editor;
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
    };

    const waitForCacheChange = () =>
        new Promise<void>((resolve) => {
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

    const showEditor = async (): Promise<boolean> => {
        if (await tryShow()) return true;

        // retry as the metadata cache catches up with the saved file; a
        // loaded embed won't re-resolve its subpath, so rebuild each time
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
            await waitForCacheChange();
            if (closed) return true;
            embed.unload();
            embedEl.empty();
            embed = buildEmbed();
            if (await tryShow()) return true;
        }
        return false;
    };

    showEditor()
        .then((shown) => {
            if (!shown && !closed) {
                close(false);
                onUnavailable?.();
            }
        })
        .catch(() => {
            if (!closed) {
                close(false);
                onUnavailable?.();
            }
        });
}
