import { describe, expect, it } from "vitest";

import { fakeEditor } from "../helpers/fake-editor";
import { fakePlugin } from "../helpers/fake-plugin";

import { buildDefinitionAppend } from "../../src/commands/definition-append";
import { scanDocument } from "../../src/parsing/markdown-scan";

// Review B2 (2026-09-09): when a note ends inside an unclosed fence,
// comment, or math block, buildDefinitionAppend walks up from EOF to find
// the last line a definition can live after - and it used to re-slice and
// re-scan the prefix once per line, quadratic on a long note with the
// opener near the top. scanDocument now records endsProtectedAt[i], the
// answer the prefix probe used to compute, during the one walk it already
// makes. The first spec is the equivalence proof against the old probe.

const DOCS = [
    ["prose[^9]?", "", "```", "code"],
    ["alpha[^1].", "", "text <!-- open", "hidden", "still hidden"],
    ["a[^1]!", "$$", "E=mc^2"],
    ["> ```", "> quoted fence stays quoted", "after the quote", "```", "doc fence", "```", "tail"],
    ["intro", "<!-- one -->", "live", "<!-- two", "-->", "after"],
    ["```", "opens on line 0", "```", "", "[^1]: def", "    $$", "    inside", "    $$", "tail"],
    ["- item", "  ```", "  listed fence", "  ```", "back"],
    ["x", "", "> [!note]", "> $$", "> quoted math", "plain after quote"],
];

describe("scanDocument.endsProtectedAt", () => {
    it("equals the old prefix probe on every line", () => {
        for (const lines of DOCS) {
            const scan = scanDocument(lines);
            for (let i = 0; i < lines.length; i++) {
                expect(scan.endsProtectedAt[i], `${JSON.stringify(lines)} @${i}`).toBe(
                    scanDocument(lines.slice(0, i + 1)).endsProtected,
                );
            }
            expect(scan.endsProtectedAt[lines.length - 1]).toBe(scan.endsProtected);
        }
    });

    it("reads false inside a closed frontmatter block", () => {
        const scan = scanDocument(["---", "title: t", "---", "body", "```", "code"]);
        expect(scan.endsProtectedAt.slice(0, 3)).toEqual([false, false, false]);
        expect(scan.endsProtectedAt[3]).toBe(false);
        expect(scan.endsProtectedAt[4]).toBe(true);
        expect(scan.endsProtected).toBe(true);
    });

    it("the append above an unclosed opener near the top of a long note is fast", () => {
        const lines = ["prose[^9]?", "", "text <!-- opens here"];
        for (let i = 0; i < 3000; i++) lines.push(`hidden line ${i}`);
        const doc = fakeEditor(lines, { cursor: { line: 0, ch: 0 }, wholeDoc: true });
        const started = performance.now();
        const { change } = buildDefinitionAppend(doc, "1", false, fakePlugin());
        const took = performance.now() - started;
        expect(change.from).toEqual({ line: 0, ch: "prose[^9]?".length });
        expect(took).toBeLessThan(150);
    });
});
