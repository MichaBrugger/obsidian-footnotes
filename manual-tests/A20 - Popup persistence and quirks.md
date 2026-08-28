# A20: popup persistence and edge cases

Settings: `Edit footnotes in a popup` ON (see A3 for basics, A12 for
rapid entry).

Decoy fixture for the last check: `[^name]: fake` sits in backticks on
this line, and this note counts as idle once it has been saved.

- [ ] Type a definition, close the popup, immediately insert the next footnote: the typed definition survives
- [ ] Type a definition and PAUSE ~2s with the popup still open: the text appears in the note's definition line below (live propagation, matching Obsidian's stock hover editor — deliberate, 2026-08-08)
- [ ] Known accepted quirk (stock hover editor has it too): after typing AND undoing inside the popup, an undo in the main editor may bring the text back once; a second undo settles it
- [ ] With lint-on-creation ON: the note is already linted when the popup appears (2026-08-27); switch to Reading view with the popup up, close the popup via hotkey — nothing edits the note text any further (check in source view)
- [ ] Vim users: Esc that exits insert mode inside the popup does NOT also close the popup; a second Esc closes it
- [ ] With this note idle (saved), create a footnote NAMED `name` (the decoy fixture above carries `[^name]: fake` in backticks): the popup appears immediately — no ~2-second invisible stall and no silent fall-back to the jump (Jason's report 2026-08-26: the pre-open buffer check matched the decoy in the stale buffer and skipped saving the new definition to disk)
