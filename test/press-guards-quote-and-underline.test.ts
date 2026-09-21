import { beforeEach, describe, expect, it } from "vitest";

import { fakeEditor } from "./helpers/fake-editor";
import { fakePlugin } from "./helpers/fake-plugin";
import { messages, noticed, resetNotices } from "./helpers/notices";
import { insertAutonumFootnote } from "../src/commands/insert-or-navigate-footnotes";
import { ProtectedCreationNotice } from "../src/editor/insertion-liveness";
import { scanDocument } from "../src/parsing/markdown-scan";

// Jason's rulings 4 and 5 (2026-09-20): a press with the caret in front
// of a blockquote marker, or on a setext underline line, refuses with the
// protected-text toast. Before, the first wrote the reference before the
// ">" and the line dropped out of its quote ("[^1]> text" is a paragraph),
// and the second wrote it into the underline, which stopped being one, so
// the heading above turned back into prose. The table delimiter-row press
// already refused for the same reason.

describe("a press with the caret in front of a quote marker (ruling 4)", () => {
    beforeEach(resetNotices);

    it("refuses at column 0 of a quoted line", async () => {
        const before = ["> A quoted line.", "> Another quoted line."];
        const doc = fakeEditor(before, { wholeDoc: true, edits: true, cursor: { line: 1, ch: 0 } });
        await insertAutonumFootnote(fakePlugin({}, doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("refuses between the markers of a nested quote", async () => {
        const before = ["> > deep text", "> > more deep text"];
        const doc = fakeEditor(before, { wholeDoc: true, edits: true, cursor: { line: 1, ch: 2 } });
        await insertAutonumFootnote(fakePlugin({}, doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("control: after the marker and its space the press creates as usual", async () => {
        const doc = fakeEditor(["> A quoted line.", "> Another quoted line."], {
            wholeDoc: true,
            edits: true,
            words: true,
            cursor: { line: 1, ch: 2 },
        });
        await insertAutonumFootnote(fakePlugin({}, doc));
        expect(doc.lines[1]).toContain("[^1]");
        expect(doc.lines[1].startsWith("> ")).toBe(true);
        expect(messages()).toEqual([]);
    });
});

describe("a press with the caret on a setext underline line (ruling 5)", () => {
    beforeEach(resetNotices);

    it("the scan marks an underline that heads the line above", () => {
        expect(scanDocument(["Setext heading", "==============", "", "prose"]).setextUnderline).toEqual([
            false,
            true,
            false,
            false,
        ]);
        expect(scanDocument(["Dash heading", "---"]).setextUnderline).toEqual([false, true]);
        // a label line under an underline is a heading too ("1: x")
        expect(scanDocument(["[^1]: x", "==="]).setextUnderline).toEqual([false, true]);
        // literal under a two-line paragraph, a rule after a blank line,
        // and body text under a definition's indented continuation
        expect(scanDocument(["para", "more", "==="]).setextUnderline).toEqual([false, false, false]);
        expect(scanDocument(["para", "", "---"]).setextUnderline).toEqual([false, false, false]);
        expect(scanDocument(["[^1]: x", "    y", "==="]).setextUnderline).toEqual([false, false, false]);
    });

    it("refuses at the end of an equals underline", async () => {
        const before = ["Setext heading", "==============", "", "Some prose after it."];
        const doc = fakeEditor(before, { wholeDoc: true, edits: true, cursor: { line: 1, ch: 14 } });
        await insertAutonumFootnote(fakePlugin({}, doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("refuses on a dash underline", async () => {
        const before = ["Dash heading", "---", "", "prose"];
        const doc = fakeEditor(before, { wholeDoc: true, edits: true, cursor: { line: 1, ch: 3 } });
        await insertAutonumFootnote(fakePlugin({}, doc));
        expect(doc.lines).toEqual(before);
        expect(noticed(ProtectedCreationNotice)).toBe(true);
    });

    it("control: a literal \"===\" under a two-line paragraph takes the press", async () => {
        const doc = fakeEditor(["para", "more", "===", "", "prose"], {
            wholeDoc: true,
            edits: true,
            words: true,
            cursor: { line: 2, ch: 3 },
        });
        await insertAutonumFootnote(fakePlugin({}, doc));
        expect(doc.lines[2]).toContain("[^1]");
        expect(messages()).toEqual([]);
    });
});
