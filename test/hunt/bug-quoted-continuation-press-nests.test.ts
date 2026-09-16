import { beforeEach, describe, expect, it } from "vitest";

import { fakeEditor, FakeEditor } from "../helpers/fake-editor";
import { fakePlugin as sharedFakePlugin } from "../helpers/fake-plugin";
import { resetNotices } from "../helpers/notices";

import FootnotePlugin from "../../src/main";
import { insertAutonumFootnote } from "../../src/commands/insert-or-navigate-footnotes";

// BUG: a press with the caret at the end of a quoted definition's
// continuation line creates a footnote INSIDE that definition's body, which
// the plugin is supposed to prevent everywhere.
//
// The shape is a callout holding its own footnote:
//   > [!note] A callout
//   > body[^cq] here
//   >
//   > [^cq]: callout definition
//   >     its continuation line
// with the caret at the end of the last line. The press writes
// ">     its continuation line[^1]", a footnote nested in another footnote's
// body.
//
// Why: the guard that refuses a press inside a definition asks the document
// for its definition BLOCKS, and a quoted label forms no block, so the guard
// never sees the caret as being inside a definition at all. The navigation
// step does not rescue the press either (it declines, which is its own
// question, kept in test/hunt/spec-quoted-definition-continuation-landing),
// and a press nothing else claims falls through to creation.
//
// What the user would see: a stray "[^1]" appended to the body text of the
// footnote they were reading, plus a new empty definition minted for it.
//
// The plain blockquote twin behaves identically, so this is about quoting in
// general and not about callouts (skeptic verified, 2026-09-13).
//
// Hunt: 2026-09-13. Lens: popup routing and the navigation cascade.
//
// Source of truth: ADR-0001, which rules out nested footnotes plugin-wide -
// hand-typed nesting is surfaced by lint, but the plugin will never create
// one. The 2026-09-09 ruling recorded in
// test/hunt/bug-quoted-definition-invisible-to-rename-and-selection says it
// in so many words, "two guards asked ctx.blocks() when they meant every live
// definition"; that was fixed for rename and for selections, and this guard
// was left behind. And the scanner does keep quoted four-space content live
// inside an open quote block (src/parsing/markdown-scan.ts, ground-truthed
// 2026-08-11), so the continuation line really is part of the definition.

const callout = [
    "> [!note] A callout",
    "> body[^cq] here",
    ">",
    "> [^cq]: callout definition",
    ">     its continuation line",
];

const unquoted = [
    "body[^cq] here",
    "",
    "[^cq]: plain definition",
    "    its continuation line",
];

function pressPlugin(doc: FakeEditor): FootnotePlugin {
    return sharedFakePlugin(
        {
            enablePopupEditor: false,
            insertAtEndOfWord: false,
            enableFootnotePrefix: false,
            enableFootnoteSectionHeading: false,
            footnoteSectionHeading: "",
            enableRemoveBlankLastLines: false,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
}

beforeEach(() => {
    resetNotices();
});

describe("a press on a quoted definition's continuation line", () => {
    it("control: the unquoted twin is left alone", () => {
        const doc = fakeEditor(unquoted, {
            cursor: { line: 3, ch: unquoted[3].length },
            edits: true,
            wholeDoc: true,
        });
        return insertAutonumFootnote(pressPlugin(doc)).then(() => {
            expect(doc.lines[3]).toBe("    its continuation line");
        });
    });

    it("does not write a footnote into the definition's body", () => {
        const doc = fakeEditor(callout, {
            cursor: { line: 4, ch: callout[4].length },
            edits: true,
            wholeDoc: true,
        });
        // either answer is fine: jumping back to the reference, or refusing
        // the press with the nested-footnote toast. Creating a footnote inside
        // the definition is the one outcome ADR-0001 rules out, so only that
        // is pinned here
        return insertAutonumFootnote(pressPlugin(doc)).then(() => {
            expect(doc.lines[4]).toBe(">     its continuation line");
        });
    });
});
