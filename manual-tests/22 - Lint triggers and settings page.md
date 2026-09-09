# 22: lint triggers and the Linting settings page

Settings: defaults, then the trigger named in each section. Undo
between checks. Every fixture is already in this note.

The messy fixture: the references are out of order and reindex to
`[^1]`/`[^2]` whenever a lint runs.

start messy[^20] references[^10] here

[^20]: twenty, used first
[^10]: ten, used second

## Lint on save

`Lint on save` ON, everything else default.

- [ ] Ctrl+S lints (then undo restores the mess in one step)
- [ ] Saving again right away shows "No linting needed." (manual saves report their outcome, decided 2026-08-08; only lint on footnote creation is silent when clean)
- [ ] With vim keybindings on, `:w` lints identically
- [ ] Waiting with the note open does nothing (background autosave never lints)
- [ ] With `Lint on save` OFF again, Ctrl+S leaves the mess alone

## Lint on footnote creation

`Lint on footnote creation` ON, everything else default. This replaced
the old `Lint on focused file change` trigger (2026-08-05): the lint
happens in the note you are LOOKING AT, at the moment a new footnote
definition is created. Insert a NEW numbered footnote into the word
"start" of the fixture.

- [ ] Inserting the footnote renumbers the whole note (`[^20]`/`[^10]` become sequential) and a "Footnotes linted." notice appears
- [ ] The caret still lands on the NEW footnote's empty definition, even though the lint renumbered it
- [ ] Undo, insert a footnote into this already-clean sentence: no notice at all (clean creations are silent)
- [ ] With `Edit footnotes in a popup` ON: the note is ALREADY linted the moment the popup appears (renumbering visible behind it), and the popup edits the NEW footnote under its renumbered id; its `[^n]:` label matches the renumbered definition (2026-08-27)
- [ ] Same popup press: the popup opens AT the new reference (the caret sits just past it, not on the FIRST footnote the renumbering touched) and closing the popup hands the caret back there too (2026-08-27)
- [ ] With the toggle OFF, creation leaves the mess alone
- [ ] Switching between notes never lints anything anymore (the old trigger is gone)

## The Linting settings page

- [ ] The **Orphans and duplicates** section sits between Rules and Reindexing, holding `Delete orphaned references`, `Delete orphaned definitions`, `Merge duplicate definitions` (all OFF by default; off = the lint ALERTS about that kind)
- [ ] The **Rules** group holds four toggles: punctuation, move definitions, `Fix definitions hidden by a missing blank line` (ON by default; off = the lint ALERTS about those labels, see sheet 25), and the prefix rule
- [ ] `Renumber named footnotes` is greyed out while `Reindex` is off
- [ ] `Apply the note's footnote prefix` is greyed out while the prefix feature is off (main tab); the Orphans toggles are never greyed
- [ ] Turn OFF all four rules AND Reindex AND the three Orphans-and-duplicates toggles, run **Lint footnotes**: "All lint rules are turned off in the plugin settings, so there is nothing to lint." (not the misleading "No linting needed."); Ctrl+S with lint-on-save says the same (2026-08-10)
- [ ] With the community Linter plugin ENABLED, the page shows a "Using the Linter plugin?" note about turning off Linter's own footnote rules; with Linter disabled, the note is hidden (2026-08-08)
