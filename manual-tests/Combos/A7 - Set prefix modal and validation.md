---
footnote-prefix: 6.
---

# A7: set footnote prefix command and validation

Settings: `Per-note footnote prefix` ON. This note starts with prefix `6.` and one prefixed footnote[^6.1].

Run **Set footnote prefix** from the command palette:

- [ ] The modal opens prefilled with `6.`
- [ ] `10` + Enter: inline ends-in-a-number error, modal stays open
- [ ] `a b` + Enter: inline spaces/brackets error, modal stays open
- [ ] `7.` + Enter: modal closes, notice confirms, frontmatter now says `7.`
- [ ] The auto-numbered hotkey now inserts `[^7.1]` in this sentence
- [ ] Rerun the command, clear the field, Enter: the property is removed

Digit-ending guard, end to end: set the property back to `10` by hand, then

- [ ] The auto-numbered hotkey alerts that the prefix was ignored and inserts a plain number
- [ ] **Lint footnotes** alerts "Linting canceled" and leaves the note untouched

[^6.1]: the first prefixed footnote
