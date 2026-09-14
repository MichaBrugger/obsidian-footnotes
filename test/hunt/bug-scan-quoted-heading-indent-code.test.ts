// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 3 of 4 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import { scanDocument } from "../../src/parsing/markdown-scan";

// A quoted heading or thematic break cannot be lazily continued, so an
// indented chunk right after it (quoted or not) is indented code per
// CommonMark - but the scanner treats it as live lazy text, so lint
// renumbers and orphan-deletes the fake references inside the code.

describe("indented code after a quoted heading or thematic break", () => {
    it.fails("a document-level chunk after a quoted heading is code", () => {
        const scan = scanDocument(["> # h", "    code[^9]", "", "[^9]: nine"]);
        expect(scan.isProtected).toEqual([false, true, false, false]);
    });

    it.fails("a document-level chunk after a quoted thematic break is code", () => {
        const scan = scanDocument(["> ***", "    code[^9]", "", "[^9]: nine"]);
        expect(scan.isProtected).toEqual([false, true, false, false]);
    });

    it.fails("a quoted chunk after a quoted heading is code inside the quote", () => {
        const scan = scanDocument(["> # h", ">     code[^9]", "", "[^9]: nine"]);
        expect(scan.isProtected).toEqual([false, true, false, false]);
    });

    it("a quoted paragraph's indented lazy continuation stays live (control)", () => {
        const scan = scanDocument(["> para", ">     cont[^9]", "", "[^9]: nine"]);
        expect(scan.isProtected).toEqual([false, false, false, false]);
    });
});
