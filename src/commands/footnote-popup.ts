import { MarkdownView, Notice } from "obsidian";

import type FootnotePlugin from "../main";
import { AppWithEmbedRegistry, EditorWithCm } from "../editor/obsidian-internals";

// A small popup anchored at the cursor containing Obsidian's own editable
// markdown embed, bound to just the footnote's definition via the `#[^id]`
// subpath (the same machinery the core Footnotes view uses). Editing in the
// popup saves straight back to the definition line at the bottom of the note,
// so the user's cursor never has to leave the text.

type ActivePopup = {
    close: (focusEditor: boolean) => void;
};

let activePopup: ActivePopup | null = null;

// Resolves once no closed popup still has file work in flight. A closed
// popup legitimately saves the user's typed definition on a debounce — but that
// save writes the file as the EMBED knew it, so any document edit made
// before it lands gets clobbered, and the conflict reload dumps the cursor
// at the top of the note (regression, reported 2026-07-16). Commands that
// edit the document await this before touching anything.
let pendingTeardown: Promise<void> | null = null;

/** Whether a popup is open or a closed one's save is still in flight — automatic edits must stay away while true. */
export function footnotePopupBusy(): boolean {
    return activePopup !== null || pendingTeardown !== null;
}

/**
 * Await any pending teardown, plus user feedback: when the wait is long
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
        // re-read through a function each pass: the awaited teardown can
        // chain a successor into pendingTeardown, which the checker's
        // narrowing of the module variable (from the guard above) can't see
        const currentTeardown = () => pendingTeardown;
        for (let t = currentTeardown(); t !== null; t = currentTeardown()) {
            await t;
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
    return plugin.settings.enablePopupEditor
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
    if (!mdView || !mdView.file) {
        // same degradation as a missing registry: without the fallback the
        // caller's jump and its deferred creation lint would strand, and an
        // armed after-settle callback would later fire against a stale path
        // (2026-08-11 review bug #13)
        onUnavailable?.();
        return;
    }

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

    // a just-inserted definition is only indexed once the file saves — but
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
    // consecutive footnotes used to lose the later references exactly that
    // way (regression, reported 2026-07-16). Until the DOM exists, closing
    // just abandons the setup. `close` flips the flag from event handlers
    // during the awaits below, which the checker's narrowing can't see —
    // so every re-check reads through popupClosed() (call results are
    // never narrowed).
    let closed = false;
    const popupClosed = () => closed;
    let domTeardown: ((focusEditor: boolean) => void) | null = null;

    const focusMainEditor = () => {
        // editor.focus() can silently no-op right after the popup's embed
        // held focus (Obsidian's focus bookkeeping lags), so focus the
        // underlying CodeMirror view directly
        const cmView = (editor as EditorWithCm).cm;
        if (cmView) cmView.focus();
        else editor.focus();
    };
    // land the cursor right after the reference so the user can keep typing
    // the sentence (a named footnote would otherwise leave it inside the
    // brackets);
    // string search, since the id isn't regex-safe
    const placeCursorAfterReference = () => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const reference = `[^${footnoteId}]`;
        for (let idx = line.indexOf(reference); idx !== -1; idx = line.indexOf(reference, idx + 1)) {
            if (cursor.ch >= idx && cursor.ch <= idx + reference.length) {
                editor.setCursor({ line: cursor.line, ch: idx + reference.length });
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
            placeCursorAfterReference();
        }
    };
    activePopup = { close };

    const dataDeadline = Date.now() + 2000;
    // the data buffer usually catches up within a tick — check again almost
    // immediately before falling back to coarse 50ms polls, so the popup
    // doesn't spend a blind 50ms on what is typically a ~1ms wait.
    // EQUALITY with the editor, not the old "[^id]:" substring search:
    // definition-shaped text in a code span (the A8 sheet's own
    // "`[^name]: …`" checkbox line) matched the STALE buffer instantly,
    // the save below was then skipped (stale buffer still equal to disk),
    // and the popup sat invisible ~2s until Obsidian's debounced autosave
    // finally wrote the new definition for the embed to find — or died to
    // the jump fallback when the retry deadline ran out first (Jason's
    // report 2026-08-26, ground-truthed with a live gesture watcher)
    let pollDelay = 0;
    while (!popupClosed() && mdView.data !== editor.getValue() && Date.now() < dataDeadline) {
        await new Promise((resolve) => win.setTimeout(resolve, pollDelay));
        pollDelay = pollDelay === 0 ? 10 : 50;
    }
    if (popupClosed()) return;
    // the embed reads the FILE, so unsaved view changes must be written
    // first — but only when the view actually differs from disk; a
    // per-popup unconditional save is disk latency plus Syncthing churn
    if (mdView.data !== (await plugin.app.vault.cachedRead(file))) {
        await mdView.save();
    }
    if (popupClosed()) return;

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
    // stay invisible until the footnote definition is actually loaded
    containerEl.addClass("footnote-shortcut-popup-loading");

    // name the footnote being edited so the user can tell references apart
    containerEl.createDiv({
        cls: "footnote-shortcut-popup-label",
        text: `[^${footnoteId}]:`,
    });
    const embedEl = containerEl.createDiv("footnote-shortcut-popup-embed");

    // footnote labels are case-insensitive markdown, and the metadata cache
    // stores their ids lowercased — a subpath in the reference's original
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

    // CAPTURE phase, reading the vim state directly: the embedded editor
    // preventDefaults EVERY Escape (not just vim's), so the old bubble-
    // phase defaultPrevented check never closed the popup at all —
    // regression from the E28 cleanup, caught by the A3 manual pass
    // (2026-08-13). E28's actual rule survives by asking vim itself: an
    // editor still in INSERT mode keeps the key (leaving insert must not
    // also close); anything else means "close me".
    containerEl.addEventListener(
        "keydown",
        (evt: KeyboardEvent) => {
            if (evt.key !== "Escape") return;
            const inner = embed.editMode?.editor as EditorWithCm | undefined;
            if (inner?.cm?.cm?.state?.vim?.insertMode) return;
            evt.preventDefault();
            evt.stopPropagation();
            close(true);
        },
        true,
    );

    // from here on, closing must also tear the DOM and the embed down
    domTeardown = (focusEditor: boolean) => {
        resizeObserver.disconnect();
        doc.removeEventListener("mousedown", onDocMouseDown, true);
        // OUT of the document immediately, not just hidden: the embed's
        // inline editor stays live while its save settles (up to ~5s), and
        // keystrokes from someone already typing the NEXT footnote landed
        // in it — appending to the WRONG definition and re-arming the
        // embed's debounced save, which then fired against the unloaded
        // embed's cleared state ("Cannot read properties of undefined
        // (reading 'split')" — reported and repro'd 2026-08-13). The
        // detached embed still saves fine; only input reachability changes.
        containerEl.remove();
        if (focusEditor) {
            focusMainEditor();
            placeCursorAfterReference();
        }

        // block document edits until the typed definition has fully landed
        // (settleFootnotePopupWithFeedback) so the save can't clobber them
        let settle: () => void;
        const teardownPromise = new Promise<void>((resolve) => {
            settle = resolve;
        });
        pendingTeardown = teardownPromise;
        void (async () => {
            // the embed saves edits on its own DEBOUNCE (1-2s); flush the
            // save NOW and await its exact completion — this wait gates the
            // next footnote command, so every millisecond here is felt when
            // creating consecutive footnotes rapidly. The flush passes the
            // inline editor's CURRENT text and write=true (see the save
            // signature note in obsidian-internals): the old argless call
            // made set(undefined) throw and poisoned embed.text, so the
            // embed's own later saves crashed uncaught (reported and
            // root-caused live, 2026-08-13)
            try {
                if (embed.dirty && !embed.saving) {
                    const text = embed.editMode?.editor?.getValue?.() ?? embed.text;
                    if (typeof text === "string") await embed.save?.(text, true);
                }
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
                try {
                    // a debounce timer armed by the final keystrokes would
                    // fire AFTER the unload below and read the cleared
                    // embed state (the rapid-succession crash) — everything
                    // dirty has been flushed above, so the timers carry
                    // nothing
                    embed.requestSave?.cancel?.();
                    embed.requestSaveFolds?.cancel?.();
                    embed.unload();
                } catch {
                    // private API — a throw here must not skip the settle
                    // below, or every later footnote command would wait on
                    // pendingTeardown forever (E29)
                }
                // one beat for Obsidian to reconcile the written file into
                // the main view before anyone edits it (a timeout on
                // purpose: rAF stalls entirely while the window is hidden)
                win.setTimeout(() => {
                    // clear the slot only if a LATER teardown hasn't
                    // replaced it — nulling a successor's promise would
                    // drop the busy gate while its save is still in flight
                    // (2026-08-11 review bug #14)
                    if (pendingTeardown === teardownPromise) {
                        pendingTeardown = null;
                    }
                    settle();
                }, 50);
            };
            teardown();
        })();
    };

    const tryShow = async (): Promise<boolean> => {
        await embed.loadFile();
        // a rapid second press toggle-closes the popup while loadFile is
        // still in flight — teardown has already UNLOADED the embed, and
        // showing the editor on an unloaded embed leaves a live inline
        // editor whose save chain later fires against the cleared embed
        // state ("Cannot read properties of undefined (reading 'split')",
        // reported and repro'd 2026-08-13). Closed = handled, show nothing.
        if (popupClosed()) return true;
        if (embed.subpathNotFound) return false;
        containerEl.removeClass("footnote-shortcut-popup-loading");
        embed.showEditor();
        positionPopup();
        const inner = embed.editMode?.editor;
        if (inner) {
            inner.focus();
            // cursor at the END of the definition so the user can backspace
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
            if (popupClosed()) return true;
            embed.unload();
            embedEl.empty();
            embed = buildEmbed();
            if (await tryShow()) return true;
        }
        return false;
    };

    showEditor()
        .then((shown) => {
            if (!shown && !popupClosed()) {
                close(false);
                onUnavailable?.();
            }
        })
        .catch(() => {
            if (!popupClosed()) {
                close(false);
                onUnavailable?.();
            }
        });
}
