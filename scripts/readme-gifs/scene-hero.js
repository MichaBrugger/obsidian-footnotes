// Hero: press the hotkey at the end of a sentence, the popup opens at the
// cursor, type the note, the hotkey again closes it, keep writing.
(async () => {
    const G = window.__gif;
    window.__scene = { stage: "start" };
    const saved = G.settingsSnapshot();
    try {
        G.setSettings({
            enablePopupEditor: true,
            insertAtEndOfWord: true,
            lintOnFootnoteCreation: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
        });
        await G.activate();
        const line = "The reef survey counted 412 colonies along the northern transect, a third more than last season.";
        const ch = line.indexOf("season") + "sea".length;
        await G.setNote("# Field notes\n\n" + line, { line: 2, ch });
        await G.sleep(700);
        G.startRecording("hero", 8, "editor", 420);
        await G.sleep(1000);
        await G.press("obsidian-footnotes:insert-autonumbered-footnote", ["Alt", "0"], "Insert / navigate numbered footnote");
        if (!(await G.waitFor(G.popupOpen))) throw new Error("popup did not open");
        await G.sleep(600);
        await G.typePopup("Transect B, surveyed 14 March by the second dive team.", 65);
        await G.sleep(1100);
        await G.press("obsidian-footnotes:insert-autonumbered-footnote", ["Alt", "0"], "Same hotkey closes the popup");
        if (!(await G.waitFor(G.popupGone))) throw new Error("popup did not close");
        await G.sleep(500);
        await G.typeMain(" The biggest gains were in the shallow zone.", 55);
        await G.sleep(1600);
        const r = await G.stopRecording();
        window.__scene = { stage: "done", ...r };
    } catch (e) {
        try {
            await G.stopRecording();
        } catch (_) {}
        window.__scene = { stage: "error", error: e.message };
    } finally {
        G.setSettings(saved);
        G.restoreLeaf();
    }
})();
