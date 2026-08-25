import { describe, expect, it } from "vitest";

import { listExistingFootnoteDefinitions } from "../../src/editor/doc-context";

import { fakeEditor } from "../helpers/fake-editor";

// BUG: listExistingFootnoteDefinitions leaks NUL bytes when a footnote name
// contains a backtick span. It reads the maskProtectedLines/maskInlineCode
// twin of each line (including the definition line itself) and captures the
// name group WITHOUT re-slicing back to the original text — so the masked NULs
// from the code span leak into the returned name ("a\0\0\0c"). Its sibling
// listExistingFootnoteReferencesAndLocations already re-slices the original for
// exactly this reason (see its comment); the definitions path was never given the
// same fix. If that name is later written back (buildDefinitionAppend composing a
// "[^name]:" line) the NULs land in the saved document.
// Hunt: 2026-07-17. Lens: grammar. Severity: wrong-output.

describe("bug: definition name with an inline-code span leaks NUL characters", () => {
    it("keeps the real backtick characters of the footnote name", () => {
        const doc = fakeEditor(["see[^a`b`c]", "[^a`b`c]: hi"]);
        expect(listExistingFootnoteDefinitions(doc)).toEqual(["a`b`c"]);
    });
});
