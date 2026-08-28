# A13: selection conversion across every block type (2026-08-19)

Settings: defaults, popup OFF for the text checks (turn it ON for the popup
pass at the end). Work in source mode for the table fixture — live preview's
table widget fights multi-line drags.

Every fixture: select from the prose line ABOVE the block through the prose
line BELOW it (the block travels WHOLE), press the key, then check the text
AND how the footnote renders (reading view or the popup). Undo between
checks. The text shapes here are pinned by units (`selection-to-footnote`,
"the block zoo converts"); the RENDERING columns are what only eyes can
verify.

## Numbered key — each block becomes a multi-paragraph definition

The block lands under `[^N]:` with continuation lines indented four spaces;
the rendered footnote must show the construct, not its raw markdown.

Bulleted list (nested item included):

before the list

- alpha
    - nested
- beta

after the list

- [ ] Converts; footnote renders the list with its nesting

Numbered list and a task item:

before numbers

1. first
2. second
- [ ] task item

after numbers

- [ ] Converts; footnote renders the ordered list and the checkbox

Blockquote:

before the quote

> quoted line
> second quoted

after the quote

- [ ] Converts; footnote renders a quote block

Callout:

before the callout

> [!note] Heads up
> callout body

after the callout

- [ ] Converts; footnote (and popup) renders the callout box

Horizontal rule:

before the rule

---

after the rule

- [ ] Converts; footnote shows a divider (not a stray `---` or a setext effect)

Heading:

before the heading

## Section title

after the heading

- [ ] Converts; footnote shows the heading text (styled or plain is fine — note which)

Image links, both flavors (needs any image in the vault for the wikilink):

before the images
![alt text](https://example.org/pic.png)
![[some vault image.png]]
after the images

- [ ] Converts; the embeds render inside the footnote / popup

Table:

before the table

| a | b |
| --- | --- |
| 1 | 2 |

after the table

- [ ] Converts (source mode); the footnote renders the table
- [ ] The indented table inside the definition doesn't confuse later lints (run Lint: nothing rewrites it)

Fenced code and `$$` math (already pinned in A9/units — rendering check only):

before the fence
```
fenced code here
```
$$
E = mc^2
$$
inline math before $1+1\neq3$ and after
after the fence

- [ ] Converts; footnote renders the code block AND the math block

## Named key — same zoo through the modal

- [ ] Pick any two fixtures above, use the NAMED hotkey: modal opens, Enter
      converts identically under `[^yourname]`; one undo reverts everything

## Inline key — multi-line selections REFUSE (ruling 2026-08-20)

Inline footnotes are single-line; flattening a multi-line selection was
tried and reverted — it basically never looked correct outside clean
paragraphs. A line-spanning selection now toasts and redirects to the
numbered/named keys.

- [ ] Any multi-line fixture above + INLINE hotkey: the "Inline footnotes
      are single-line" toast, nothing changes
- [ ] A SINGLE image link selected on its own line + INLINE hotkey: converts,
      brackets stay unescaped, the embed still renders inline
- [ ] A full-line drag that ends at ch 0 of the next line still converts
      (it normalizes to one line)

## Cut refusals (spot checks — the toast, nothing changes)

- [ ] Select from "before the table" through only the table's HEADER row and
      convert: allowed (tables aren't protected) — note whether the
      leftover half-table looks acceptable, this one is judgment territory
- [ ] Select from inside the `$$` block to below it: the cuts-through-protected
      toast (the fence-cut twin is A9's check — not repeated here)

## Popup pass

Turn the popup setting ON and redo ONE list, the callout, and the table
fixture with the numbered key:

- [ ] The popup opens showing the whole multi-paragraph body, editable, no
      Properties-widget bleed (the 2026-08-13 embed hazard)
- [ ] Escape closes it; the caret jump target is the end of the LAST body line
