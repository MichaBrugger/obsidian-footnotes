import { describe, expect, it } from "vitest";

import { endOfWordOffset } from "../../src/insert-or-navigate-footnotes";

// spec question: should the TrailingPunctuation class grow CJK members
// (。！？；：，) so the end-of-word hop treats CJK punctuation like ASCII?
// Hunt: 2026-08-09. Lens: offsets.
// endOfWordOffset hops ASCII trailing punctuation ("word." puts the reference
// after ".") but not CJK "。" — the hop stops before it. TrailingPunctuation
// is a deliberately shared ASCII-only class across all three insertion/lint
// paths, so no two paths disagree; the open question is whether the class
// should grow CJK members.

describe("decided 2026-08-10: CJK trailing punctuation hops like ASCII", () => {
    it("hops a CJK full stop the way it hops an ASCII period", () => {
        // 中文。: an English word gets the reference after ".", a CJK user
        // expects the reference after "。" — the hop currently stops at 2
        expect(endOfWordOffset("\u4E2D\u6587\u3002", 0)).toBe(3);
    });
});
