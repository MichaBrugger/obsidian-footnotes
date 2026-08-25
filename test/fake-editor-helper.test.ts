import { describe, expect, it } from "vitest";

import { fakeEditor } from "./helpers/fake-editor";

// The shared fake editor is infrastructure ~38 spec files stand on, so
// its own contract gets pinned: which capabilities are opt-in (and that
// the disabled stubs THROW naming their option — that throw is what
// keeps a capability's absence meaning "the code under test never calls
// this"), and the transaction semantics every migrated assertion reads
// through.

describe("fake editor capability contract", () => {
    it("baseline capabilities need no options", () => {
        const doc = fakeEditor(["alpha", "beta"]);
        expect(doc.getLine(1)).toBe("beta");
        expect(doc.lineCount()).toBe(2);
        expect(doc.lastLine()).toBe(1);
        expect(doc.posToOffset({ line: 1, ch: 2 })).toBe(8);
        expect(doc.offsetToPos(8)).toEqual({ line: 1, ch: 2 });
    });

    it("disabled methods throw naming the option that would enable them", () => {
        const doc = fakeEditor(["alpha"]);
        expect(() => doc.getValue()).toThrow("wholeDoc");
        expect(() => doc.transaction({})).toThrow("edits");
        expect(() => doc.getCursor()).toThrow("cursor/carets");
        expect(() => doc.wordAt({ line: 0, ch: 0 })).toThrow("words");
        expect(() => doc.listSelections()).toThrow("cursor/carets/selection");
    });

    it("setCursor always works and logs every move in order", () => {
        const doc = fakeEditor(["alpha"]);
        doc.setCursor({ line: 0, ch: 2 });
        doc.setCursor({ line: 0, ch: 5 });
        expect(doc.moves).toEqual([
            { line: 0, ch: 2 },
            { line: 0, ch: 5 },
        ]);
        expect(doc.cursor).toEqual({ line: 0, ch: 5 });
    });
});

describe("fake editor transaction semantics", () => {
    it("changes in one transaction are all measured against the ORIGINAL document (CodeMirror ordering), and the raw specs are recorded", () => {
        const doc = fakeEditor(["abc"], { edits: true });
        const changes = [
            { from: { line: 0, ch: 1 }, text: "X" },
            { from: { line: 0, ch: 2 }, text: "Y" },
        ];
        doc.transaction({ changes });
        expect(doc.lines).toEqual(["aXbYc"]);
        expect(doc.appliedChanges).toEqual(changes);
        expect(doc.transactions).toBe(1);
    });

    it("spec.selection lands the cursor and spec.selections is recorded", () => {
        const doc = fakeEditor(["abc"], {
            cursor: { line: 0, ch: 0 },
            edits: true,
        });
        doc.transaction({
            selection: { from: { line: 0, ch: 3 } },
            selections: [{ from: { line: 0, ch: 1 } }],
        });
        expect(doc.cursor).toEqual({ line: 0, ch: 3 });
        expect(doc.selections).toEqual([{ from: { line: 0, ch: 1 } }]);
    });
});

describe("fake editor selection flavors", () => {
    it("carets freeze listSelections at press time, like Alt-click carets", () => {
        const doc = fakeEditor(["one two"], {
            carets: [
                { line: 0, ch: 1 },
                { line: 0, ch: 5 },
            ],
        });
        doc.setCursor({ line: 0, ch: 6 });
        expect(doc.listSelections()).toEqual([
            { anchor: { line: 0, ch: 1 }, head: { line: 0, ch: 1 } },
            { anchor: { line: 0, ch: 5 }, head: { line: 0, ch: 5 } },
        ]);
        expect(doc.getCursor()).toEqual({ line: 0, ch: 6 });
    });

    it("a cursor without carets/selection gives a LIVE collapsed range", () => {
        const doc = fakeEditor(["one two"], { cursor: { line: 0, ch: 1 } });
        doc.setCursor({ line: 0, ch: 6 });
        expect(doc.listSelections()).toEqual([
            { anchor: { line: 0, ch: 6 }, head: { line: 0, ch: 6 } },
        ]);
    });
});

describe("fake editor wordAt", () => {
    it("returns the word's span mid-word, snaps back from just past a word, and null between words", () => {
        const doc = fakeEditor(["one  two"], { words: true });
        expect(doc.wordAt({ line: 0, ch: 6 })).toEqual({
            from: { line: 0, ch: 5 },
            to: { line: 0, ch: 8 },
        });
        expect(doc.wordAt({ line: 0, ch: 3 })).toEqual({
            from: { line: 0, ch: 0 },
            to: { line: 0, ch: 3 },
        });
        expect(doc.wordAt({ line: 0, ch: 4 })).toBeNull();
    });
});
