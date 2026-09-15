// Shared scaffolding for the README scenes: a scene is `run(G, api)` where
// api gives the command ids, the settings baseline, and a wrapper that
// handles the run id, the settings snapshot, the leaf restore, and the
// error reporting. Loaded before each scene file by the driver.
(() => {
    const G = window.__gif;
    const S = (window.__gifScene = window.__gifScene || {});
    S.NUM = "obsidian-footnotes:insert-autonumbered-footnote";
    S.NAMED = "obsidian-footnotes:insert-named-footnote";
    S.INLINE = "obsidian-footnotes:insert-inline-footnote";
    S.PASTE = "obsidian-footnotes:paste-inline-footnote";
    S.LINT = "obsidian-footnotes:lint-footnotes";
    S.RENAME = "obsidian-footnotes:rename-footnote";
    S.PREFIX = "obsidian-footnotes:set-footnote-prefix";
    S.T = 42; // ms per typed character in the note
    S.P = 55; // ms per typed character in the popup
    S.BASELINE = {
        enablePopupEditor: true,
        insertAtEndOfWord: true,
        expandSelectionToWholeWords: true,
        lintOnFootnoteCreation: false,
        lintOnSave: false,
        enableFootnotePrefix: false,
        enableFootnoteSectionHeading: false,
        footnoteSectionHeading: "## Footnotes",
        lintFixPunctuation: true,
        lintMoveToBottom: true,
        lintReindex: true,
        lintDeleteOrphanedReferences: false,
        lintDeleteOrphanedDefinitions: false,
        lintMergeDuplicateDefinitions: false,
    };

    /** Run a scene body with the shared bookends. `body` returns the recording result (or `{ still }`). */
    S.run = async (settings, body) => {
        window.__scene = { stage: "start" };
        G.beginRun();
        let saved = null;
        try {
            await G.pluginReady();
            saved = G.settingsSnapshot();
            G.setSettings({ ...S.BASELINE, ...(settings || {}) });
            await G.activate();
            const result = await body();
            window.__scene = { stage: "done", ...result };
        } catch (e) {
            try {
                await G.stopRecording();
            } catch (_) {}
            window.__scene = { stage: "error", error: e.message };
        } finally {
            if (saved) G.setSettings(saved);
            G.restoreLeaf();
        }
    };

    /** Open the popup for a footnote created or visited by `id`, type into it, close it with the same key. */
    S.popupRoundTrip = async (id, keys, text) => {
        if (!(await G.waitFor(G.popupOpen))) throw new Error("popup did not open");
        await G.sleep(500);
        if (text) await G.typePopup(text, S.P);
        await G.sleep(900);
        await G.press(id, keys, "Same hotkey: back to the text");
        if (!(await G.waitFor(G.popupGone))) throw new Error("popup did not close");
        // the next edit waits for the popup's saves to land (see G.diskQuiet)
        await G.diskQuiet(1200);
    };
})();
