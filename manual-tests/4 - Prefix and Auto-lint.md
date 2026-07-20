---
footnote-prefix: 3.
---

# Prefix and auto-lint triggers

## Per-note footnote prefix

This note's frontmatter sets `footnote-prefix: 3.` and already contains one prefixed footnote[^3.1].

- [ ] With `Per-note footnote prefix` ON: the auto-numbered hotkey inserts `[^3.2]` here (counting continues within the prefix)
- [ ] Another press right after that marker chains `[^3.3]`
- [ ] With the toggle OFF: the same hotkey inserts plain `[^1]` (the property is ignored)
- [ ] Reindexing treats prefixed footnotes as NAMED, so linting never renumbers them across chapters

[^3.1]: the first prefixed footnote

## Set footnote prefix command (QOL)

Run **Set footnote prefix** from the command palette:

- [ ] The modal opens prefilled with this note's current prefix (`3.`)
- [ ] Entering `10` and pressing Enter shows the ends-in-a-number error inline, and the modal stays open
- [ ] Entering a prefix with a space does the same
- [ ] Fixing it to `4.` and pressing Enter closes the modal and updates the property in the frontmatter
- [ ] Running the command again and clearing the field removes the property entirely
- [ ] Escape still cancels without changes

## Digit-ending prefix guards (QOL)

Set the property to a digit-ending value (e.g. `10`) by hand in the frontmatter, then:

- [ ] The auto-numbered hotkey (with the prefix toggle ON) alerts that the prefix was ignored and inserts `[^1]`
- [ ] **Lint footnotes** alerts "Linting canceled" and changes NOTHING
- [ ] Lint on save / on file change cancel with the same alert
- [ ] Restoring `3.` makes everything work again

## Lint on save

Turn on `Lint on save` (Linting settings page), make a mess of the line below by hand (or just trust it), then:

- [ ] Ctrl+S lints this note before the write, messy[^20] markers[^10] reorder to `[^1]`/`[^2]`
- [ ] Saving AGAIN right away shows "No linting needed." (QOL)
- [ ] With vim keybindings enabled (Settings → Editor), `:w` lints exactly the same way
- [ ] Doing nothing and waiting does NOT lint, background autosave never triggers it

[^20]: twenty, used first
[^10]: ten, used second

## Lint on focused file change

Turn on `Lint on focused file change`, re-mess this note, then click over to any other note:

- [ ] A notice reports this note was linted the moment you left it
- [ ] Coming back shows the linted result
- [ ] Leaving again without re-messing shows "No linting needed in …" instead (QOL)
- [ ] Switching to a sidebar (search, file explorer) does NOT count as leaving the note
