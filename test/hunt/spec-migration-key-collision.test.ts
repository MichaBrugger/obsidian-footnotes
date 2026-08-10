import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";

// spec question: if data.json carries BOTH the legacy PascalCase
// FootnoteSectionHeading key and the current camelCase footnoteSectionHeading
// key with settingsVersion 0, which value should the migration keep?
// Hunt: 2026-08-09. Lens: regressions.
// The migration copies the legacy value OVER the newer camelCase one and then
// re-mangles it with "# ". Git archaeology says real upgrade paths can't
// produce this state (0c54a45 deleted the old key on every load) — only a
// downgrade or a sync merge could — so the newer setting silently loses in a
// scenario that may be unreachable.

function bareFootnotePlugin(): FootnotePlugin {
    return new (FootnotePlugin as unknown as new () => FootnotePlugin)();
}

describe("spec question: migration with both heading keys present", () => {
    it.fails("both PascalCase and camelCase heading keys: the newer key should win", async () => {
        const plugin = bareFootnotePlugin();
        plugin.loadData = async () => ({
            FootnoteSectionHeading: "Plain Old",
            footnoteSectionHeading: "# New",
            settingsVersion: 0,
        });
        plugin.saveData = async () => {};
        await plugin.loadSettings();
        expect(plugin.settings.footnoteSectionHeading).toBe("# New");
    });
});
