// Inline footnotes: one typed in place and hopped out of, then the clipboard wrapped in one press.
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        const line = "The deeper zone showed no change from the earlier count";
        await G.setNote("# Field notes\n\n" + line, { line: 2, ch: line.indexOf(" showed") });
        G.setClipboard("buoy log, station 4, 09:40");
        await G.sleep(600);
        G.startRecording("inline", 8, "editor", 380);
        await G.sleep(900);
        await G.press(S.INLINE, ["Alt", "="], "Insert inline footnote");
        if (!(await G.waitFor(() => G.caretLine().includes("^[]")))) throw new Error("inline skeleton did not appear");
        await G.sleep(600);
        await G.typeMain("below 12 m, where visibility dropped", S.T);
        await G.sleep(600);
        await G.press(S.INLINE, ["Alt", "="], "Press again to hop out");
        await G.sleep(700);
        const v = G.view();
        v.editor.setCursor({ line: 2, ch: v.editor.getLine(2).length });
        await G.typeMain(", matching the temperature record", S.T);
        await G.sleep(800);
        await G.press(S.PASTE, ["Alt", "Shift", "="], "Insert inline footnote from clipboard");
        await G.sleep(1200);
        await G.typeMain(".", S.T);
        await G.sleep(4000);
        return await G.stopRecording();
    });
})();
