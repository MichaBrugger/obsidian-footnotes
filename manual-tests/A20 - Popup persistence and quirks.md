# A20: popup persistence and edge cases

Settings: `Edit footnotes in a popup` ON (see A3 for basics, A12 for
rapid entry).

- [ ] Type a definition, close the popup, immediately insert the next footnote: the typed definition survives
- [ ] Type a definition and PAUSE ~2s with the popup still open: the text appears in the note's definition line below (live propagation, matching Obsidian's stock hover editor — deliberate, 2026-08-08)
- [ ] Known accepted quirk (stock hover editor has it too): after typing AND undoing inside the popup, an undo in the main editor may bring the text back once; a second undo settles it
- [ ] With lint-on-creation ON: create a footnote (popup opens), switch to Reading view with the popup up, close the popup via hotkey — the note text is NOT edited by the deferred lint (check in source view)
- [ ] Vim users: Esc that exits insert mode inside the popup does NOT also close the popup; a second Esc closes it
