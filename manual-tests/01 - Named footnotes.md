# 01: named footnotes

Automated coverage: 9 former checks now live in test/manual-named-footnotes.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Settings: defaults, popup OFF. Undo between checks. Every fixture is already in this note.

## The two-step flow

Set the check up in this sentence: press the named hotkey, type `cite` between the brackets, then press the named hotkey again so the `[^cite]:` definition is created at the bottom.

- [ ] Undo ONCE right after that: the definition goes and the typed reference stays, in ONE undo step (the notice's wording is pinned by a test; what needs your eyes is whether Obsidian's history really unwinds it this way)
