# 25: definition labels directly after a prose line (2026-09-09)

Automated coverage: 10 former checks now live in test/sheet-25-definition-labels-after-prose.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Settings: defaults. Nothing left on this sheet writes to the note, so there is nothing to undo; both checks only look at Reading view. Every fixture is already in this note.

The rule (Obsidian's, matched by the plugin since 2026-09-09): a footnote definition cannot interrupt a paragraph. A `[^x]:` line directly under a prose line (paragraph text, a list item, a quote or callout body line, a table row) is lazy paragraph text and renders as plain `[^x]: ...` with no footnote. A label starts a definition only after a blank line (a bare `>` inside a quote counts), the note start, a heading, a closed fence, a callout's title line, or another definition. Ground truth: ten shapes in Reading view plus the callout/quote variants; micromark disagrees (its footnote definitions may interrupt a paragraph), so this is Obsidian's behavior on purpose. Everything the plugin does about it (the presses, the rename, the lint with the fix toggle on and off, and the seven-label alert) is pinned in the unit tests; what is left here is what Obsidian itself paints, because that is what the rule copies.

## Fixtures (label directly under prose, no blank line: prose to Obsidian)

After a paragraph line, reference before it, alpha[^p1] here:
para line
[^p1]: after a paragraph

After a paragraph line, reference after it:
para line
[^p2]: after a paragraph again

use it here[^p2] too.

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

Two labels under a paragraph, echo[^d1] and foxtrot[^d2] here:
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

Comment lines live on sheet 18: a comment-only `%% c %%` line is a paragraph line (a label under it is lazy), while an HTML comment line is a block (a label under it is a definition).

## Reading view

- [ ] `[^p1]`, `[^p2]`, `[^l1]`, `[^q1]`, `[^cb]`, `[^d1]`, `[^d2]`: the reference renders as plain text (no superscript) and the label line reads as prose; NO entry at the bottom
- [ ] The five controls render as real footnotes: superscript references, entries at the bottom
