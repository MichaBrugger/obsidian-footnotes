# 20: the lint rules, alone and together

Automated coverage: 13 former checks now live in test/sheet-20-lint-rules.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Nothing on this sheet needs a human any more. All seven settings combos, their expected fences, the re-lint checks and the indented-code case are text outcomes pinned by `test/sheet-20-lint-rules.test.ts`, and the fold-and-caret check is driven in a real Obsidian by the smoke scenario "lint keeps the caret where it was and leaves folds folded (2026-09-11)".
