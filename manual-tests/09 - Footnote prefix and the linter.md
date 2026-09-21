# 09: the linter under a footnote prefix

Automated coverage: 3 former checks now live in test/manual-prefix-and-linter.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Settings: `Per-note footnote prefix` ON, the `Apply the note's footnote prefix` lint rule ON (both default to that except the first), all other lint rules ON. `Renumber named footnotes` stays OFF. Nothing to change in this note: the one check left is about the settings page, not about a note.

Pinned by units, not repeated here: the whole lint over a prefixed note (plain footnotes adopt the prefix, named ones keep their name behind it, then the whole namespace renumbers by reading order), its idempotence, and what the apply-prefix rule turning OFF does to plain, prefixed, and named footnotes.

- [ ] The settings page greys `Apply the note's footnote prefix` out while the prefix feature itself is off (main tab)
