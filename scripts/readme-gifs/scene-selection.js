// Selection to footnote, all three keys: a numbered one, a named one through
// the dialog (submitted by pressing the hotkey again), and an inline one.
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        const l1 = "The northern transect held 412 colonies. Counts were taken by the second dive team on 14 March.";
        const l2 = "Smith disputes the counting method. His census used quadrats instead of transects.";
        const l3 = "Temperatures stayed in range all week and the buoy log agrees with the divers.";
        await G.setNote("# Field notes\n\n" + l1 + "\n\n" + l2 + "\n\n" + l3, { line: 2, ch: 0 });
        await G.sleep(600);
        G.startRecording("selection", 8, "editor", 480);
        await G.sleep(900);

        // 1. numbered: the second sentence of line 1
        let s1 = "Counts were taken by the second dive team on 14 March.";
        await G.selectSweep(2, l1.indexOf(s1), l1.indexOf(s1) + s1.length, 12, 55);
        await G.sleep(700);
        await G.press(S.NUM, ["Alt", "0"], "Selected text becomes a numbered footnote");
        await S.popupRoundTrip(S.NUM, ["Alt", "0"], null);

        // 2. named: the second sentence of line 2, name typed in the dialog
        const s2 = "His census used quadrats instead of transects.";
        await G.selectSweep(4, l2.indexOf(s2), l2.indexOf(s2) + s2.length, 12, 55);
        await G.sleep(700);
        await G.press(S.NAMED, ["Alt", "-"], "Named: a dialog asks for the name");
        if (!(await G.waitFor(G.modalOpen))) throw new Error("name dialog did not open");
        await G.sleep(600);
        await G.typeModal("smith2024", 80);
        await G.sleep(700);
        await G.press(S.NAMED, ["Alt", "-"], "Any footnote hotkey submits the dialog");
        await S.popupRoundTrip(S.NAMED, ["Alt", "-"], null);

        // 3. inline: the clause in line 3
        const s3 = "and the buoy log agrees";
        await G.selectSweep(6, l3.indexOf(s3), l3.indexOf(s3) + s3.length, 10, 55);
        await G.sleep(700);
        await G.press(S.INLINE, ["Alt", "="], "Inline: wrapped where it is");
        await G.sleep(4500);
        return await G.stopRecording();
    });
})();
