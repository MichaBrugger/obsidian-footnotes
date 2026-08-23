# A21: insertion inside table cells

Settings: defaults (see A9 for selection conversion in cells).

| Insert here    | And here          |
| -------------- | ----------------- |
| Click in me () | Named one here () |
| left \| right[^tp] |  |

- [ ] With the caret inside a cell (cell editor active), numbered/named/inline insertion lands inside the cell without shredding the pipes
- [ ] The definition still lands at the bottom of the note, outside the table
- [ ] Escaped pipe: caret just inside `[^tp]` (after the `\|`), named key CONTINUES the footnote (creates its definition) instead of nesting `[^]` (2026-08-10)

[^tp]: escaped-pipe fixture definition
