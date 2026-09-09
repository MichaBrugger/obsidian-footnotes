// Numbered footnote: hotkey at the end of a sentence, popup opens, note typed, same key closes it.
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        const line = "The reef survey counted 412 colonies along the northern transect, a third more than last season.";
        await G.setNote("# Field notes\n\n" + line, { line: 2, ch: line.indexOf("season") + 3 });
        await G.sleep(600);
        G.startRecording("numbered", 8, "editor", 400);
        await G.sleep(900);
        await G.press(S.NUM, ["Alt", "0"], "Insert / navigate numbered footnote");
        await S.popupRoundTrip(S.NUM, ["Alt", "0"], "Transect B, surveyed 14 March by the second dive team.");
        await G.typeMain(" The biggest gains were in the shallow zone.", S.T);
        await G.sleep(4000);
        return await G.stopRecording();
    });
})();
