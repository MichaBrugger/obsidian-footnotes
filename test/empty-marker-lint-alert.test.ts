import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import {
    countEmptyFootnoteMarkers,
    lintRulesAllDisabled,
} from "../src/linting/linter";

// QOL sweep (2026-08-07): the lint paths alert on abandoned empty "[^]"
// markers — every rule is blind to them (the marker regexes require a
// name) and Obsidian won't render them, so without the alert they linger
// in the note forever. Companion pin: the "Lint footnotes" command tells
// the user when every rule is toggled off instead of implying the note
// was checked and found clean.

describe("countEmptyFootnoteMarkers", () => {
    it("counts every [^] occurrence, including several on one line", () => {
        expect(countEmptyFootnoteMarkers("a [^] b [^] c\nd [^] e")).toBe(3);
    });

    it("returns 0 for a note without empty markers", () => {
        expect(countEmptyFootnoteMarkers("a [^1] b\n\n[^1]: one")).toBe(0);
    });

    it("ignores [^] inside code fences and inline code (#41 semantics)", () => {
        const markdown = "```\n[^]\n```\nand `x [^] y` in code";
        expect(countEmptyFootnoteMarkers(markdown)).toBe(0);
    });

    it("ignores [^] inside frontmatter", () => {
        expect(countEmptyFootnoteMarkers("---\ntitle: \"[^]\"\n---\ntext")).toBe(0);
    });

    it("handles CRLF notes", () => {
        expect(countEmptyFootnoteMarkers("a [^] b\r\nc [^] d")).toBe(2);
    });
});

function pluginWithLintSettings(
    overrides: Record<string, boolean>,
): FootnotePlugin {
    return {
        settings: {
            lintFixPunctuation: false,
            lintMoveToBottom: false,
            lintReindex: false,
            lintApplyPrefix: false,
            enableFootnotePrefix: false,
            ...overrides,
        },
    } as unknown as FootnotePlugin;
}

describe("lintRulesAllDisabled", () => {
    it("is true when every rule is off", () => {
        expect(lintRulesAllDisabled(pluginWithLintSettings({}))).toBe(true);
    });

    it("is false when any rule is on", () => {
        expect(
            lintRulesAllDisabled(pluginWithLintSettings({ lintReindex: true })),
        ).toBe(false);
    });

    it("apply-prefix only counts while the prefix feature is on", () => {
        expect(
            lintRulesAllDisabled(pluginWithLintSettings({ lintApplyPrefix: true })),
        ).toBe(true);
        expect(
            lintRulesAllDisabled(
                pluginWithLintSettings({
                    lintApplyPrefix: true,
                    enableFootnotePrefix: true,
                }),
            ),
        ).toBe(false);
    });
});
