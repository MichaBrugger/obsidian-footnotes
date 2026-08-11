import { describe, expect, it } from "vitest";

import { scanDocument } from "../../src/markdown-scan";

// Bug #4 (2026-08-11 review, Opus): indented code INSIDE a blockquote was
// never protected — indent was measured on the raw line, where the "> "
// prefix pins it to column 0. Quote-relative indent ≥ 4 is code when it
// opens at a boundary within the quote (the quote's start, or after a
// blank ">" line), but stays LIVE as a lazy paragraph continuation or a
// definition continuation. Ground-truthed in the live reading view
// 2026-08-11 (probes P4/P5/P6/P11).

describe("indented code inside blockquotes (bug-blockquote-indented-code)", () => {
    it("a quote whose first content line is indented 4 opens code", () => {
        const scan = scanDocument([">     code[^9]", "", "[^9]: nine"]);
        expect(scan.isProtected[0]).toBe(true);
    });

    it("indent 4 directly after a quoted paragraph line is a lazy continuation — live", () => {
        const scan = scanDocument(["> para", ">     cont[^9]"]);
        expect(scan.isProtected).toEqual([false, false]);
    });

    it("indent 4 after a blank '>' line is code", () => {
        const scan = scanDocument(["> para", ">", ">     code[^9]"]);
        expect(scan.isProtected).toEqual([false, false, true]);
    });

    it("a quoted definition's indented continuation stays live", () => {
        const scan = scanDocument(["> [^9]: def", ">     more"]);
        expect(scan.isProtected).toEqual([false, false]);
    });

    it("the chunk continues on later indented quote lines", () => {
        const scan = scanDocument([
            ">",
            ">     one[^9]",
            ">     two[^9]",
            "> back to prose",
        ]);
        expect(scan.isProtected).toEqual([false, true, true, false]);
    });
});
