# 08: footnotes and tables

Settings: defaults. Undo between checks. Every fixture is already in this note. Rule (2026-09-04): text inside ONE cell can become a footnote, and so can a whole table selected with the text around it (sheet 07); a cell, a few cells, or a row never can.

## Inserting inside a cell

| Insert here    | And here          |
| -------------- | ----------------- |
| Click in me () | Named one here () |
| left \| right[^tp] |  |

- [ ] With the caret inside a cell (cell editor active), numbered/named/inline insertion lands inside the cell without shredding the pipes
- [ ] The definition still lands at the bottom of the note, outside the table
- [ ] Escaped pipe: caret just inside `[^tp]` (after the `\|`), named key CONTINUES the footnote (creates its definition) instead of nesting `[^]` (2026-08-10)
- [ ] Undo after a cell creation by the numbered key, the paste key, or a selection conversion (the plugin wrote the reference itself, one undo step, and the definition the next): the FIRST undo removes the definition and a notice explains the footnote reference is still in the note ("Undo again to remove the reference too."); the NAMED key's reference is typed by you, so its notice states the fact without that sentence; the second undo removes the reference AND the notice dismisses itself the moment it lands, no lingering toast (2026-08-29). Two steps by construction: the reference goes through the cell's own editor, the definition through the note's, and their histories can't merge (2026-08-27)

## Converting a selection inside a cell

| Convert in me | Notes |
| ------------- | ----- |
| cell word target | click into the cell first |

- [ ] With cell editing active, select `target` and press the INLINE hotkey: it becomes `^[target]` inside the cell, pipes intact
- [ ] Undo, select `word` and press the NUMBERED hotkey: the cell gets `[^1]` and the prefilled definition lands below the table
- [ ] Switch to SOURCE mode. Select `word target` inside the cell and press the numbered hotkey: converts in place, pipes intact

## Selections that cut through a table (source mode; the toast, nothing changes)

The toast: "No footnote was created: the selection cuts through a table. Select text inside one cell, or the whole table with the text around it."

before the table

| a | b |
| --- | --- |
| 1 | 2 |

after the table

- [ ] Select from `target` through the pipe into `click` (two cells of the table above) and press any converting hotkey
- [ ] Select the header row `| a | b |` through the `| --- | --- |` row
- [ ] Select from `before the table` through only the header row (the table cut in half from outside)
- [ ] Select from `| 1 | 2 |` through `after the table`

## Cell toast to watch for (parked 2026-09-05)

- [ ] Inline insertion inside a cell in Live Preview never shows "No footnote was created: footnotes can't go inside code, math, or other protected text." (seen once, never reproduced; note the exact table and steps if it appears)

[^tp]: escaped-pipe fixture definition
