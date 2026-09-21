import { beforeEach, describe, expect, it } from "vitest";

import { fakeEditor } from "./helpers/fake-editor";
import { fakePlugin } from "./helpers/fake-plugin";
import { resetNotices } from "./helpers/notices";
import { insertAutonumFootnote } from "../src/commands/insert-or-navigate-footnotes";
import { startOfWordOffset } from "../src/editor/cursor-motion";

// Jason's ruling 3 (2026-09-20, option a): a selection that starts AT a
// word's trailing dot ("U.S.| Senate", dragged from just before that dot)
// grows back over the word when it is expanded to whole words, so the
// footnote reads "U.S. Senate" and not ". Senate". A dot between two word
// characters already joined the word (Kimi hunt cycle 5); the trailing dot
// is the same word's last character as far as the selection is concerned.

describe("a selection starting at a word's trailing dot", () => {
    beforeEach(resetNotices);

    it("the start walk crosses the trailing dot and the abbreviation's inner dots", () => {
        const text = "The U.S. Senate met.";
        expect(startOfWordOffset(text, text.indexOf(". Senate"))).toBe(text.indexOf("U.S."));
    });

    it("a sentence-ending dot grows back over its word the same way", () => {
        expect(startOfWordOffset("end. Next", 3)).toBe(0);
    });

    it("control: a dot with no word character before it stays where it is", () => {
        expect(startOfWordOffset("a . b", 2)).toBe(2);
    });

    it("control: a selection starting inside a word still grows to the word's start", () => {
        expect(startOfWordOffset("The U.S. Senate", 10)).toBe(9);
    });

    it("the converted footnote reads \"U.S. Senate\"", async () => {
        const line = "The U.S. Senate met.";
        const from = line.indexOf(". Senate");
        const to = line.indexOf(" met.");
        const doc = fakeEditor([line], {
            wholeDoc: true,
            edits: true,
            words: true,
            cursor: { line: 0, ch: from },
            selection: { anchor: { line: 0, ch: from }, head: { line: 0, ch: to } },
        });
        await insertAutonumFootnote(fakePlugin({ expandSelectionToWholeWords: true }, doc));
        expect(doc.lines).toEqual(["The[^1] met.", "", "[^1]: U.S. Senate"]);
    });
});
