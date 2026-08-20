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

Fenced code and $$ math (already pinned in A9/units — rendering check only):

before the fence
```
fenced code here
```
$$
E = mc^2
$$
after the fence

- [ ] Converts; footnote renders the code block AND the math block

## Named key — same zoo through the modal

- [ ] Pick any two fixtures above, use the NAMED hotkey: modal opens, Enter
      converts identically under `[^yourname]`; one undo reverts everything

## Inline key — the zoo flattens to one line

The inline key collapses line breaks to spaces (paste parity), so block
structure is LOST by design — the text must still be intact and the `^[…]`
must not break.

- [ ] The image-links fixture: brackets stay unescaped, embeds still render inline
- [ ] The blockquote fixture: `>` markers become literal text inside the footnote, wrapper intact
- [ ] The table fixture: pipes become literal text, wrapper intact, nothing eats the note

## Cut refusals (spot checks — the toast, nothing changes)

- [ ] Select from "before the table" through only the table's HEADER row and
      convert: allowed (tables aren't protected) — note whether the
      leftover half-table looks acceptable, this one is judgment territory
- [ ] Select from above the fence through its opening ``` only: cuts-through-protected toast
- [ ] Select from inside the $$ block to below it: same toast

## Popup pass

Turn the popup setting ON and redo ONE list, the callout, and the table
fixture with the numbered key:

- [ ] The popup opens showing the whole multi-paragraph body, editable, no
      Properties-widget bleed (the 2026-08-13 embed hazard)
- [ ] Escape closes it; the caret jump target is the end of the LAST body line
