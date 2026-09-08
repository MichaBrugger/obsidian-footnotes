import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeCalls } from "./mocks/obsidian";
import { noticeSegments, showNotice } from "../src/editor/notice";

// Jason's report 2026-09-04: right after every toast gained quotes around
// the footnote it names, Obsidian's notice wrapping (overflow-wrap:
// anywhere) split `"[^bob]"` across lines - `Add a"` then `[^bob]"
// reference`. Quoted references are one visual token and ride in a
// no-wrap span; everything else stays plain text.

beforeEach(() => {
    noticeCalls.length = 0;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("noticeSegments", () => {
    it("splits a quoted reference out of the prose around it", () => {
        expect(
            noticeSegments('Nothing references this footnote. Add a "[^bob]" reference in the text.'),
        ).toEqual([
            { text: "Nothing references this footnote. Add a ", nowrap: false },
            { text: '"[^bob]"', nowrap: true },
            { text: " reference in the text.", nowrap: false },
        ]);
    });

    it("keeps every quoted reference of a list separate, commas between them plain", () => {
        expect(noticeSegments('no definition ("[^a]", "[^b]", …).')).toEqual([
            { text: "no definition (", nowrap: false },
            { text: '"[^a]"', nowrap: true },
            { text: ", ", nowrap: false },
            { text: '"[^b]"', nowrap: true },
            { text: ", …).", nowrap: false },
        ]);
    });

    it("counts the empty and bare-prefix placeholders as references", () => {
        expect(noticeSegments('("[^]" or the bare prefix "[^2.]")').filter((s) => s.nowrap)).toEqual([
            { text: '"[^]"', nowrap: true },
            { text: '"[^2.]"', nowrap: true },
        ]);
    });

    it("a message with no quoted reference is one plain run", () => {
        expect(noticeSegments("Footnotes linted.")).toEqual([
            { text: "Footnotes linted.", nowrap: false },
        ]);
    });

    it("an unquoted reference or a quoted non-reference stays plain", () => {
        expect(noticeSegments('bare [^x] and "quoted words"').every((s) => !s.nowrap)).toBe(true);
    });
});

describe("showNotice", () => {
    it("passes a message with no quoted reference straight through as a string", () => {
        showNotice("Footnotes linted.", 8000);
        expect(noticeCalls).toEqual([["Footnotes linted.", 8000]]);
    });

    it("without Obsidian's DOM helpers (units) the string is passed through even when it names a footnote", () => {
        showNotice('Renamed "[^a]" to "[^b]".');
        expect(noticeCalls).toEqual([['Renamed "[^a]" to "[^b]".', undefined]]);
    });

    it("with the DOM helpers, quoted references become no-wrap spans and the rest text nodes", () => {
        const parts: unknown[] = [];
        const fragment = {
            createSpan: (o: { cls: string; text: string }) => {
                parts.push({ span: o });
            },
            appendText: (text: string) => {
                parts.push({ text });
            },
        };
        vi.stubGlobal("createFragment", () => fragment);
        showNotice('Add a "[^bob]" reference in the text.', 8000);
        expect(noticeCalls).toEqual([[fragment, 8000]]);
        expect(parts).toEqual([
            { text: "Add a " },
            { span: { cls: "footnote-shortcut-nowrap", text: '"[^bob]"' } },
            { text: " reference in the text." },
        ]);
    });

    it("with the DOM helpers, a message without a quoted reference is still a plain string", () => {
        vi.stubGlobal("createFragment", () => {
            throw new Error("should not build a fragment");
        });
        showNotice("No linting needed.");
        expect(noticeCalls).toEqual([["No linting needed.", undefined]]);
    });
});
