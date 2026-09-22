import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { reindexFootnotes } from "../src/linting/rules/re-index-footnotes";
import { nameForBody } from "../src/parsing/footnote-grammar";

// One universal Footnote names setting (Jason, 2026-09-22): Keep as
// written (the default, and what every note had before), Numbered (the
// linter renumbers named footnotes, the old Renumber named footnotes
// toggle), or Named (the linter names numbered footnotes after the first
// meaningful word of their definition, leaving the already named alone so
// a lint never renames twice). The inline-to-normal converter reads the
// same setting. The reindex rule carries the two halves as options.

function reindex(lines: string[], options: Parameters<typeof reindexFootnotes>[1]) {
    return reindexFootnotes(lines.join("\n"), options).split("\n");
}

describe("reindex under Named: numbered footnotes take names from their definitions", () => {
    it("names each numbered footnote after the first meaningful word of its body, references and label alike", () => {
        expect(reindex(["a[^1] b[^2]", "", "[^1]: the Smith paper", "[^2]: see p. 5 of Jones"], { nameNumberedFootnotes: true })).toEqual([
            "a[^Smith] b[^Jones]",
            "",
            "[^Smith]: the Smith paper",
            "[^Jones]: see p. 5 of Jones",
        ]);
    });

    it("leaves an already named footnote alone, and renumbers a numbered one whose body offers no word", () => {
        expect(reindex(["x[^note] y[^7]", "", "[^note]: n", "[^7]: of the"], { nameNumberedFootnotes: true })).toEqual([
            "x[^note] y[^1]",
            "",
            "[^note]: n",
            "[^1]: of the",
        ]);
    });

    it("keeps a generated name clear of the note's own names", () => {
        expect(reindex(["a[^1] b[^smith]", "", "[^1]: Smith again", "[^smith]: s"], { nameNumberedFootnotes: true })).toEqual([
            "a[^Smith-2] b[^smith]",
            "",
            "[^Smith-2]: Smith again",
            "[^smith]: s",
        ]);
    });

    it("names inside the prefix namespace when the note has a prefix", () => {
        expect(reindexFootnotes("a[^2-1]\n\n[^2-1]: the Smith paper", { nameNumberedFootnotes: true, prefix: "2-" })).toBe(
            "a[^2-Smith]\n\n[^2-Smith]: the Smith paper",
        );
    });

    it("is idempotent: a second pass changes nothing", () => {
        const once = reindexFootnotes("a[^1] b[^2] c[^3]\n\n[^1]: the Smith paper\n[^2]: of the\n[^3]: Smith again", { nameNumberedFootnotes: true });
        expect(reindexFootnotes(once, { nameNumberedFootnotes: true })).toBe(once);
    });

    it("never names a footnote after a number, since that would read as numbered again", () => {
        expect(nameForBody("2024 was the year", new Set())).toBe("year");
    });
});

function pluginWithSavedData(data: Record<string, unknown>): FootnotePlugin {
    const plugin = new (FootnotePlugin as unknown as new () => FootnotePlugin)();
    plugin.loadData = () => Promise.resolve(data);
    plugin.saveData = () => Promise.resolve();
    return plugin;
}

describe("the Footnote names setting", () => {
    it("defaults to keeping names as written", async () => {
        const plugin = pluginWithSavedData({ settingsVersion: 3 });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteNaming).toBe("keep");
    });

    it("migrates the old Renumber named footnotes toggle and the old converter dropdown, and drops their keys", async () => {
        const renumbering = pluginWithSavedData({ settingsVersion: 2, renumberNamedFootnotes: true });
        await renumbering.loadSettings();
        expect(renumbering.settings.footnoteNaming).toBe("numbered");
        expect("renumberNamedFootnotes" in renumbering.settings).toBe(false);
        const naming = pluginWithSavedData({ settingsVersion: 2, renumberNamedFootnotes: false, convertedFootnoteNames: "named" });
        await naming.loadSettings();
        expect(naming.settings.footnoteNaming).toBe("named");
        expect("convertedFootnoteNames" in naming.settings).toBe(false);
        const neither = pluginWithSavedData({ settingsVersion: 2, renumberNamedFootnotes: false });
        await neither.loadSettings();
        expect(neither.settings.footnoteNaming).toBe("keep");
    });

    it("drops an unknown saved value for the default", async () => {
        const plugin = pluginWithSavedData({ settingsVersion: 3, footnoteNaming: "sideways" });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteNaming).toBe("keep");
    });
});
