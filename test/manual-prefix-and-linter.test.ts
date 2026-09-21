import { describe, expect, it } from "vitest";

import FootnotePlugin from "../src/main";
import { lintFootnotes, lintOptionsFromSettings } from "../src/linting/linter";

// Manual sheet 09 ("Footnote prefix and the linter"), moved down into
// units on 2026-09-20. These replace three of the sheet's four checks:
//
//   1. "The fence matches": one lint over the sheet's own fixture, with
//      the sheet's own settings, produces the sheet's own fence.
//   2. "Running lint again shows 'No linting needed.' (idempotent)": the
//      second lint changes nothing. The toast wording itself is the smoke
//      suite's job (scenario "clean note lint reports 'No linting
//      needed.'").
//   3. "With `Apply the note's footnote prefix` OFF ...": the plain
//      footnotes reindex while the prefixed one and the named one both
//      keep their ids.
//
// The fourth check (the settings page greying the rule out) stays on the
// sheet: only a human looking at the settings tab can judge that.
//
// The fixture is the sheet's note with the prose around it left out: its
// frontmatter prefix, its reference line, and its four definitions.

// The settings line at the top of sheet 09, written out: the prefix
// feature on, every lint rule on, and "Renumber named footnotes" off.
function sheet15Plugin(overrides: Record<string, boolean> = {}): FootnotePlugin {
    return {
        settings: {
            enableFootnotePrefix: true,
            lintApplyPrefix: true,
            lintFixPunctuation: true,
            lintFixLazyDefinitions: true,
            lintMoveToBottom: true,
            lintReindex: true,
            lintMergeDuplicateDefinitions: true,
            lintDeleteOrphanedReferences: true,
            lintDeleteOrphanedDefinitions: true,
            renumberNamedFootnotes: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "# Footnotes",
            ...overrides,
        },
    } as unknown as FootnotePlugin;
}

// the sheet's fixture: plain footnotes written "before" the prefix
// existed, one already-prefixed footnote, and one named footnote
const NOTE = [
    "---",
    "footnote-prefix: 2=",
    "---",
    "b[^2] a[^1] pre[^2=5] n[^note] end",
    "",
    "[^1]: one",
    "[^2]: two",
    "[^2=5]: already prefixed",
    "[^note]: named",
].join("\n");

function lintOnce(note: string, overrides: Record<string, boolean> = {}): string {
    const plugin = sheet15Plugin(overrides);
    return lintFootnotes(note, lintOptionsFromSettings(plugin, "", note));
}

describe("sheet 09: one lint under a footnote prefix", () => {
    it("matches the sheet's fence", () => {
        // plain footnotes adopt the prefix, the named one keeps its name
        // behind the prefix, and then the WHOLE namespace renumbers by
        // reading order, so the already-prefixed "2=5" becomes "2=3"
        expect(lintOnce(NOTE)).toBe(
            [
                "---",
                "footnote-prefix: 2=",
                "---",
                "b[^2=1] a[^2=2] pre[^2=3] n[^2=note] end",
                "",
                "[^2=1]: two",
                "[^2=2]: one",
                "[^2=3]: already prefixed",
                "[^2=note]: named",
            ].join("\n"),
        );
    });

    it("a second lint has nothing left to do", () => {
        const once = lintOnce(NOTE);
        expect(lintOnce(once)).toBe(once);
    });
});

describe("sheet 09: the apply-prefix rule turned off", () => {
    it("plain footnotes reindex while the prefixed and named ones keep their ids", () => {
        // with the rule off, a footnote carrying the prefix is treated as
        // a NAMED footnote (QOL 2026-08-08), so only the plain pair moves
        const result = lintOnce(NOTE, { lintApplyPrefix: false });
        expect(result).toContain("b[^1] a[^2] pre[^2=5] n[^note] end");
        // the definitions follow their references into reading order
        expect(result).toContain(
            ["[^1]: two", "[^2]: one", "[^2=5]: already prefixed", "[^note]: named"].join("\n"),
        );
    });
});
