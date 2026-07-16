import { MarkdownView, Notice } from "obsidian";

import FootnotePlugin from "./main";
import { AppWithEmbedRegistry, EditorWithCm } from "./obsidian-internals";

// A small popup anchored at the cursor containing Obsidian's own editable
// markdown embed, bound to just the footnote's detail via the `#[^id]`
// subpath (the same machinery the core Footnotes view uses). Editing in the
// popup saves straight back to the detail line at the bottom of the note,
// so the user's cursor never has to leave the text.

type ActivePopup = {
    close: (focusEditor: boolean) => void;
};

let activePopup: ActivePopup | null = null;

// Resolves once no closed popup still has file work in flight. A closed
// popup legitimately saves the user's typed detail on a debounce — but that
// save writes the file as the EMBED knew it, so any document edit made
// before it lands gets clobbered, and the conflict reload dumps the cursor
// at the top of the note (regression, reported 2026-07-16). Commands that
// edit the document await this before touching anything.
let pendingTeardown: Promise<void> | null = null;

export function whenFootnotePopupSettled(): Promise<void> {
    return pendingTeardown ?? Promise.resolve();
}

/**
 * whenFootnotePopupSettled, plus user feedback: when the wait is long
 * enough to feel like a dropped keypress, a notice explains what's
 * happening and clears the moment the command proceeds. The keypress is
 * never discarded — it runs as soon as the pending save has landed.
 */
