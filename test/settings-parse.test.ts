import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings";

// BUG (review A9, Jason confirmed live 2026-09-08): loadSettings CAST the
// saved data.json instead of parsing it, so a corrupt value such as
// `"lintReindex": "no"` (a hand edit, a sync merge) flowed straight into
// plugin.settings, where every `if (settings.lintReindex)` read the string
// as truthy: the toggle showed ON and the lint renumbered. Saved values
// whose type does not match the default's are now dropped in favor of the
// default; unknown keys still pass through untouched, because the one-time
// migrations read (and delete) legacy keys from them.

function pluginWithSavedData(data: Record<string, unknown>): FootnotePlugin {
    const plugin = new (FootnotePlugin as unknown as new () => FootnotePlugin)();
    plugin.loadData = () => Promise.resolve(data);
    plugin.saveData = () => Promise.resolve();
    return plugin;
}

describe("loadSettings parses the saved data instead of trusting it", () => {
    it("a wrongly typed value falls back to the default", async () => {
        const plugin = pluginWithSavedData({
            settingsVersion: 2,
            lintReindex: "no",
            footnoteSectionHeading: 5,
            insertAtEndOfWord: false,
        });
        await plugin.loadSettings();
        expect(plugin.settings.lintReindex).toBe(DEFAULT_SETTINGS.lintReindex);
        expect(plugin.settings.footnoteSectionHeading).toBe(DEFAULT_SETTINGS.footnoteSectionHeading);
        // a correctly typed value is still honored
        expect(plugin.settings.insertAtEndOfWord).toBe(false);
    });

    it("legacy keys still reach the migrations", async () => {
        const plugin = pluginWithSavedData({
            settingsVersion: 1,
            keepOrphanedDefinitions: false,
        });
        await plugin.loadSettings();
        expect(plugin.settings.lintDeleteOrphanedDefinitions).toBe(true);
        expect("keepOrphanedDefinitions" in plugin.settings).toBe(false);
    });

    it("null saved data is a fresh install", async () => {
        const plugin = pluginWithSavedData(null as unknown as Record<string, unknown>);
        await plugin.loadSettings();
        expect(plugin.settings.lintReindex).toBe(true);
    });
});
