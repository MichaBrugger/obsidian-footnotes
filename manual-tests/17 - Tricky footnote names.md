# 17: tricky footnote names (2026-08-10)

Automated coverage: 7 former checks now live in test/sheet-17-tricky-footnote-names.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Nothing on this sheet needs a human in the real app: every check was a toast, a caret landing, or a line of text. Backticked, dollar, case-variant, hashed, and CJK names are all pinned by units now, as are the Rename and name-the-selection modals refusing `a#b` and the popup refusing to bind a `#` id.
