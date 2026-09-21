---
footnote-prefix: 3.
---
# 23: what the linter alerts about instead of fixing

Automated coverage: 17 former checks now live in test/sheet-23-lint-alerts.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Nothing on this sheet needs a human any more. Every check was an alert's exact wording or a lint's exact text, and `test/sheet-23-lint-alerts.test.ts` drives the whole fixture note through `lintFootnotes` and then `noticeLintAlerts`, the same order the plugin uses. Three of its tests are marked `it.fails` and are waiting on your ruling: the missing-definition alert now lists ten names rather than six, the lazy-definition alert cannot fire while its fix rule is on (that check belongs on sheet 25), and a full lint breaks the `- [^la]:` definition written on a list marker line, which looks like a real bug in the punctuation rule.
