import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";

import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";

// BUG: selecting a quoted or emphasized phrase and pressing the numbered
// hotkey pulls the phrase's CLOSING mark into the footnote and leaves the
// opening one behind in the prose.
//
// What the user would see: with the line
//   This is "some bravo". End
// and exactly `some bravo` selected, the press leaves
//   This is "[^1] End
// with the definition
//   [^1]: some bravo".
// The opening quote now has no partner, and the closing quote plus the
// full stop have moved into the footnote's text. The `**bold**` twin is
// worse: the line is left with an unclosed `**`, so everything after it
// renders as bold.
//
// Hunt: 2026-09-13. Lens: selection conversion / the landing convention.
//
// Source of truth:
//  - README, line ~83: a selection that starts or ends mid-word "grows to
//    whole words first, plus one trailing punctuation mark".
//  - selection-footnote.ts's own comment on the expansion, same wording:
//    "The end moves to the end of its word plus one punctuation mark".
//  - manual sheet 06, line ~20: only the period is taken.
//  - commit 5ec4b66 (2026-09-09), which grew the walk into the full run of
//    closing marks, names only the reference-PLACEMENT consumers. It sets
//    no rule for selections.
//
// The open question the fix has to settle is narrow: when a selection ends
// at a closing mark, should the expansion take the punctuation that comes
// after that mark, or nothing at all? Either answer forbids what happens
// today, which is swallowing the closing mark itself.
//
// Cause: the expansion in selection-footnote.ts reuses endOfWordOffset,
// which since 5ec4b66 ends in referenceLandingAfter, the whole closing
// mark run.

const settings = {
    insertAtEndOfWord: true,
    expandSelectionToWholeWords: true,
    enablePopupEditor: false,
    enableFootnotePrefix: false,
    enableFootnoteSectionHeading: false,
    enableRemoveBlankLastLines: true,
};

function selecting(line: string, from: number, to: number) {
    return fakeEditor([line], {
        cursor: { line: 0, ch: from },
        selection: { anchor: { line: 0, ch: from }, head: { line: 0, ch: to } },
        edits: true,
        wholeDoc: true,
        words: true,
    });
}

const QUOTED = 'This is "some bravo". End';
const BOLD = "This is **some bravo** end";

describe("a selection ending at a closing mark", () => {
    it.fails("leaves the closing quote on the line", async () => {
        const doc = selecting(QUOTED, QUOTED.indexOf("some"), QUOTED.indexOf('"', 9));
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines[0]).toBe('This is "[^1]". End');
    });

    it.fails("keeps the closing quote out of the definition", async () => {
        const doc = selecting(QUOTED, QUOTED.indexOf("some"), QUOTED.indexOf('"', 9));
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines.at(-1)).toBe("[^1]: some bravo");
    });

    it.fails("leaves the closing bold markers on the line", async () => {
        const doc = selecting(BOLD, BOLD.indexOf("some"), BOLD.indexOf("**", 9));
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines[0]).toBe("This is **[^1]** end");
    });

    it.fails("keeps the closing bold markers out of the definition", async () => {
        const doc = selecting(BOLD, BOLD.indexOf("some"), BOLD.indexOf("**", 9));
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines.at(-1)).toBe("[^1]: some bravo");
    });

    // The control: a phrase with no marks around it still picks up its
    // trailing full stop, which is the rule the README states and the one
    // the fix must leave alone.
    it("a bare phrase still takes its trailing full stop (control)", async () => {
        const line = "Bob loves Bill. Lorem ipsum dolor sit. End";
        const doc = selecting(line, line.indexOf("dolor"), line.indexOf(". End"));
        await insertAutonumFootnote(fakePlugin(settings, doc));
        expect(doc.lines[0]).toBe("Bob loves Bill. Lorem ipsum[^1] End");
        expect(doc.lines.at(-1)).toBe("[^1]: dolor sit.");
    });
});
