// Imported from the KIMI sweep of 2026-09-13 (T3 Code worktree); 2 of 3 tests were red there and carry it.fails.
import { describe, expect, it } from "vitest";

import {
    definitionLabelIn,
    scanDocument,
} from "../../src/parsing/markdown-scan";

// CommonMark consumes a tab right after ">" as the marker's one optional
// space, leaving the tab's remainder as two columns of indent, so
// ">\t[^1]: x" is a quoted definition label - the scanner treats the whole
// line as indented code, and the definition goes invisible.

describe("a tab after the blockquote marker before a label", () => {
    it.fails("is a quoted definition label, not code", () => {
        expect(definitionLabelIn(">\t[^1]: x")).not.toBeNull();
    });

    it.fails("the line is not protected as indented code", () => {
        const scan = scanDocument([">\t[^1]: x"]);
        expect(scan.isProtected[0]).toBe(false);
    });

    it("a space after the marker already works (control)", () => {
        expect(definitionLabelIn("> [^1]: x")).not.toBeNull();
    });
});
