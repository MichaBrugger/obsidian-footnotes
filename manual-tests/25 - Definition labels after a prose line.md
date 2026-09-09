# 25: definition labels directly after a prose line (OPEN QUESTION, 2026-09-09)

Settings: defaults, all lint rules ON, popup OFF. Every fixture is
already in this note. Do NOT undo between the first four checks; they
only read. Undo after each lint.

The question: Obsidian follows CommonMark here, a footnote definition
cannot interrupt a paragraph. A `[^x]:` line directly under a prose
line (paragraph, list item, quote line, table row) renders as plain
text; only a blank line, the note start, a heading, a closed fence, or
another definition above it makes it a definition. The plugin reads a
label as a definition wherever it sits, and the lint "repairs" the
note by inserting the blank line. Decision pending: match Obsidian, or
keep the repair. This sheet shows the gap.

## Fixtures (label directly under prose, no blank line)

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

Two labels under a paragraph, delta[^d1] and echo[^d2]:
[^d2]: first label
[^d1]: second label

## Controls (these ARE definitions to Obsidian)

After a blank line, foxtrot[^c1] here:

[^c1]: after a blank line

After a heading, golf[^c2] here:
# Heading line
[^c2]: after a heading

After a closed fence, hotel[^c3] here:
```
code
```
[^c3]: after a closed fence

## What Obsidian shows (Reading view)

- [ ] `[^p1]`, `[^p2]`, `[^l1]`, `[^q1]`, `[^d1]`, `[^d2]`: the reference renders as plain `[^p1]` text (no superscript) and the label line reads as prose "[^p1]: after a paragraph"; NO footnote at the bottom
- [ ] The three controls render as real footnotes: superscript references, entries at the bottom
- [ ] Hover a plain-text `[^p1]` and open the Footnotes sidebar: nothing, or "Footnote not found"

## What the plugin does with the same note (source or Live Preview)

- [ ] Hotkey inside `[^p1]`: the plugin JUMPS to the `[^p1]:` line (it treats it as a definition); Obsidian just showed it as text
- [ ] Hotkey on the `[^p1]:` line: jumps back to `alpha[^p1]`
- [ ] Rename footnote with the caret on the `[^p1]:` line: the modal opens (the plugin lists it as a definition)
- [ ] **Lint footnotes**: every fixture label is moved to the bottom under a blank line, so ALL SIX become real footnotes in Reading view (the "repair"); no alert names `p1`, `p2`, `l1`, `q1`, `d1`, `d2` as references without definitions, even though Obsidian rendered them that way before the lint
- [ ] Undo, turn `Delete orphaned references` ON, lint again: the six references SURVIVE (the plugin thinks they have definitions) and the labels move to the bottom as before

## If the decision is "match Obsidian", this is what changes

- [ ] The four navigation and rename checks above do nothing special: the caret is in prose
- [ ] Lint leaves the six fixtures where they are and the alert names all six as references with no definition ("Write its definition or delete the reference")
- [ ] With `Delete orphaned references` ON, lint deletes the six references and leaves the label lines as the prose they are
- [ ] The three controls behave exactly as today
