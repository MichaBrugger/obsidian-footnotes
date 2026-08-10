import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { lintFootnotes, lintOptionsFromSettings } from "../src/linting/linter";

// Manual combo-test feedback (Jason, 2026-08-08): with the prefix FEATURE
// on but the "Apply the note's footnote prefix" rule OFF, linting still
// renumbered prefixed footnotes within their namespace — weirdly
// inconsistent, since nothing else was being prefixed. Prefix-aware
// reindexing is now gated on the apply rule too: while it is off,
// footnotes carrying the prefix are treated as NAMED footnotes and keep
// their ids.

function pluginWith(overrides: Record<string, boolean>): FootnotePlugin {
    return {
        settings: {
            enableFootnotePrefix: true,
            lintApplyPrefix: true,
            lintFixPunctuation: true,
            lintMoveToBottom: true,
            lintReindex: true,
            keepOrphanedDefinitions: true,
            renumberNamedFootnotes: false,
            lintOrphanedMarkers: "alert",
            ...overrides,
        },
    } as unknown as FootnotePlugin;
}

const NOTE = [
    "---",
    "footnote-prefix: 2.",
    "---",
    "b[^2.9] a[^2.4] end",
    "",
    "[^2.4]: four",
    "[^2.9]: nine",
].join("\n");

describe("prefix-aware reindexing is gated on the apply-prefix rule", () => {
    it("apply ON: prefixed footnotes renumber within their namespace", () => {
        const options = lintOptionsFromSettings(pluginWith({}), "", NOTE);
        expect(options.prefixAware).toBe(true);
        const result = lintFootnotes(NOTE, options);
        expect(result).toContain("b[^2.1] a[^2.2] end");
    });

    it("apply OFF: prefixed footnotes keep their ids like named footnotes", () => {
        const options = lintOptionsFromSettings(
            pluginWith({ lintApplyPrefix: false }),
            "",
            NOTE,
        );
        expect(options.prefixAware).toBe(false);
        const result = lintFootnotes(NOTE, options);
        // ids untouched; the definitions still reorder to appearance order,
        // exactly as named footnotes always have
        expect(result).toContain("b[^2.9] a[^2.4] end");
        expect(result.indexOf("[^2.9]: nine")).toBeLessThan(
            result.indexOf("[^2.4]: four"),
        );
    });

    it("feature OFF entirely: prefixAware stays off regardless of the rule", () => {
        const options = lintOptionsFromSettings(
            pluginWith({ enableFootnotePrefix: false }),
            "",
            NOTE,
        );
        expect(options.prefixAware).toBe(false);
        expect(options.applyNotePrefix).toBe(false);
    });
});
