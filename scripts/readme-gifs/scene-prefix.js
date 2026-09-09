// Per-note prefix: set it with the command, then numbered and named footnotes carry it.
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({ enableFootnotePrefix: true }, async () => {
        const line = "The second transect ran along the reef crest, where the counts were highest";
        await G.setNote("# Chapter 2\n\n" + line, { line: 2, ch: line.length });
        await G.sleep(600);
        G.startRecording("prefix", 8, "editor", 520);
        await G.sleep(1000);
        await G.press(S.PREFIX, ["Ctrl", "P"], "Set footnote prefix (command palette)");
        if (!(await G.waitFor(G.modalOpen))) throw new Error("prefix dialog did not open");
        await G.sleep(800);
        await G.typeModal("2-", 120);
        await G.sleep(700);
        G.key(["Enter"], "Saved to the note's footnote-prefix property", 2600);
        await G.sleep(380);
        G.submitModal();
        await G.sleep(1800);
        const v = G.view();
        const last = v.editor.lastLine();
        // the caret went with the frontmatter insert; back to the end of the sentence
        for (let i = last; i >= 0; i--) {
            if (v.editor.getLine(i).startsWith("The second transect")) {
                v.editor.setCursor({ line: i, ch: v.editor.getLine(i).length });
                break;
            }
        }
        v.editor.focus();
        await G.sleep(600);
        await G.press(S.NUM, ["Alt", "0"], "Numbered footnotes carry the prefix");
        await S.popupRoundTrip(S.NUM, ["Alt", "0"], "Crest counts, 14 March.");
        await G.typeMain(" Smith counted the same stretch", S.T);
        await G.sleep(400);
        await G.press(S.NAMED, ["Alt", "-"], "Named footnotes start with it");
        if (!(await G.waitFor(() => G.caretLine().includes("[^2-]")))) throw new Error("prefixed skeleton did not appear");
        await G.sleep(800);
        await G.typeMain("smith", 80);
        await G.sleep(600);
        await G.press(S.NAMED, ["Alt", "-"], "Press again to write the footnote");
        await S.popupRoundTrip(S.NAMED, ["Alt", "-"], "Smith, Reef Census Methods (2024), p. 14.");
        await G.typeMain(".", S.T);
        await G.sleep(4500);
        return await G.stopRecording();
    });
})();
