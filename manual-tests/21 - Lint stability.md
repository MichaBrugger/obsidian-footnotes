# 21: lint stability paranoia (2026-08-10)

Automated coverage: 2 former checks now live in test/sheet-21-lint-stability.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Nothing on this sheet needs a human any more. Both checks were text outcomes of one lint on a five-line fixture and are pinned by `test/sheet-21-lint-stability.test.ts`, which also records one disagreement for you to rule on: since the setext ruling of 2026-09-16, a definition with a `---` right under it is a heading to Obsidian, so the lint now leaves it alone and the underlined-definition alert speaks instead of the definition being moved down.
