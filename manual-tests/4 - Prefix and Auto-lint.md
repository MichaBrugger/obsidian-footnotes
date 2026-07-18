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

## Lint on save

Turn on `Lint on save` (Linting settings page), make a mess of the line below by hand (or just trust it), then:

- [ ] Ctrl+S lints this note before the write, messy[^20] markers[^10] reorder to `[^1]`/`[^2]`
- [ ] With vim keybindings enabled (Settings → Editor), `:w` lints exactly the same way
- [ ] Doing nothing and waiting does NOT lint, background autosave never triggers it

[^20]: twenty, used first
[^10]: ten, used second

## Lint on focused file change

Turn on `Lint on focused file change`, re-mess this note, then click over to any other note:

- [ ] A notice reports this note was linted the moment you left it
- [ ] Coming back shows the linted result
- [ ] Switching to a sidebar (search, file explorer) does NOT count as leaving the note
