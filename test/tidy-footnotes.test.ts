import { describe, expect, it } from "vitest";

import { tidyFootnotes } from "../src/tidy-footnotes";

// The composed cleanup: punctuation → move to bottom → reindex. The three
// transforms carry their own specs; these tests pin the composition order
// and that the pipeline is idempotent as a whole.

describe("tidyFootnotes", () => {
    it("applies all three cleanups in one pass", () => {
        const input = "Alpha[^2], bravo[^1].\n\n[^2]: two\n\nCharlie tail.";
        const expected =
            "Alpha,[^1] bravo.[^2]\n\nCharlie tail.\n\n[^1]: two";
        expect(tidyFootnotes(input)).toBe(expected);
    });

    it("adds the section heading when given", () => {
        const input = "Word[^1].\n\n[^1]: def";
        const expected = "Word.[^1]\n# Footnotes\n\n[^1]: def";
        expect(tidyFootnotes(input, "# Footnotes")).toBe(expected);
    });

    it("leaves a tidy document unchanged", () => {
        const text = "Alpha.[^1] bravo,[^2]\n\n[^1]: one\n[^2]: two";
        expect(tidyFootnotes(text)).toBe(text);
    });

    it("is idempotent", () => {
        const messy =
            "b[^9]... a[^note],\n\n[^9]: nine\n\nmid text[^3].\n\n[^3]: three\n[^8]: orphan";
        const once = tidyFootnotes(messy, "# Footnotes");
        expect(tidyFootnotes(once, "# Footnotes")).toBe(once);
    });
});
