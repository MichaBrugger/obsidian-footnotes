// Navigation: on a reference the hotkey opens its definition in the popup;
// on the definition line it jumps back to the reference.
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        const body = [
            "# Field notes",
            "",
            "The reef survey counted 412 colonies along the northern transect.[^1] Smith disputes the counting method.[^smith2024]",
            "",
            "The deeper zone showed no change from the earlier count. Temperatures stayed in range all week, and the buoy log agrees.",
            "",
            "Growth was slowest on the outer edge, where the current is strongest.",
            "",
            "[^1]: Transect B, surveyed 14 March.",
            "[^smith2024]: Smith, Reef Census Methods (2024), p. 12.",
        ].join("\n");
        const refCh = body.split("\n")[2].indexOf("[^1]") + 2;
        await G.setNote(body, { line: 2, ch: refCh });
        await G.sleep(600);
        G.startRecording("navigation", 8, "editor", 480);
        await G.sleep(1200);
        await G.press(S.NUM, ["Alt", "0"], "On a reference: open its definition here");
        if (!(await G.waitFor(G.popupOpen))) throw new Error("popup did not open");
        await G.sleep(700);
        await G.typePopup(" Recount pending.", S.P);
        await G.sleep(900);
        await G.press(S.NUM, ["Alt", "0"], "Same hotkey: back to the text");
        if (!(await G.waitFor(G.popupGone))) throw new Error("popup did not close");
        await G.sleep(900);
        // now from the definition line
        const v = G.view();
        v.editor.setCursor({ line: 8, ch: 8 });
        await G.sleep(1200);
        await G.press(S.NUM, ["Alt", "0"], "On a definition: jump back to its reference");
        await G.sleep(4500);
        return await G.stopRecording();
    });
})();
