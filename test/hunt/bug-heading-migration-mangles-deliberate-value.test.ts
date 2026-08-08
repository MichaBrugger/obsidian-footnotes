import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";

// BUG (found in the 2026-08-07 QOL/perf audit, CONFIRMED LIVE 2026-08-08 in
// the sandbox vault): loadSettings' pre-0.2.0 section-heading migration
// pattern-matches the SAVED value on every load, prepending "# " to
// anything that doesn't start with "#{1,6} ", "---", "***", or "___". The
// 0.2.0 textarea explicitly accepts arbitrary markdown, so a deliberately
// saved value like "**Footnotes**" is silently rewritten to
// "# **Footnotes**" on the next app start (once per distinct value, and
// again every time the user re-saves a non-matching value). The migration
// cannot tell legacy plain text from an intentional new-style value.
// Proposed fix: run the migration exactly once (a settings-version flag)
// instead of pattern-matching forever.
// Pinned as expected-fail until Jason picks the fix.

function pluginWithSavedData(data: Record<string, unknown>): FootnotePlugin {
    const plugin = new FootnotePlugin();
    plugin.loadData = async () => data;
    plugin.saveData = async () => {};
    return plugin;
}

describe("bug: heading migration mangles a deliberate non-heading value", () => {
    it.fails("a saved '**Footnotes**' survives loadSettings unchanged", async () => {
        const plugin = pluginWithSavedData({
            footnoteSectionHeading: "**Footnotes**",
        });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("**Footnotes**");
    });

    it("documents today's behavior: the value gains a '# ' prefix", async () => {
        const plugin = pluginWithSavedData({
            footnoteSectionHeading: "**Footnotes**",
        });
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("# **Footnotes**");
    });

    it("heading-shaped and divider-led values are left alone", async () => {
        for (const value of ["# Footnotes", "---\n## Footnotes", "***"]) {
            const plugin = pluginWithSavedData({
                footnoteSectionHeading: value,
            });
            await plugin.loadSettings();
            expect(plugin.settings.footnoteSectionHeading).toBe(value);
        }
    });
});
