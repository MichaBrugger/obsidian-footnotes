---
footnote-prefix: bad prefix
---
# 10: a note whose footnote-prefix property is invalid

Automated coverage: 4 former checks now live in test/manual-invalid-prefix-property.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Settings: `Per-note footnote prefix` ON, all lint rules ON. The frontmatter above IS the fixture: a prefix with a space, which the Set footnote prefix modal would never accept but a hand edit can produce. Nothing to change in this note. A fixture footnote[^1] keeps the lint honest.

- [ ] **Set footnote prefix** opens prefilled with `bad prefix`; Escape closes it and leaves the property as it was

Pinned by units, not repeated here: the numbered and named hotkeys refusing with "No footnote was created: this note's footnote-prefix ("bad prefix") is invalid. ..."; the lint's matching "Linting canceled: ..." message; the modal refusing Enter inline while the value is invalid; and, with `Per-note footnote prefix` OFF, the hotkeys inserting plain `[^2]` / `[^]` again. Also pinned: `footnote-prefix: 2. # a comment` is one invalid value (YAML comments are not honored, ruling 2026-09-05); `footnote-prefix:2.` with no space after the colon is not a property at all and is ignored.

[^1]: the fixture definition
