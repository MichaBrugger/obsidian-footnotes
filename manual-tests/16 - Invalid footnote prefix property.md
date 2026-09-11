---
footnote-prefix: bad prefix
---
# 16: a note whose footnote-prefix property is invalid

Settings: `Per-note footnote prefix` ON, all lint rules ON. The frontmatter above IS the fixture: a prefix with a space, which the Set footnote prefix modal would never accept but a hand edit can produce. Nothing to change in this note. A fixture footnote[^1] keeps the lint honest.

- [ ] Numbered hotkey in this sentence: "No footnote was created: this note's footnote-prefix ("bad prefix") is invalid. The footnote prefix can't contain spaces, backticks, brackets, or "#"." and nothing is inserted
- [ ] The named and inline hotkeys refuse with the same toast
- [ ] **Lint footnotes**: "Linting canceled: this note's footnote-prefix ("bad prefix") is invalid. ..." (same reason appended) and the note is untouched
- [ ] **Set footnote prefix** opens prefilled with `bad prefix` and refuses Enter inline until the value is fixed; Escape leaves the property as it was
- [ ] Turn `Per-note footnote prefix` OFF: the hotkeys insert plain `[^2]` / `[^]` again and the lint runs normally (the property is ignored while the feature is off); turn it back ON afterwards

Pinned by units, not repeated here: `footnote-prefix: 2. # a comment` is one invalid value (YAML comments are not honored, ruling 2026-09-05); `footnote-prefix:2.` with no space after the colon is not a property at all and is ignored.

[^1]: the fixture definition
