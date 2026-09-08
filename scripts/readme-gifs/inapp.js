// README GIF recorder, loaded INTO Obsidian from a vault dotfile. Installs
// window.__gif: frame capture of the smoke note's editor through the
// window's own webContents (capturePage, ~7 fps), a Keyviz-style key
// overlay drawn only while recording, and typing helpers for the main
// editor and the footnote popup. Everything addresses the smoke note by
// path, never the active leaf.
(() => {
    const remote = require("electron").remote;
    const wc = remote.getCurrentWebContents();
    const NOTE_PATH = "Smoke Test - footnotes.md";
    const G = (window.__gif = window.__gif || {});
    // one scene at a time: a new scene bumps the run id, and every sleep of
    // a superseded scene rejects, so a stale take can't keep typing into
    // the note or overwrite the new take's frames (it happened when a
    // background-throttled take was still crawling as the next one began)
    G.run = G.run || 0;
    G.sleep = (ms) => {
        const run = G.run;
        return new Promise((resolve, reject) =>
            setTimeout(() => {
                if (G.run !== run) return reject(new Error("superseded"));
                // a take in a hidden window is garbage (throttled timers,
                // typing racing the commands' own awaits): stop at once
                if (G.recordingRun === run && document.hidden) {
                    return reject(new Error("window was hidden during the take - keep the sandbox window visible and rerun"));
                }
                resolve();
            }, ms),
        );
    };
    G.beginRun = () => ++G.run;

    // recording needs a FOCUSED window: Obsidian throttles timers and
    // painting in the background, which turns a scene into a crawl
    G.bringToFront = () => {
        const w = remote.getCurrentWindow();
        if (w.isMinimized()) w.restore();
        w.setAlwaysOnTop(true);
        w.show();
        w.focus();
        if (typeof w.moveTop === "function") w.moveTop();
        w.setAlwaysOnTop(false);
    };
    // visible is what matters: Chromium throttles timers only for a hidden
    // (minimized or fully occluded) window; API-driven typing needs no focus
    G.focused = () => !document.hidden;

    G.view = () => {
        // the leaf activate() opened, once it has an editor; else any open one
        if (G.leaf && G.leaf.view && G.leaf.view.file && G.leaf.view.file.path === NOTE_PATH && G.leaf.view.editor) {
            return G.leaf.view;
        }
        let leaf = null;
        app.workspace.iterateAllLeaves((l) => {
            if (l.view && l.view.file && l.view.file.path === NOTE_PATH && l.view.editor) leaf = l;
        });
        return leaf && leaf.view;
    };

    G.activate = async () => {
        G.previousLeaf = app.workspace.activeLeaf;
        const f = app.vault.getAbstractFileByPath(NOTE_PATH);
        if (!f) throw new Error("smoke note missing");
        // markdown views only: the Outline and Footnotes sidebar views report
        // the same file and have no editor
        let leaf = null;
        app.workspace.iterateAllLeaves((l) => {
            if (l.view && l.view.getViewType && l.view.getViewType() === "markdown" && l.view.file && l.view.file.path === f.path) leaf = l;
        });
        if (!leaf) {
            leaf = app.workspace.getLeaf("tab");
            await leaf.openFile(f);
        }
        // a background tab may be a DEFERRED view (no editor until it is
        // loaded); activating it loads it, and a freshly opened view has no
        // editor for a moment either
        if (typeof leaf.loadIfDeferred === "function") await leaf.loadIfDeferred();
        app.workspace.setActiveLeaf(leaf, { focus: true });
        for (let i = 0; i < 50 && !(leaf.view && leaf.view.editor); i++) await G.sleep(100);
        if (!(leaf.view && leaf.view.editor)) throw new Error("smoke note view has no editor");
        G.leaf = leaf;
        G.bringToFront();
        await G.sleep(400);
        if (!G.focused()) throw new Error("window hidden - make the sandbox vault window visible and rerun");
        const v = leaf.view;
        await v.setState({ ...v.getState(), mode: "source", source: false }, { history: false });
        await G.sleep(200);
        return v;
    };

    G.restoreLeaf = () => {
        if (G.previousLeaf) app.workspace.setActiveLeaf(G.previousLeaf, { focus: true });
    };

    G.setNote = async (text, cursor) => {
        const v = G.view();
        v.editor.setValue(text);
        await G.sleep(200);
        v.editor.focus();
        if (cursor) v.editor.setCursor(cursor);
        await G.sleep(200);
    };

    // a build just before a recording makes hot-reload cycle the plugin;
    // wait until it is back before touching its settings
    G.pluginReady = async () => {
        for (let i = 0; i < 50; i++) {
            const plugin = app.plugins.plugins["obsidian-footnotes"];
            if (plugin && plugin.settings) return plugin;
            await G.sleep(200);
        }
        throw new Error("footnote plugin not loaded");
    };
    G.setSettings = (patch) => Object.assign(app.plugins.plugins["obsidian-footnotes"].settings, patch);
    G.settingsSnapshot = () => JSON.parse(JSON.stringify(app.plugins.plugins["obsidian-footnotes"].settings));

    // recording-only cosmetics: no inline title, no line-number gutter
    G.beginStyle = () => {
        if (document.getElementById("gif-style")) return;
        const st = document.head.createEl("style", { attr: { id: "gif-style" } });
        st.textContent = ".inline-title { display: none !important; } .cm-gutters { display: none !important; }";
    };
    G.endStyle = () => document.getElementById("gif-style")?.remove();

    // capture region in DIPs: the editor pane, its readable text column, or
    // the whole window; `maxHeight` trims the empty bottom of a tall pane
    G.region = (mode, maxHeight) => {
        const v = G.view();
        let el = v.contentEl;
        let pad = 0;
        if (mode === "window") el = document.body;
        if (mode === "column") {
            el = v.contentEl.querySelector(".cm-sizer") || v.contentEl;
            pad = 28;
        }
        const r = el.getBoundingClientRect();
        const x = Math.max(0, Math.round(r.left - pad));
        const width = Math.min(Math.round(r.width + 2 * pad), Math.round(window.innerWidth - x));
        const height = Math.min(Math.round(r.height), maxHeight || Math.round(r.height));
        return { x, y: Math.round(r.top), width, height };
    };

    G.startRecording = (name, fps, mode, maxHeight) => {
        G.recordingRun = G.run;
        G.name = name;
        G.frames = [];
        G.beginStyle();
        G.rect = G.region(mode || "editor", maxHeight);
        G.t0 = performance.now();
        let busy = false;
        G.timer = setInterval(async () => {
            if (busy) return;
            busy = true;
            try {
                const img = await wc.capturePage(G.rect);
                G.frames.push({ t: performance.now() - G.t0, png: img.toPNG() });
            } finally {
                busy = false;
            }
        }, Math.round(1000 / (fps || 8)));
    };

    G.stopRecording = async () => {
        if (G.recordingRun !== G.run) return { skipped: true };
        if (G.timer) clearInterval(G.timer);
        G.timer = null;
        G.endStyle();
        document.querySelectorAll(".gif-key-overlay").forEach((e) => e.remove());
        const dir = ".footnote-capture/" + G.name;
        if (!(await app.vault.adapter.exists(".footnote-capture"))) await app.vault.adapter.mkdir(".footnote-capture");
        if (await app.vault.adapter.exists(dir)) await app.vault.adapter.rmdir(dir, true);
        await app.vault.adapter.mkdir(dir);
        const times = [];
        let i = 0;
        for (const f of G.frames) {
            const buf = f.png.buffer.slice(f.png.byteOffset, f.png.byteOffset + f.png.byteLength);
            await app.vault.adapter.writeBinary(dir + "/f" + String(i).padStart(4, "0") + ".png", buf);
            times.push(Math.round(f.t));
            i++;
        }
        await app.vault.adapter.write(dir + "/times.json", JSON.stringify(times));
        G.frames = [];
        return { count: i, dir, rect: G.rect };
    };

    // Keyviz-style key overlay, bottom center of the recorded region
    G.key = (keys, caption, ms) => {
        document.querySelectorAll(".gif-key-overlay").forEach((e) => e.remove());
        const rect = G.rect || G.region("editor");
        const el = document.body.createDiv("gif-key-overlay");
        Object.assign(el.style, {
            position: "fixed",
            left: rect.x + rect.width / 2 + "px",
            top: rect.y + rect.height - 84 + "px",
            transform: "translateX(-50%)",
            zIndex: "99999",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "7px",
            pointerEvents: "none",
            fontFamily: "var(--font-interface)",
        });
        const row = el.createDiv();
        Object.assign(row.style, { display: "flex", gap: "7px", alignItems: "center" });
        keys.forEach((k, idx) => {
            if (idx) {
                const plus = row.createSpan({ text: "+" });
                Object.assign(plus.style, { color: "#e8e8e8", fontSize: "18px", textShadow: "0 1px 2px #000" });
            }
            const cap = row.createSpan({ text: k });
            Object.assign(cap.style, {
                background: "linear-gradient(#3b3b3b, #202020)",
                color: "#fff",
                border: "1px solid #6a6a6a",
                borderBottom: "3px solid #101010",
                borderRadius: "8px",
                padding: "7px 13px",
                fontSize: "19px",
                fontWeight: "600",
                minWidth: "26px",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,.55)",
            });
        });
        if (caption) {
            const c = el.createDiv({ text: caption });
            Object.assign(c.style, {
                background: "rgba(18,18,18,.92)",
                color: "#eee",
                borderRadius: "999px",
                padding: "5px 12px",
                fontSize: "13px",
                boxShadow: "0 2px 8px rgba(0,0,0,.4)",
            });
        }
        setTimeout(() => {
            el.style.transition = "opacity .3s";
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 320);
        }, ms || 2600);
    };

    G.press = async (id, keys, caption, ms) => {
        G.key(keys, caption, ms);
        await G.sleep(380);
        app.commands.executeCommandById(id);
    };
    /** The text of the smoke note's caret line. */
    G.caretLine = () => {
        const v = G.view();
        return v.editor.getLine(v.editor.getCursor().line);
    };

    G.typeMain = async (text, cps) => {
        const v = G.view();
        for (const ch of text) {
            v.editor.replaceSelection(ch);
            await G.sleep(cps || 80);
        }
    };

    G.popupEditor = () => {
        const el = document.querySelector(".footnote-shortcut-popup .cm-content");
        if (!el) return null;
        const v = G.view();
        const cm = v.editor.cm.constructor.findFromDOM(el);
        return cm && cm !== v.editor.cm ? cm : null;
    };

    G.typePopup = async (text, cps) => {
        const cm = G.popupEditor();
        if (!cm) throw new Error("no popup editor");
        for (const ch of text) {
            const head = cm.state.selection.main.head;
            cm.dispatch({ changes: { from: head, insert: ch }, selection: { anchor: head + 1 } });
            await G.sleep(cps || 80);
        }
    };

    // a drag-like selection: the anchor stays, the head sweeps to the end
    G.selectSweep = async (line, fromCh, toCh, steps, msPerStep) => {
        const v = G.view();
        const n = steps || 10;
        for (let i = 1; i <= n; i++) {
            const ch = Math.round(fromCh + ((toCh - fromCh) * i) / n);
            v.editor.setSelection({ line, ch: fromCh }, { line, ch });
            await G.sleep(msPerStep || 60);
        }
    };

    G.waitFor = async (fn, ms) => {
        const t = Date.now();
        while (Date.now() - t < (ms || 8000)) {
            if (fn()) return true;
            await G.sleep(60);
        }
        return false;
    };
    G.popupOpen = () =>
        !!document.querySelector(".footnote-shortcut-popup:not(.footnote-shortcut-popup-loading)") && !!G.popupEditor();
    G.popupGone = () => !document.querySelector(".footnote-shortcut-popup");
})();
