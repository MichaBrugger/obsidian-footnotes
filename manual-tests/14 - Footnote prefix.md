---
footnote-prefix: P-
---
# 14: the per-note footnote prefix

Automated coverage: 13 former checks now live in test/sheet-14-footnote-prefix.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Settings: `Per-note footnote prefix` ON. Undo between checks. The fixture is already in this note: the frontmatter carries `P-` and one prefixed footnote[^P-1] exists. The lint side of prefixes is sheet 15; an invalid property is sheet 16.

## The Set footnote prefix command

Run **Set footnote prefix** from the command palette:

- [ ] The modal opens prefilled with `P-`, the value is selected and the box has focus, so typing replaces it straight away
- [ ] Switch the note to Reading view and open the palette: **Set footnote prefix** is still offered there (a frontmatter edit is fine in Reading view)

(The phone keyboard-above-the-dialog check is sheet 24's.)

[^P-1]: the first prefixed footnote
