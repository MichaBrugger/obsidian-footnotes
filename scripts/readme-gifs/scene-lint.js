// Lint: a messy note (references before punctuation, out-of-order numbers,
// definitions scattered mid-note) snaps into place with one command.
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        const body = [
            "# Field notes",
            "",
            "The reef survey counted 412 colonies[^3], a third more than last season[^1].",
            "",
            "[^3]: Transect B, surveyed 14 March.",
            "",
            "Smith disputes the counting method[^2]. The deeper zone showed no change.",
            "",
            "[^1]: Compared against the 2025 census.",
            "",
            "Temperatures stayed in range all week.",
            "",
            "[^2]: Smith, Reef Census Methods (2024), p. 12.",
        ].join("\n");
        await G.setNote(body, { line: 2, ch: 0 });
        await G.sleep(600);
        G.startRecording("lint", 8, "editor", 560);
        await G.sleep(3000);
        await G.press(S.LINT, ["Ctrl", "P"], "Lint footnotes (command palette)");
        await G.sleep(5000);
        return await G.stopRecording();
    });
})();
