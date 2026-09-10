# 07: selection conversion across every block type (2026-08-19)

Settings: defaults, popup OFF for the text checks (turn it ON for the
popup pass at the end). Work in source mode for the table fixture:
live preview's table widget fights multi-line drags. Every fixture is
already in this note (the wikilinked image lives in the vault's
Attachments folder).

Every fixture: select from the prose line ABOVE the block through the
prose line BELOW it (the block travels WHOLE), press the key, then check
the text AND how the footnote renders (Reading view or the popup). Undo
between checks. The text shapes are pinned by units
(`selection-to-footnote`, "the block zoo converts"); the RENDERING is
what only eyes can verify.

## Numbered key: each block becomes a multi-paragraph definition

The block lands under `[^N]:` with continuation lines indented four
spaces; the rendered footnote must show the construct, not its raw
markdown.

Bulleted list (nested item included):

before the list

- alpha
    - nested
- beta

after the list

- [ ] Converts; the footnote renders the list with its nesting

Numbered list and a task item:

before numbers

1. first
2. second
- [ ] task item

after numbers

- [ ] Converts; the footnote renders the ordered list and the checkbox

Blockquote:

before the quote

> quoted line
> second quoted

after the quote

- [ ] Converts; the footnote renders a quote block

Callout:

before the callout

> [!note] Heads up
> callout body

after the callout

- [ ] Converts; the footnote (and the popup) renders the callout box

Horizontal rule:

before the rule

---

after the rule

- [ ] Converts; the footnote shows a divider (not a stray `---` or a setext effect)

Heading:

before the heading

## Section title

after the heading

- [ ] Converts; the footnote shows the heading text (styled or plain is fine; note which)

Image links, both flavors:

before the images
![alt text](https://theindex.moe/img/karenneko.gif)
![[some vault image.png]]
after the images

- [ ] Converts; the embeds render inside the footnote / popup

Table (source mode; the cell-level cases are sheet 08's):

before the table

| a | b |
| --- | --- |
| 1 | 2 |

after the table

- [ ] Converts; the footnote renders the table
- [ ] The indented table inside the definition doesn't confuse later lints (run Lint: nothing rewrites it)
- [ ] Undo. Select the table ALONE, edge to edge (first pipe to last pipe), and again with only the blank lines around it: both convert, the table's header row on the `[^n]:` label line and the other rows indented under it, and it renders inside the footnote (Jason's ruling 2026-09-09; a partial table still refuses)

Fenced code and `$$` math (text shape pinned by units; rendering check only):

before the fence
```
fenced code here
```
$$
E = mc^2
$$
inline math before $1+1\neq3$ and after
after the fence

- [ ] Converts; the footnote renders the code block AND the math block
- [ ] Select from INSIDE the `$$` block to below it: the cuts-through-protected-text toast, nothing changes

## Named key: the same zoo through the modal

- [ ] Pick any two fixtures above, use the NAMED hotkey: the modal opens, Enter converts identically under `[^yourname]`; one undo reverts everything

## Inline key: multi-line selections REFUSE (ruling 2026-08-20)

Inline footnotes are single-line; flattening a multi-line selection was
tried and reverted. A line-spanning selection toasts and redirects to
the numbered/named keys.

- [ ] Any multi-line fixture above + INLINE hotkey: the "Inline footnotes are single-line" toast, nothing changes
- [ ] A SINGLE image link selected on its own line + INLINE hotkey: converts, brackets stay unescaped, the embed still renders inline
- [ ] A full-line drag that ends at ch 0 of the next line still converts (it normalizes to one line)

## Popup pass

Turn the popup setting ON and redo ONE list, the callout, and the table
fixture with the numbered key:

- [ ] The popup opens showing the whole multi-paragraph body, editable, no Properties-widget bleed (the 2026-08-13 embed hazard)
- [ ] Escape closes it; the caret jump target is the end of the LAST body line
