// Rename: caret on a reference, Rename footnote, a new name, every occurrence updates.
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        const body = [
            "# Field notes",
            "",
            "Smith disputes the counting method.[^smith] The census used quadrats,[^smith] and the totals were not corrected for depth.[^smith]",
            "",
            "Temperatures stayed in range all week.",
            "",
            "[^smith]: Smith, Reef Census Methods (2024), p. 12.",
        ].join("\n");
        await G.setNote(body, { line: 2, ch: body.split("\n")[2].indexOf("[^smith]") + 3 });
        await G.sleep(600);
        G.startRecording("rename", 8, "editor", 420);
        await G.sleep(1200);
        await G.press(S.RENAME, ["Ctrl", "P"], "Rename footnote (command palette)");
        if (!(await G.waitFor(G.modalOpen))) throw new Error("rename dialog did not open");
        await G.sleep(900);
        await G.clearModal();
        await G.typeModal("smith-2024-census", 70);
        await G.sleep(800);
        G.key(["Enter"], "Every reference and the definition rename together", 2600);
        await G.sleep(380);
        G.submitModal();
        await G.sleep(4500);
        return await G.stopRecording();
    });
})();
