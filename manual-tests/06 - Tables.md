# 06: footnotes and tables

Automated coverage: 11 former checks now live in test/manual-*.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Settings: defaults. Undo between checks. The fixture is already in this note. Rule (2026-09-04): text inside ONE cell can become a footnote, and so can a whole table selected with the text around it (sheet 05); a cell, a few cells, or a row never can.

## Cell toast to watch for (parked 2026-09-05)

| Insert here    | And here          |
| -------------- | ----------------- |
| Click in me () | Named one here () |

- [ ] Inline insertion inside a cell in Live Preview never shows "No footnote was created: footnotes can't go inside code, math, or other protected text." (seen once, never reproduced; note the exact table and steps if it appears)
