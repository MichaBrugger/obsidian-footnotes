import { describe, expect, it } from "vitest";

import { scanDocument } from "../../src/parsing/markdown-scan";

// Bug #3 (2026-08-11 review, Kimi): a fence indented 4+ under a list item
// was invisible to the scanner — fence indent is measured from the ITEM'S
// CONTENT COLUMN, not the document margin. "- a" has content indent 2, so
// a "    ```" below it sits at relative indent 2: a REAL fence per
// CommonMark. Ground-truthed in the live reading view 2026-08-11 (probe
// P1/P3/P12): the fenced interior renders as code with no backticks, and
// prose after the indented closer is live again.

describe("fences indented inside a list item (bug-list-indented-fence)", () => {
    it("a fence at relative indent 2 under '- a' protects its interior", () => {
        const scan = scanDocument([
            "- a",
            "    ```",
            "    ref[^9]",
            "    ```",
            "live tail ref[^9]",
        ]);
        expect(scan.isProtected).toEqual([false, true, true, true, false]);
        expect(scan.endsProtected).toBe(false);
    });

    it("relative indent 6 is indented code, not a fence — the backticks are literal", () => {
        // "        ```" under content indent 2 sits at relative 6: an
        // indented code chunk whose text HAPPENS to be backticks; the
        // chunk keeps going and never swallows lines as a fence would
        const scan = scanDocument([
            "- a",
            "",
            "        ```",
            "        ref[^9]",
        ]);
        expect(scan.isProtected).toEqual([false, false, true, true]);
        // literal-backtick code is a chunk, not an open fence
        expect(scan.endsProtected).toBe(false);
    });

    it("a nested item's fence measures from the nested content column", () => {
        const scan = scanDocument([
            "- outer",
            "  - inner",
            "      ```",
            "      code[^9]",
            "      ```",
        ]);
        // inner item content indent is 4; the fence at 6 is relative 2
        expect(scan.isProtected).toEqual([false, false, true, true, true]);
    });

    it("document-level indent 4 with no list stays indented code", () => {
        const scan = scanDocument(["prose", "", "    ```", "    x"]);
        expect(scan.isProtected).toEqual([false, false, true, true]);
        expect(scan.endsProtected).toBe(false);
    });
});
