import { describe, expect, it } from "vitest";

import { tidyFootnotes } from "../src/tidy-footnotes";

// The composed cleanup: punctuation → move to bottom → reindex, each step
// individually skippable (the settings tab exposes the toggles). The three
// transforms carry their own specs; these tests pin the composition order,
// the toggles, and that the pipeline is idempotent as a whole.

describe("tidyFootnotes", () => {
    const MESSY = "Alpha[^2], bravo[^1].\n\n[^2]: two\n\nCharlie tail.";

    it("applies all three cleanups in one pass", () => {
        const expected =
            "Alpha,[^1] bravo.[^2]\n\nCharlie tail.\n\n[^1]: two";
        expect(tidyFootnotes(MESSY)).toBe(expected);
    });

    it("adds the section heading when given", () => {
        const input = "Word[^1].\n\n[^1]: def";
        const expected = "Word.[^1]\n# Footnotes\n\n[^1]: def";
        expect(tidyFootnotes(input, { sectionHeading: "# Footnotes" })).toBe(
            expected,
        );
    });

    it("leaves a tidy document unchanged", () => {
        const text = "Alpha.[^1] bravo,[^2]\n\n[^1]: one\n[^2]: two";
        expect(tidyFootnotes(text)).toBe(text);
    });

    it("skips the punctuation fix when toggled off", () => {
        const expected =
            "Alpha[^1], bravo[^2].\n\nCharlie tail.\n\n[^1]: two";
        expect(tidyFootnotes(MESSY, { fixPunctuation: false })).toBe(expected);
    });

    it("skips moving definitions when toggled off", () => {
        // the definition stays mid-document; reindex still renumbers
        const expected =
            "Alpha,[^1] bravo.[^2]\n\n[^1]: two\n\nCharlie tail.";
        expect(tidyFootnotes(MESSY, { moveDefinitionsToBottom: false })).toBe(
            expected,
        );
    });

    it("skips reindexing when toggled off", () => {
        const expected =
            "Alpha,[^2] bravo.[^1]\n\nCharlie tail.\n\n[^2]: two";
        expect(tidyFootnotes(MESSY, { reindex: false })).toBe(expected);
    });

    it("returns the input unchanged when every step is off", () => {
        expect(
            tidyFootnotes(MESSY, {
                fixPunctuation: false,
                moveDefinitionsToBottom: false,
                reindex: false,
            }),
        ).toBe(MESSY);
    });

    it("passes reindex options through", () => {
        const input = "Word[^3].\n\n[^3]: def\n[^9]: orphan";
        const expected = "Word.[^1]\n\n[^1]: def";
        expect(
            tidyFootnotes(input, {
                reindexOptions: { keepOrphanedDefinitions: false },
            }),
        ).toBe(expected);
    });

    it("is idempotent", () => {
        const messy =
            "b[^9]... a[^note],\n\n[^9]: nine\n\nmid text[^3].\n\n[^3]: three\n[^8]: orphan";
        const options = {
            sectionHeading: "# Footnotes",
            reindexOptions: { renumberNamedFootnotes: true },
        };
        const once = tidyFootnotes(messy, options);
        expect(tidyFootnotes(once, options)).toBe(once);
    });
});
