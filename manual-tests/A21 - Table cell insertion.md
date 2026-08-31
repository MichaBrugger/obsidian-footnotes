# A21: insertion inside table cells

Settings: defaults (see A9 for selection conversion in cells).

| Insert here    | And here          |
| -------------- | ----------------- |
| Click in me () | Named one here () |
| left \| right[^tp] |  |

- [ ] With the caret inside a cell (cell editor active), numbered/named/inline insertion lands inside the cell without shredding the pipes
- [ ] The definition still lands at the bottom of the note, outside the table
- [ ] Escaped pipe: caret just inside `[^tp]` (after the `\|`), named key CONTINUES the footnote (creates its definition) instead of nesting `[^]` (2026-08-10)
- [ ] Undo after a cell creation (plain or from selection): the FIRST undo removes the definition and a notice explains the reference is still in the note ("Undo again to remove the reference too."); the second undo removes the reference AND the notice dismisses itself the moment it lands, no lingering toast (2026-08-29). Two steps by construction — the reference goes through the cell's own editor, the definition through the note's, and their histories can't merge (2026-08-27)

[^tp]: escaped-pipe fixture definition
