// Hero: the whole writing flow in one take. Type a sentence, drop a
// numbered footnote and come straight back, keep writing, a named footnote
// (two presses) and back, an inline footnote, then Lint footnotes tidies a
// hand-typed reference that sits before its period and gathers the
// definitions under a heading. A selection becomes a footnote on the way.
(async () => {
    const G = window.__gif;
    window.__scene = { stage: "start" };
    G.beginRun();
    let saved = null;
    const NUM = "obsidian-footnotes:insert-autonumbered-footnote";
    const NAMED = "obsidian-footnotes:insert-named-footnote";
    const INLINE = "obsidian-footnotes:insert-inline-footnote";
    const LINT = "obsidian-footnotes:lint-footnotes";
    const T = 42; // ms per typed character in the note
    const P = 55; // ms per typed character in the popup
    try {
        await G.pluginReady();
        saved = G.settingsSnapshot();
        G.setSettings({
            enablePopupEditor: true,
            insertAtEndOfWord: true,
            lintOnFootnoteCreation: false,
            lintOnSave: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "## Footnotes",
            lintMoveToBottom: true,
            lintReindex: true,
        });
        await G.activate();
        await G.setNote("# Field notes\n\n", { line: 2, ch: 0 });
        await G.sleep(600);
        G.startRecording("hero", 8, "editor", 520);
        await G.sleep(700);

        // 1. a first sentence, then a numbered footnote at its end
        await G.typeMain("The reef survey counted 412 colonies along the northern transect", T);
        await G.sleep(300);
        await G.press(NUM, ["Alt", "0"], "Insert / navigate numbered footnote");
        if (!(await G.waitFor(G.popupOpen))) throw new Error("popup 1 did not open");
        await G.sleep(500);
        await G.typePopup("Transect B, surveyed 14 March.", P);
        await G.sleep(700);
        await G.press(NUM, ["Alt", "0"], "Same hotkey: back to the text");
        if (!(await G.waitFor(G.popupGone))) throw new Error("popup 1 did not close");
        await G.sleep(400);

        // 2. keep writing, then a named footnote: press, type the name, press again
        await G.typeMain(", a third more than last season. Smith disputes the counting method", T);
        await G.sleep(300);
        await G.press(NAMED, ["Alt", "-"], "Insert / navigate named footnote");
        // the command inserts its "[^]" after its own awaits - type the
        // name only once the brackets are there
        if (!(await G.waitFor(() => G.caretLine().includes("[^]")))) throw new Error("named skeleton did not appear");
        await G.sleep(500);
        await G.typeMain("smith2024", 70);
        await G.sleep(400);
        await G.press(NAMED, ["Alt", "-"], "Press again to write the footnote");
        if (!(await G.waitFor(G.popupOpen))) throw new Error("popup 2 did not open");
        await G.sleep(500);
        await G.typePopup("Smith, Reef Census Methods (2024), p. 12.", P);
        await G.sleep(700);
        await G.press(NAMED, ["Alt", "-"], "Same hotkey: back to the text");
        if (!(await G.waitFor(G.popupGone))) throw new Error("popup 2 did not close");
        await G.sleep(400);

        // 3. keep writing, then an inline footnote typed in place
        await G.typeMain(". The deeper zone", T);
        await G.sleep(300);
        await G.press(INLINE, ["Alt", "="], "Insert inline footnote");
        if (!(await G.waitFor(() => G.caretLine().includes("^[]")))) throw new Error("inline skeleton did not appear");
        await G.sleep(500);
        await G.typeMain("below 12 m, where visibility dropped", T);
        await G.sleep(400);
        await G.press(INLINE, ["Alt", "="], "Press again to hop out");
        await G.sleep(500);
        // a hand-typed reference before its period: the linter's cue
        await G.typeMain(" showed no change from the earlier count[^1].", T);
        await G.sleep(500);

        // 4. write two more sentences, select the last one, convert it
        const tail = " Temperatures stayed in range. The buoy log confirms this independently.";
        await G.typeMain(tail, T);
        await G.sleep(600);
        const v = G.view();
        const cur = v.editor.getCursor();
        const lineText = v.editor.getLine(cur.line);
        const sentence = "The buoy log confirms this independently.";
        const from = lineText.lastIndexOf(sentence);
        await G.selectSweep(cur.line, from, from + sentence.length, 12, 55);
        await G.sleep(700);
        await G.press(NUM, ["Alt", "0"], "Selected text becomes a footnote");
        if (!(await G.waitFor(G.popupOpen))) throw new Error("popup 3 did not open");
        await G.sleep(1500);
        await G.press(NUM, ["Alt", "0"], "Same hotkey: back to the text");
        if (!(await G.waitFor(G.popupGone))) throw new Error("popup 3 did not close");
        await G.sleep(1000);

        // 5. lint: the references move past their punctuation, the definitions get a heading
        G.setSettings({ enableFootnoteSectionHeading: true });
        await G.press(LINT, ["Ctrl", "P"], "Lint footnotes (command palette)");
        // hold the finished note so the reader can take it in (Jason, 2026-09-08)
        await G.sleep(6000);

        const r = await G.stopRecording();
        window.__scene = { stage: "done", ...r };
    } catch (e) {
        try {
            await G.stopRecording();
        } catch (_) {}
        window.__scene = { stage: "error", error: e.message };
    } finally {
        if (saved) G.setSettings(saved);
        G.restoreLeaf();
    }
})();
