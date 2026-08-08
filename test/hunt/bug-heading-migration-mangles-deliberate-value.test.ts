import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";

// BUG (found in the 2026-08-07 QOL/perf audit, CONFIRMED LIVE 2026-08-08,
// FIXED same day): loadSettings' pre-0.2.0 section-heading migration used
// to pattern-match the SAVED value on every load, prepending "# " to
// anything that doesn't look like a heading or divider — silently mangling
// a deliberately saved markdown value like "**Footnotes**" on the next
// restart. The migrations now run exactly once, gated by settingsVersion:
// saveSettings stamps the current version, so any value saved by a current
// build survives every later load untouched. Pre-flag data (no version
// key) still migrates once — indistinguishable from true legacy data by
// construction — and all migrations share a single save.

// the real Plugin constructor wants (app, manifest); these tests only
// exercise loadSettings, so construct without them
function bareFootnotePlugin(): FootnotePlugin {
    return new (FootnotePlugin as unknown as new () => FootnotePlugin)();
}

function pluginWithSavedData(data: Record<string, unknown>): {
    plugin: FootnotePlugin;
    saves: () => number;
} {
    const plugin = bareFootnotePlugin();
    let saveCount = 0;
    plugin.loadData = async () => data;
    plugin.saveData = async () => {
        saveCount++;
    };
    return { plugin, saves: () => saveCount };
}

describe("one-shot settings migration (heading-mangle bug fix)", () => {
    it("a deliberate non-heading value saved by a current build survives", async () => {
        // saveSettings always writes settingsVersion, so this is what any
        // value saved from the settings tab looks like on disk
        const { plugin, saves } = pluginWithSavedData({
            footnoteSectionHeading: "**Footnotes**",
            settingsVersion: 1,
        });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("**Footnotes**");
        // nothing migrated, so nothing was written either
        expect(saves()).toBe(0);
    });

    it("pre-flag data still migrates once: plain text becomes an H1", async () => {
        const { plugin } = pluginWithSavedData({
            footnoteSectionHeading: "Footnotes",
        });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("# Footnotes");
        expect(plugin.settings.settingsVersion).toBe(1);
    });

    it("a fully legacy payload migrates in ONE save", async () => {
        const { plugin, saves } = pluginWithSavedData({
            FootnoteSectionHeading: "Notes",
            enableAutoSuggest: true,
            tidyReindex: false,
            tidyOnSave: true,
            lintOnFileChange: true,
        });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("# Notes");
        expect(plugin.settings.lintReindex).toBe(false);
        expect(plugin.settings.lintOnSave).toBe(true);
        expect("enableAutoSuggest" in plugin.settings).toBe(false);
        expect("lintOnFileChange" in plugin.settings).toBe(false);
        expect(plugin.settings.settingsVersion).toBe(1);
        expect(saves()).toBe(1);
    });

    it("heading-shaped and divider-led legacy values are left alone", async () => {
        for (const value of ["# Footnotes", "---\n## Footnotes", "***"]) {
            const { plugin } = pluginWithSavedData({
                footnoteSectionHeading: value,
            });
            await plugin.loadSettings();
            expect(plugin.settings.footnoteSectionHeading).toBe(value);
        }
    });

    it("a fresh install stamps the version without changing any default", async () => {
        const plugin = bareFootnotePlugin();
        plugin.loadData = async () => null;
        plugin.saveData = async () => {};
        await plugin.loadSettings();
        expect(plugin.settings.settingsVersion).toBe(1);
        expect(plugin.settings.footnoteSectionHeading).toBe("# Footnotes");
    });
});
