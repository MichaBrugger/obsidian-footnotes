# 04: the popup editor

Settings: `Edit footnotes in a popup` ON, defaults otherwise. Undo
between checks. Every fixture is already in this note. The popup-OFF
jumps are sheet 05.

Fixture reference to navigate from: jump me[^1] now. Decoy for the
idle-note check: `[^name]: fake` sits in backticks on this line, and
this note counts as idle once it has been saved.

## Basics

- [ ] Inserting a footnote into this sentence opens the popup at the caret; the caret never leaves the text
- [ ] Pressing the hotkey inside `[^1]` opens the popup on its definition
- [ ] Hotkey again / Escape / a click outside closes it
- [ ] With the popup open, click into the NOTE's text and press Escape: the popup closes from there too (2026-09-04)
- [ ] With the popup open (focus inside it), press the Toggle reading view hotkey ONCE: the popup closes and the note switches to Reading view in that one press; toggle back, no popup left behind (2026-09-04)
- [ ] With the popup open, switch to Reading view with the pen icon instead: the popup closes (2026-09-04)

## Persistence and edge cases

- [ ] Type a definition, close the popup, immediately insert the next footnote: the typed definition survives
- [ ] Type a definition and PAUSE about 2 s with the popup still open: the text appears in the note's definition line below (live propagation, matching Obsidian's stock hover editor; deliberate, 2026-08-08)
- [ ] Known accepted quirk (the stock hover editor has it too): after typing AND undoing inside the popup, an undo in the main editor may bring the text back once; a second undo settles it
- [ ] With `Lint on footnote creation` ON: the note is already linted the moment the popup appears (2026-08-27); switch to Reading view with the popup up: it closes and nothing edits the note text any further (check in source view)
- [ ] Vim users: the Esc that exits insert mode inside the popup does NOT also close the popup; a second Esc closes it
- [ ] With this note idle (saved), create a footnote NAMED `name` (the decoy above carries `[^name]: fake` in backticks): the popup appears immediately, no 2-second invisible stall and no silent fall-back to the jump (2026-08-26: the pre-open buffer check matched the decoy in the stale buffer and skipped saving the new definition to disk)

## Rapid entry (crash fixed 2026-08-13)

Optional: open the dev console (Ctrl+Shift+I) to watch for errors. Starting from the end of this sentence, do three fast rounds of: press the numbered hotkey, type a few characters into the popup, press the hotkey again to close, and immediately press it again for the next footnote.

- [ ] Every definition ends up with exactly the text typed for it; nothing swapped into a neighbor, nothing appended to the sentence itself
- [ ] The console shows no `Cannot read properties of undefined (reading 'split')` errors
- [ ] Closing feels immediate; the next popup opens without a long stall

(The phone repeat is sheet 24's.)

[^1]: the definition to land on