export async function settleFootnotePopupWithFeedback(): Promise<void> {
    if (!pendingTeardown) return;
    // holder object: the assignment happens inside the timer callback,
    // which TypeScript's narrowing can't see through on a plain variable
    const feedback: { notice: Notice | null } = { notice: null };
    const noticeTimer = window.setTimeout(() => {
        feedback.notice = new Notice("Saving the previous footnote…", 0);
    }, 150);
    try {
        while (pendingTeardown !== null) {
            await pendingTeardown;
        }
    } finally {
        window.clearTimeout(noticeTimer);
        feedback.notice?.hide();
    }
}

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

    // Register the popup handle BEFORE the first await: a hotkey press
    // during this async setup must toggle-close THIS pending popup, not
    // start a second one whose file saves race this one's — rapid
    // consecutive footnotes used to lose the later markers exactly that
    // way (regression, reported 2026-07-16). Until the DOM exists, closing
    // just abandons the setup (the awaits below re-check `closed`).
    let closed = false;
    let domTeardown: ((focusEditor: boolean) => void) | null = null;

    const focusMainEditor = () => {
        // editor.focus() can silently no-op right after the popup's embed
        // held focus (Obsidian's focus bookkeeping lags), so focus the
        // underlying CodeMirror view directly
        const cmView = (editor as EditorWithCm).cm;
        if (cmView) cmView.focus();
        else editor.focus();
    };
    // land the cursor right after the marker so typing continues seamlessly
    // (a named footnote would otherwise leave it inside the brackets);
    // string search, since the id isn't regex-safe
    const placeCursorAfterMarker = () => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const marker = `[^${footnoteId}]`;
        for (let idx = line.indexOf(marker); idx !== -1; idx = line.indexOf(marker, idx + 1)) {
            if (cursor.ch >= idx && cursor.ch <= idx + marker.length) {
                editor.setCursor({ line: cursor.line, ch: idx + marker.length });
                break;
            }
        }
    };
    const close = (focusEditor: boolean) => {
        if (closed) return;
        closed = true;
        activePopup = null;
        if (domTeardown) {
            domTeardown(focusEditor);
        } else if (focusEditor) {
            focusMainEditor();
            placeCursorAfterMarker();
        }
    };
    activePopup = { close };

    const detailToken = `[^${footnoteId}]:`;
    const dataDeadline = Date.now() + 2000;
    // the data buffer usually catches up within a tick — check again almost
    // immediately before falling back to coarse 50ms polls, so the popup
    // doesn't spend a blind 50ms on what is typically a ~1ms wait
    let pollDelay = 0;
    while (!closed && !mdView.data.includes(detailToken) && Date.now() < dataDeadline) {
        await new Promise((resolve) => win.setTimeout(resolve, pollDelay));
        pollDelay = pollDelay === 0 ? 10 : 50;
    }
    if (closed) return;
    // the embed reads the FILE, so unsaved view changes must be written
    // first — but only when the view actually differs from disk; a
    // per-popup unconditional save is disk latency plus Syncthing churn
    if (mdView.data !== (await plugin.app.vault.cachedRead(file))) {
        await mdView.save();
    }
    if (closed) return;

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
    const anchor = {
        left: coords ? coords.left : 100,
        top: coords ? coords.top : 100,
        bottom: coords ? coords.bottom : 100,
    };
    const width = Math.min(480, win.innerWidth - 32);
    const left = Math.max(16, Math.min(anchor.left, win.innerWidth - width - 16));

    const containerEl = doc.body.createDiv("footnote-shortcut-popup");
    containerEl.setCssProps({
        left: `${left}px`,
        top: `${anchor.bottom + 6}px`,
        width: `${width}px`,
    });

    // keep the popup tight against the caret: just below it, or just above
    // when there isn't room underneath. The real height is only known once
    // the embed renders — and changes as the user types — so re-anchor on
    // every size change instead of reserving worst-case space up front
    // (which used to strand the popup far above a caret near the bottom).
    // When flipped above, the bottom edge stays pinned so growth goes up.
    // tryShow calls this directly too: observer callbacks ride the render
    // loop, which stalls entirely while the window is hidden/occluded.
    const positionPopup = () => {
        const height = containerEl.offsetHeight;
        let top = anchor.bottom + 6;
        if (top + height > win.innerHeight - 8) {
            top = Math.max(8, anchor.top - 6 - height);
        }
        containerEl.setCssProps({ top: `${top}px` });
    };
    const resizeObserver = new win.ResizeObserver(positionPopup);
    resizeObserver.observe(containerEl);
    // stay invisible until the footnote detail is actually loaded
    containerEl.addClass("footnote-shortcut-popup-loading");

    // name the footnote being edited so the user can tell markers apart
    containerEl.createDiv({
        cls: "footnote-shortcut-popup-label",
        text: `[^${footnoteId}]:`,
    });
    const embedEl = containerEl.createDiv("footnote-shortcut-popup-embed");

    // footnote labels are case-insensitive markdown, and the metadata cache
    // stores their ids lowercased — a subpath in the marker's original
    // casing (e.g. "[^arXiv:…]") resolves to nothing (issue #50's popup
    // half: the popup silently degraded to the legacy jump)
    const subpath = `#[^${footnoteId.toLowerCase()}]`;
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

    const onDocMouseDown = (evt: MouseEvent) => {
        const target = evt.target as HTMLElement;
        if (containerEl.contains(target)) return;
        // taps that launch a command (mobile navbar/toolbar, command
        // palette, ribbon) must not dismiss the popup: on mobile they're
        // the only way to press the footnote "hotkey", and closing here
        // would strand the cursor instead of letting the command's toggle
        // path return it to the text
        if (target.closest(".mobile-navbar, .mobile-toolbar, .modal-container, .prompt, .workspace-ribbon")) {
            return;
        }
        close(false);
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

    // from here on, closing must also tear the DOM and the embed down
    domTeardown = (focusEditor: boolean) => {
        resizeObserver.disconnect();
        doc.removeEventListener("mousedown", onDocMouseDown, true);
        containerEl.addClass("footnote-shortcut-popup-closed");
        if (focusEditor) {
            focusMainEditor();
            placeCursorAfterMarker();
        }

        // block document edits until the typed detail has fully landed
        // (whenFootnotePopupSettled) so the save can't clobber them
        let settle: () => void;
        pendingTeardown = new Promise<void>((resolve) => {
            settle = resolve;
        });
        void (async () => {
            // the embed saves edits on its own DEBOUNCE (1-2s); flush the
            // save NOW and await its exact completion — this wait gates the
            // next footnote command, so every millisecond here is felt when
            // creating consecutive footnotes rapidly
            try {
                if (embed.dirty && !embed.saving) await embed.save?.();
            } catch {
                // fall through — the polling below is the safety net
            }
            // safety net for saves the flush didn't cover (saveAgain, a
            // save already in flight); usually clears on the first check.
            // Unloading mid-save clears the state the save reads.
            let attempts = 0;
            const teardown = () => {
                if ((embed.dirty || embed.saving || embed.saveAgain) && attempts++ < 160) {
                    win.setTimeout(teardown, 30);
                    return;
                }
                embed.unload();
                containerEl.remove();
                // one beat for Obsidian to reconcile the written file into
                // the main view before anyone edits it (a timeout on
                // purpose: rAF stalls entirely while the window is hidden)
                win.setTimeout(() => {
                    pendingTeardown = null;
                    settle();
                }, 50);
            };
            teardown();
        })();
    };

    const tryShow = async (): Promise<boolean> => {
        await embed.loadFile();
        if (embed.subpathNotFound) return false;
        containerEl.removeClass("footnote-shortcut-popup-loading");
        embed.showEditor();
        positionPopup();
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
