// Hero: the whole writing flow in one take. Type a sentence, drop a
// numbered footnote and come straight back, keep writing, then a named
// footnote at TWO cursors at once (Alt+click, one shared definition), an
// inline footnote, a selection that becomes a footnote, a right-click
// rename that updates both references and the definition together, and
// finally Lint footnotes tidies a hand-typed reference that sits before
// its period and gathers the definitions under a heading.
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
    const count = (text, needle) => text.split(needle).length - 1;
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
        // typing resumes only once the popup's saves have landed (see G.diskQuiet)
        await G.diskQuiet(1200);

        // 2. keep writing: Smith is cited twice in the next sentence, so a
        // second cursor goes where he is cited again and ONE named footnote
        // lands at both (press, type the name once, press again)
        await G.typeMain(", a third more than last season. Smith disputes the counting method, and his own recount came in lower", T);
        await G.sleep(500);
        const v = G.view();
        const smithLine = v.editor.getCursor().line;
        const smithText = v.editor.getLine(smithLine);
        const afterMethod = smithText.indexOf("counting method") + "counting method".length;
        G.setCarets([
            { line: smithLine, ch: afterMethod },
            { line: smithLine, ch: smithText.length },
        ]);
        G.key(["Alt", "click"], "A second cursor where Smith is cited again");
        await G.sleep(1900);
        await G.press(NAMED, ["Alt", "-"], "Insert / navigate named footnote: brackets at both cursors");
        // the command inserts its "[^]" after its own awaits - type the
        // name only once the brackets are there
        if (!(await G.waitFor(() => count(G.caretLine(), "[^]") === 2))) throw new Error("named skeletons did not appear");
        await G.sleep(500);
        await G.typeMain("smith2024", 70);
        await G.sleep(500);
        await G.press(NAMED, ["Alt", "-"], "Press again: one shared footnote");
        if (!(await G.waitFor(G.popupOpen))) throw new Error("popup 2 did not open");
        await G.sleep(500);
        await G.typePopup("Smith, Reef Census Methods (2024), p. 12.", P);
        await G.sleep(700);
        await G.press(NAMED, ["Alt", "-"], "Same hotkey: back to the text");
        if (!(await G.waitFor(G.popupGone))) throw new Error("popup 2 did not close");
        await G.diskQuiet(1200);
        // a multi-cursor insertion leaves one cursor after the FIRST
        // reference; End takes the writer back to the end of the line
        G.key(["End"], "", 900);
        await G.sleep(380);
        v.editor.setCursor({ line: smithLine, ch: v.editor.getLine(smithLine).length });
        await G.sleep(500);

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
        await G.diskQuiet(1200);

        // 5. rename from the right-click menu: a right-click on the first
        // Smith reference (Obsidian parks the caret there, then opens its
        // editor menu, which carries the plugin's Rename footnote entry)
        const refCh = v.editor.getLine(smithLine).indexOf("[^smith2024]") + 3;
        const c = v.editor.cm.coordsAtPos(v.editor.posToOffset({ line: smithLine, ch: refCh }));
        if (!c) throw new Error("smith reference is off screen");
        const x = (c.left + c.right) / 2;
        const y = (c.top + c.bottom) / 2;
        G.pointer(x, y, 3400);
        await G.sleep(700);
        G.key(["Right-click"], "Rename footnote from the right-click menu", 3000);
        await G.sleep(380);
        v.editor.setCursor({ line: smithLine, ch: refCh });
        await G.sleep(80);
        const target = document.elementFromPoint(x, y);
        target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
        const renameItem = () =>
            [...document.querySelectorAll(".menu .menu-item")].find((el) => el.querySelector(".menu-item-title")?.textContent === "Rename footnote") || null;
        if (!(await G.waitFor(() => !!renameItem()))) throw new Error("Rename footnote is not in the menu");
        await G.sleep(800);
        // the pointer moves onto the entry and it lights up, then the click
        const itemRect = renameItem().getBoundingClientRect();
        G.pointer(itemRect.left + 26, itemRect.top + itemRect.height / 2, 1400);
        renameItem().classList.add("selected");
        await G.sleep(1000);
        renameItem().click();
        if (!(await G.waitFor(G.modalOpen))) throw new Error("rename dialog did not open");
        await G.sleep(900);
        await G.clearModal();
        await G.typeModal("smith-methods", 70);
        await G.sleep(800);
        G.key(["Enter"], "Both references and the definition rename together", 2600);
        await G.sleep(380);
        G.submitModal();
        if (!(await G.waitFor(() => count(v.editor.getValue(), "[^smith-methods]") === 3))) throw new Error("rename did not land");
        await G.sleep(2600);

        // 6. lint: the references move past their punctuation, the definitions get a heading
        G.setSettings({ enableFootnoteSectionHeading: true });
        await G.press(LINT, ["Ctrl", "P"], "Lint footnotes (command palette)");
        if (!(await G.waitFor(() => v.editor.getValue().includes("## Footnotes")))) throw new Error("lint did not land");
        // the caret leaves the middle of the text for the end of the note,
        // so the hold shows the finished page, not a bar over a comma
        await G.sleep(600);
        v.editor.setCursor({ line: v.editor.lastLine(), ch: v.editor.getLine(v.editor.lastLine()).length });
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
