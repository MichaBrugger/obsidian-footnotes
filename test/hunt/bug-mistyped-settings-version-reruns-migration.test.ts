import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";

// BUG: a settingsVersion saved with the wrong type (the string "2", or
// null) is dropped by the settings parser, so the plugin reads the file as
// version 0 and runs both one-time migrations again over current data.
//
// What the user would see: their section heading changes by itself. A
// heading they deliberately set to "**Footnotes**" comes back as
// "# **Footnotes**" after a restart, and because the migration saves what it
// did, the mangled value is now what is on disk. This is the 2026-08-08 bug
// (bug-heading-migration-mangles-deliberate-value) re-opened through a
// different door: the version gate that fixed it depends on a value the
// parser can quietly throw away.
//
// Hunt: 2026-09-13. Lens: the rule catalogue (saved settings).
//
// Source of truth: bug-heading-migration-mangles-deliberate-value, the pin
// this regresses ("a deliberate non-heading value saved by a current build
// survives", and nothing is written when nothing migrated); and
// parseSavedSettings' own doc comment, which names a hand edit or a sync
// merge as the threat model it was written for (review A9, Jason confirmed
// against the live app 2026-09-08).

// the real Plugin constructor wants (app, manifest); these tests only
// exercise loadSettings, so construct without them
function withSaved(data: Record<string, unknown>): {
    plugin: FootnotePlugin;
    saves: () => number;
} {
    const plugin = new (FootnotePlugin as unknown as new () => FootnotePlugin)();
    let saveCount = 0;
    plugin.loadData = () => Promise.resolve(data);
    plugin.saveData = () => {
        saveCount++;
        return Promise.resolve();
    };
    return { plugin, saves: () => saveCount };
}

describe("a settingsVersion whose type does not match its default", () => {
    it('a version saved as the string "2" leaves the heading alone', async () => {
        // the parser keeps only values whose type matches the type of their
        // default, so "2" is dropped, the version reads as 0, and the v1
        // heading rewrite prepends "# " to a value the user chose on purpose
        const { plugin, saves } = withSaved({
            settingsVersion: "3",
            footnoteSectionHeading: "**Footnotes**",
        });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("**Footnotes**");
        // nothing migrated means nothing written, so the rewrite cannot be
        // made permanent behind the user's back
        expect(saves()).toBe(0);
    });

    it("a null version does the same", async () => {
        const { plugin } = withSaved({
            settingsVersion: null,
            footnoteSectionHeading: "**Footnotes**",
        });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("**Footnotes**");
    });

    it("control: a correctly typed version is honoured, fractional or not", async () => {
        const { plugin, saves } = withSaved({
            settingsVersion: 3.5,
            footnoteSectionHeading: "**Footnotes**",
        });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("**Footnotes**");
        expect(saves()).toBe(0);
    });
});
