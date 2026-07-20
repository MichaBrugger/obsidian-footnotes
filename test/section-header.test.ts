import { describe, expect, it } from "vitest";

import { addFootnoteSectionHeader } from "../src/insert-or-navigate-footnotes";
import type FootnotePlugin from "../src/main";

// The optional heading inserted above the first footnote detail. A blank
// line ALWAYS separates the heading from the content above it (markdown
// block convention, requested 2026-07-20) — which also keeps a heading
// starting with a divider (---/***/___) from turning the last text line
// into a setext heading. The live insertion is covered by the smoke suite.

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

    it("keeps a blank line above a plain heading", () => {
        expect(addFootnoteSectionHeader(fakePlugin(true, "# Footnotes"))).toBe(
            "\n\n# Footnotes",
        );
    });

    it("keeps a blank line above a leading --- divider", () => {
        // doubly important here: a divider directly below a text line
        // would turn that line into a setext heading
        expect(
            addFootnoteSectionHeader(fakePlugin(true, "---\n## Footnotes")),
        ).toBe("\n\n---\n## Footnotes");
    });

    it("treats *** the same", () => {
        expect(addFootnoteSectionHeader(fakePlugin(true, "***"))).toBe("\n\n***");
    });

    it("treats ___ the same", () => {
        expect(addFootnoteSectionHeader(fakePlugin(true, "___"))).toBe("\n\n___");
    });

    it("passes multi-line headings through untouched", () => {
        expect(
            addFootnoteSectionHeader(fakePlugin(true, "## Footnotes\n> sources below")),
        ).toBe("\n\n## Footnotes\n> sources below");
    });
});
