// Imported from the Kimi K3 cycle 4 hunt of 2026-09-16 (OpenCode worktree); 3 of 5 tests carry it.fails: 0 were red there and marked on import, the rest the hunter marked itself.
import { describe, expect, it } from "vitest";

import { removeOrphanedFootnoteReferences } from "../../src/linting/rules/remove-orphaned-references";

// The orphaned-reference rule promises: "a deletion that changes how
// Obsidian reads a line it did not touch is refused outright." Its guard
// checks two things after the cut: whether any line's PROTECTED flag
// flipped, and whether any line became (or stopped being) a definition
// start. It never checks whether a kept line changed BLOCK KIND.
//
// A reference glued to a markdown marker is exactly that case. "#[^9]
// tail" is a paragraph ("#" needs a space after it); delete the orphan
// and the line is "# tail" - an ATX heading. "-[^9]" is a paragraph;
// after the cut it is "-" - an empty bullet item. "1.[^9]" likewise
// becomes "1.". Reading view flips each line from prose to a heading or a
// list, and the rule walked away thinking nothing else changed.
//
// The setext twin IS guarded (the definition-start check catches it, as
// the control shows), so this family stands out as the hole in the same
// promise.
//
// What the user sees: with `Delete orphaned references` ON, their plain
// paragraph line turns into a giant heading (or a list bullet) on the
// lint after they typed a stray reference into it. Nothing tells them:
// the deletion "succeeded", so no alert fires.
//
// Source of truth: the rule's own refusal contract in
// remove-orphaned-references.ts ("refused outright" when deletion changes
// how the lines around it are read) + CommonMark 4.2/5.2 (a marker needs
// a space or end-of-line after it, which is exactly what the cut
// produces).
//
// Settings involved: `Delete orphaned references` ON.

describe("orphan-reference deletion forming a block start out of the leftover marker", () => {
    it("a heading: '#[^9] tail' must not become '# tail'", () => {
        expect(removeOrphanedFootnoteReferences("#[^9] tail\n\ntext[^1]\n\n[^1]: d")).toBe("#[^9] tail\n\ntext[^1]\n\n[^1]: d");
    });

    it("a bullet: '-[^9]' must not become '-'", () => {
        expect(removeOrphanedFootnoteReferences("-[^9]\n\ntext[^1]\n\n[^1]: d")).toBe("-[^9]\n\ntext[^1]\n\n[^1]: d");
    });

    it("an ordered item: '1.[^9]' must not become '1.'", () => {
        expect(removeOrphanedFootnoteReferences("1.[^9]\n\ntext[^1]\n\n[^1]: d")).toBe("1.[^9]\n\ntext[^1]\n\n[^1]: d");
    });

    it("control: the setext case IS refused today (the definition-start check catches it)", () => {
        expect(removeOrphanedFootnoteReferences("text\n--- [^9]\n[^x]: d")).toBe("text\n--- [^9]\n[^x]: d");
    });

    it("control: an ordinary orphan deletion goes through untouched", () => {
        expect(removeOrphanedFootnoteReferences("keep[^1] drop[^9] end\n\n[^1]: one")).toBe("keep[^1] drop end\n\n[^1]: one");
    });
});
