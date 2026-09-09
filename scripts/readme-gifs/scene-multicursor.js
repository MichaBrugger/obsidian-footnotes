// Multiple cursors: the same footnote at every caret, once per key - numbered,
// named, inline, and the clipboard. Each demo starts from the same three
// lines (a hard cut between them keeps the note readable).
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        const lines = [
            "The northern transect held 412 colonies, and the deeper zone showed no change.",
            "Smith counted the same stretch a month later, and his total was lower.",
            "Growth was slowest on the outer edge, where the current is strongest.",
        ];
        const body = "# Field notes\n\n" + lines.join("\n\n");
        const rows = [2, 4, 6];
        const endOfLines = () => rows.map((line, i) => ({ line, ch: lines[i].length }));
        const afterFirstClause = () => rows.map((line, i) => ({ line, ch: lines[i].indexOf(",") }));
        const fresh = async (positions) => {
            await G.setNote(body, { line: 2, ch: 0 });
            await G.sleep(900);
            G.setCarets(positions);
            G.key(["Alt", "click"], "One cursor per place the source is cited");
            await G.sleep(1900);
        };
        const allLinesHave = (text) => rows.every((line) => G.view().editor.getLine(line).includes(text));

        await G.setNote(body, { line: 2, ch: 0 });
        await G.sleep(600);
        G.startRecording("multicursor", 8, "editor", 480);
        await G.sleep(400);

        // 1. numbered: one [^1] at every caret, one definition
        await fresh(endOfLines());
        await G.press(S.NUM, ["Alt", "0"], "Numbered: the same reference everywhere, one definition");
        await S.popupRoundTrip(S.NUM, ["Alt", "0"], "Dive team B, 14 March.");
        await G.sleep(2200);

        // 2. named: [^] at every caret, the name typed once, then the shared definition
        await fresh(afterFirstClause());
        await G.press(S.NAMED, ["Alt", "-"], "Named: brackets at every cursor");
        if (!(await G.waitFor(() => allLinesHave("[^]")))) throw new Error("named skeletons did not appear");
        await G.sleep(600);
        await G.typeMain("smith2024", 75);
        await G.sleep(700);
        await G.press(S.NAMED, ["Alt", "-"], "Press again: one shared footnote");
        await S.popupRoundTrip(S.NAMED, ["Alt", "-"], "Smith, Reef Census Methods (2024), p. 12.");
        await G.sleep(2200);

        // 3. inline: ^[] at every caret, the text typed once, hop out with the same key
        await fresh(endOfLines());
        await G.press(S.INLINE, ["Alt", "="], "Inline: type once, it lands everywhere");
        if (!(await G.waitFor(() => allLinesHave("^[]")))) throw new Error("inline skeletons did not appear");
        await G.sleep(600);
        await G.typeMain("recount pending", S.T);
        await G.sleep(700);
        await G.press(S.INLINE, ["Alt", "="], "Press again: one cursor, after the first footnote");
        await G.sleep(2400);

        // 4. clipboard: the same text wrapped at every caret in one press
        G.setClipboard("buoy log, station 4");
        await fresh(afterFirstClause());
        await G.press(S.PASTE, ["Alt", "Shift", "="], "Clipboard: wrapped at every cursor");
        if (!(await G.waitFor(() => allLinesHave("^[buoy log")))) throw new Error("pasted wrappers did not appear");
        await G.sleep(4500);
        return await G.stopRecording();
    });
})();
