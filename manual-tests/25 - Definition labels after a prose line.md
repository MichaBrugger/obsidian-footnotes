# 25: definition labels directly after a prose line (2026-09-09)

Settings: defaults (both Orphans toggles and `Merge duplicate
definitions` OFF), popup OFF. Every fixture is already in this note.
The first three checks only read; undo after each lint.

The rule (Obsidian's, matched by the plugin since 2026-09-09): a
footnote definition cannot interrupt a paragraph. A `[^x]:` line
directly under a prose line (paragraph text, a list item, a quote or
callout body line, a table row) is lazy paragraph text and renders as
plain "[^x]: ..." with no footnote. A label starts a definition only
after a blank line (a bare `>` inside a quote counts), the note start,
a heading, a closed fence, a callout's title line, or another
definition. Ground truth: ten shapes in Reading view plus the
callout/quote variants; micromark disagrees (its footnote definitions
may interrupt a paragraph), so this is Obsidian's behavior on purpose.

## Fixtures (label directly under prose, no blank line: prose to Obsidian)

After a paragraph line, reference before it, alpha[^p1] here:
para line
[^p1]: after a paragraph

After a paragraph line, reference after it:
para line
[^p2]: after a paragraph again
use it here[^p2].

After a list item, bravo[^l1] here:
- item
[^l1]: after a list item

After a quote line, charlie[^q1] here:
> quote
[^q1]: after a quote line

Inside a callout, under its body line, delta[^cb] here:
> [!note]
> callout body
> [^cb]: under the callout body

Two labels under a paragraph, echo[^d1] and foxtrot[^d2]:
[^d2]: first label
[^d1]: second label

## Controls (definitions to Obsidian)

After a blank line, golf[^c1] here:

[^c1]: after a blank line

After a heading, hotel[^c2] here:
# Heading line
[^c2]: after a heading

After a closed fence, india[^c3] here:
```
code
```
[^c3]: after a closed fence

Inside a callout, right under its title line, juliet[^c4] here:
> [!note]
> [^c4]: under the callout title

Inside a quote after a blank quote line, kilo[^c5] here:
> quote body
>
> [^c5]: after the quote's blank line

## Reading view

- [ ] `[^p1]`, `[^p2]`, `[^l1]`, `[^q1]`, `[^cb]`, `[^d1]`, `[^d2]`: the reference renders as plain text (no superscript) and the label line reads as prose; NO entry at the bottom
- [ ] The five controls render as real footnotes: superscript references, entries at the bottom

## The plugin agrees

- [ ] Hotkey inside `[^p1]` (and any of the seven prose fixtures): the reference has no definition, so the press APPENDS a real `[^p1]:` definition at the bottom (the note then holds the lazy label AND a real definition; undo it); it never jumps to the label line
- [ ] Hotkey on the `[^p1]:` line: a plain insert as well; Rename footnote with the caret there: "Place the cursor on a footnote reference or definition to rename it."
- [ ] Hotkey inside `[^c1]` through `[^c5]`: navigates to the definition (or opens the popup); on their label lines it jumps back to the reference
- [ ] **Lint footnotes**: the seven prose fixtures stay exactly where they are; ONE alert names all seven labels: "This note has 7 footnote definitions that Obsidian reads as plain text because there is no blank line above them ("[^p1]:", "[^p2]:", "[^l1]:", "[^q1]:", "[^cb]:", "[^d2]:", "[^d1]:"). Add a blank line above each." (label order = first appearance); the missing-definition alert does NOT list them; the three column-0 controls gather at the bottom as usual, while `[^c4]` and `[^c5]` stay inside their callout and quote (quoted definitions are never moved)
- [ ] Undo, turn `Delete orphaned references` ON, lint again: the seven references SURVIVE (a reference pointing at a lazy label is not an orphan; the same alert repeats), the label lines stay untouched, the controls are unaffected
- [ ] Add a blank line above `[^p1]: after a paragraph` by hand and lint: `p1` leaves the alert, its definition gathers at the bottom, and the reference renders
- [ ] Undo. Put the caret at the end of `> callout body` above and press the numbered hotkey: the new definition lands at the bottom under a blank line (never glued to the line above it), and Reading view shows it as a footnote
