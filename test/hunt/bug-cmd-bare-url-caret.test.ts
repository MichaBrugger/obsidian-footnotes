// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 2 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";
import {
    fakeEditor as sharedFakeEditor,
    FakeEditor,
} from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";

// A user with "insert at end of word" on presses the numbered key while the
// caret sits inside a bare URL (or an <autolink>): "see https://exa|mple.com".
// The word walk ends mid-URL and referenceLandingAfter then steps over the
// "." (or ":") because those sit in TrailingPunctuationChars, landing the
// reference INSIDE the address: "https://example.[^1]com". The link the user
// was editing is split into dead text. bug-cmd-link-url-caret pins the same
// walk landing inside a markdown link's (url) part; this is the sibling
// shape that even a perfect "](" fix cannot reach, because a bare URL has no
// "](" delimiter for the walk to start from.

function fakeEditor(lines: string[], ch: number): FakeEditor {
    return sharedFakeEditor(lines, {
        cursor: { line: 0, ch },
        edits: true,
        wholeDoc: true,
        words: true,
    });
}

function fakePlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            insertAtEndOfWord: true,
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

describe("caret inside a bare URL or autolink (end-of-word walk)", () => {
    it("lands after the whole bare URL, not between domain segments", async () => {
        const doc = fakeEditor(
            ["see https://example.com end"],
            "see https://exa".length,
        );
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("see https://example.com[^1] end");
    });

    it("lands after the whole autolink, not inside the scheme", async () => {
        const doc = fakeEditor(["see <https://x.co> end"], "see <ht".length);
        await insertAutonumFootnote(fakePlugin(doc));
        expect(doc.lines[0]).toBe("see <https://x.co>[^1] end");
    });
});
