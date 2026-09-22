import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";

// The v2 settings migration (2026-08-10): the two orphan settings became
// symmetric delete toggles in the Rules section. keepOrphanedDefinitions
// (shipped in the 0.2.0 betas) carries over with its polarity flipped;
// the short-lived lintOrphanedMarkers dropdown maps alert→off, delete→on.

function pluginWithSavedData(data: Record<string, unknown>): FootnotePlugin {
    const plugin = new (FootnotePlugin as unknown as new () => FootnotePlugin)();
    plugin.loadData = () => Promise.resolve(data);
    plugin.saveData = () => Promise.resolve();
    return plugin;
}

describe("settings migration to v2 (symmetric orphan toggles)", () => {
    it("keepOrphanedDefinitions: true becomes delete-off", async () => {
        const plugin = pluginWithSavedData({
            settingsVersion: 1,
            keepOrphanedDefinitions: true,
        });
        await plugin.loadSettings();
        expect(plugin.settings.lintDeleteOrphanedDefinitions).toBe(false);
        expect("keepOrphanedDefinitions" in plugin.settings).toBe(false);
    });

    it("keepOrphanedDefinitions: false becomes delete-on", async () => {
        const plugin = pluginWithSavedData({
            settingsVersion: 1,
            keepOrphanedDefinitions: false,
        });
        await plugin.loadSettings();
        expect(plugin.settings.lintDeleteOrphanedDefinitions).toBe(true);
    });

    it("the lintOrphanedMarkers dropdown maps to the toggle", async () => {
        const alert = pluginWithSavedData({
            settingsVersion: 1,
            lintOrphanedMarkers: "alert",
        });
        await alert.loadSettings();
        expect(alert.settings.lintDeleteOrphanedReferences).toBe(false);
        expect("lintOrphanedMarkers" in alert.settings).toBe(false);

        const del = pluginWithSavedData({
            settingsVersion: 1,
            lintOrphanedMarkers: "delete",
        });
        await del.loadSettings();
        expect(del.settings.lintDeleteOrphanedReferences).toBe(true);
    });

    it("pre-versioned (0.1.x) data runs both migration stages", async () => {
        const plugin = pluginWithSavedData({
            FootnoteSectionHeading: "Notes",
            keepOrphanedDefinitions: false,
        });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("# Notes");
        expect(plugin.settings.lintDeleteOrphanedDefinitions).toBe(true);
        expect(plugin.settings.settingsVersion).toBe(3);
    });

    it("a fresh install gets both toggles off", async () => {
        const plugin = pluginWithSavedData({});
        await plugin.loadSettings();
        expect(plugin.settings.lintDeleteOrphanedReferences).toBe(false);
        expect(plugin.settings.lintDeleteOrphanedDefinitions).toBe(false);
    });
});
