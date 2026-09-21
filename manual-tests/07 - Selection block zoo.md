# 07: selection conversion across every block type (2026-08-19)

Automated coverage: 6 former checks now live in test/sheet-07-*.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Settings: defaults, popup OFF for the text checks (turn it ON for the popup pass at the end). Work in source mode for the table fixture: live preview's table widget fights multi-line drags. Every fixture is already in this note (the wikilinked image lives in the vault's Attachments folder).

Every fixture: select from the prose line ABOVE the block through the prose line BELOW it (the block travels WHOLE), press the numbered key, then look at how the footnote RENDERS (Reading view or the popup). Undo between checks. That the text comes out right is pinned by units (`selection-to-footnote`, "the block zoo converts"), so do not re-check it here: this sheet is only about what the finished footnote looks like.

## Numbered key: each block becomes a multi-paragraph definition

The block lands under `[^N]:` with continuation lines indented four spaces; the rendered footnote must show the construct, not its raw markdown.

Bulleted list (nested item included):

before the list

- alpha
    - nested
- beta

after the list

- [ ] The footnote renders the list with its nesting

Numbered list and a task item:

before numbers

1. first
2. second
- [ ] task item

after numbers

- [ ] The footnote renders the ordered list and the checkbox

Blockquote:

before the quote

> quoted line
> second quoted

after the quote

- [ ] The footnote renders a quote block

Callout:

before the callout

> [!note] Heads up
> callout body

after the callout

- [ ] The footnote (and the popup) renders the callout box

Horizontal rule:

before the rule

---

after the rule

- [ ] The footnote shows a divider (not a stray `---` or a setext effect)

Heading:

before the heading

## Section title

after the heading

- [ ] The footnote shows the heading text (styled or plain is fine; note which)

Image links, both flavors:

before the images
![alt text](https://theindex.moe/img/karenneko.gif)
![[some vault image.png]]
after the images

- [ ] The embeds render inside the footnote / popup

Table (source mode; the cell-level cases are sheet 08's):

before the table

| a | b |
| --- | --- |
| 1 | 2 |

after the table

- [ ] The footnote renders the table

Fenced code and `$$` math:

before the fence
```
fenced code here
```
$$
E = mc^2
$$
inline math before $1+1\neq3$ and after
after the fence

- [ ] The footnote renders the code block AND the math block

## Inline key

- [ ] A SINGLE image link selected on its own line + INLINE hotkey: the embed still renders inside the inline footnote

## Popup pass

Turn the popup setting ON and redo ONE list, the callout, and the table fixture with the numbered key:

- [ ] The popup opens showing the whole multi-paragraph body, editable, no Properties-widget bleed (the 2026-08-13 embed hazard)
- [ ] Escape closes the popup and the caret comes back to the end of the LAST body line
