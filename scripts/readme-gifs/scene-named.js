// Named footnote in two presses: the first plants [^] and you type the name, the second writes the footnote.
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        const line = "Smith disputes the counting method, but the trend holds across all three seasons.";
        await G.setNote("# Field notes\n\n" + line, { line: 2, ch: line.indexOf("method") + 3 });
        await G.sleep(600);
        G.startRecording("named", 8, "editor", 400);
        await G.sleep(900);
        await G.press(S.NAMED, ["Alt", "-"], "Insert / navigate named footnote");
        if (!(await G.waitFor(() => G.caretLine().includes("[^]")))) throw new Error("named skeleton did not appear");
        await G.sleep(700);
        await G.typeMain("smith2024", 75);
        await G.sleep(700);
        await G.press(S.NAMED, ["Alt", "-"], "Press again to write the footnote");
        await S.popupRoundTrip(S.NAMED, ["Alt", "-"], "Smith, Reef Census Methods (2024), p. 12.");
        await G.sleep(4000);
        return await G.stopRecording();
    });
})();
