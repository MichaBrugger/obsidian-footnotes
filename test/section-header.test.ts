import { describe, expect, it } from "vitest";

import { addFootnoteSectionHeader } from "../src/insert-or-navigate-footnotes";
import type FootnotePlugin from "../src/main";

// The optional heading inserted above the first footnote detail. The one
// subtle rule: a heading STARTING with a divider (---/***/___) needs an
// extra blank line above it, or the divider turns the last text line into
// a setext heading. The live insertion is covered by the smoke suite.

// The function only reads two settings, so the fake plugin is just those.
function fakePlugin(enabled: boolean, heading: string): FootnotePlugin {
    return {
        settings: {
            enableFootnoteSectionHeading: enabled,
            footnoteSectionHeading: heading,
        },
    } as unknown as FootnotePlugin;
}

describe("addFootnoteSectionHeader", () => {
    it("returns an empty string when the setting is disabled", () => {
        expect(addFootnoteSectionHeader(fakePlugin(false, "# Footnotes"))).toBe("");
    });

    it("prefixes a plain heading with one newline", () => {
        expect(addFootnoteSectionHeader(fakePlugin(true, "# Footnotes"))).toBe(
            "\n# Footnotes",
        );
    });

    it("keeps a blank line above a leading --- divider", () => {
        // a divider directly below a text line would turn that line into a
        // setext heading, so the divider needs an extra blank line above it
        expect(
            addFootnoteSectionHeader(fakePlugin(true, "---\n## Footnotes")),
        ).toBe("\n\n---\n## Footnotes");
    });

    it("treats *** as a divider too", () => {
        expect(addFootnoteSectionHeader(fakePlugin(true, "***"))).toBe("\n\n***");
    });

    it("treats ___ as a divider too", () => {
        expect(addFootnoteSectionHeader(fakePlugin(true, "___"))).toBe("\n\n___");
    });

    it("passes multi-line headings through untouched", () => {
        expect(
            addFootnoteSectionHeader(fakePlugin(true, "## Footnotes\n> sources below")),
        ).toBe("\n## Footnotes\n> sources below");
    });
});
