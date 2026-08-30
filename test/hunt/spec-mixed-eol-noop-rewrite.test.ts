import { describe, expect, it } from "vitest";

import { reindexFootnotes } from "../../src/linting/rules/re-index-footnotes";

// spec question: should a no-op transform on a mixed-EOL note leave the file
// byte-identical, or normalize the lone-LF lines to CRLF?
// Hunt: 2026-08-09. Lens: contexts.
// restoreEol rewrites lone LF lines to CRLF when the note contained ANY CRLF,
// so a no-op reindex/lint on a mixed-EOL note reports "Footnotes linted." and
// rewrites the file - a one-time normalization. The documented contract only
// promises CRLF isn't flipped to LF; the LF→CRLF direction is undocumented.

describe("decided 2026-08-10: a no-op transform is byte-identical on mixed EOL", () => {
    it("a no-op reindex is byte-identical on a mixed-EOL note", () => {
        const input = "a[^1]\r\n\r\n[^1]: d\nx";
        expect(reindexFootnotes(input)).toBe(input);
    });
});
