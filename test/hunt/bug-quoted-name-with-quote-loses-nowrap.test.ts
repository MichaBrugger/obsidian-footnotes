import { describe, expect, it } from "vitest";

import { footnoteNameProblem, quotedReference } from "../../src/parsing/footnote-grammar";
import { noticeSegments } from "../../src/editor/notice";

// BUG (cosmetic): a footnote name that contains a double quote is legal, but
// the pattern that finds quoted references in a toast stops at the first
// quote inside the name, so that name is never found and never gets its
// no-wrap span.
//
// What the user would see: in a toast about a footnote named say"hi, the
// reference can break across two lines - "[^say at the end of one line and
// "hi]" at the start of the next - which is the very thing Jason reported on
// 2026-09-04. Nothing is mis-edited and no other name in the same toast is
// affected; only this one name reads badly.
//
// Hunt: 2026-09-13. Lens: the toast wording.
//
// Source of truth: showNotice's doc comment, "A quoted reference should read
// as one thing, so it is wrapped in a no-wrap span: the quotes, the brackets
// and the name always land on the same line" (Jason's report 2026-09-04);
// and footnoteNameProblem, which accepts a double quote in a name (it
// refuses only whitespace, backticks, brackets and "#").

const nowrapped = (message: string) =>
    noticeSegments(message)
        .filter((s) => s.nowrap)
        .map((s) => s.text);

describe("a quoted name containing a double quote", () => {
    it("the name itself is legal, so a toast can really carry it", () => {
        expect(footnoteNameProblem('say"hi')).toBeNull();
    });

    it.fails("rides in a no-wrap span like every other quoted name", () => {
        // the pattern reads "the quote, "[^", any run of characters that are
        // neither a quote nor "]", then "]" and a closing quote". The name's
        // own quote ends that run early, so nothing matches at all
        expect(nowrapped(`left ${quotedReference('say"hi')} right`)).toEqual(['"[^say"hi]"']);
    });

    it("control: other names in the SAME toast keep their spans", () => {
        // only the offending name loses its span; the pattern picks up again
        // after it, so a toast naming several footnotes is not spoiled as a
        // whole
        expect(nowrapped(`a "[^ok]" and ${quotedReference('say"hi')} end`)).toEqual(['"[^ok]"']);
    });

    it("control: names made of other markup characters ride in the span", () => {
        expect(nowrapped('a "[^x*y]" b "[^x_y]" c "[^x<y]" d')).toEqual([
            '"[^x*y]"',
            '"[^x_y]"',
            '"[^x<y]"',
        ]);
    });
});
