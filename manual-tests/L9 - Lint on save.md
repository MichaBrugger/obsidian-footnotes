# L9: lint on save

Settings: `Lint on save` ON, everything else default.

The messy line below reindexes to `[^1]`/`[^2]` only on a MANUAL save.

messy[^20] references[^10] here

[^20]: twenty, used first
[^10]: ten, used second

- [ ] Ctrl+S lints (then undo restores the mess in one step)
- [ ] Saving again right away shows "No linting needed." (manual saves report their outcome, decided 2026-08-08; only lint on footnote creation is silent when clean)
- [ ] With vim keybindings on, `:w` lints identically
- [ ] Waiting with the note open does nothing (background autosave never lints)
- [ ] With `Lint on save` OFF again, Ctrl+S leaves the mess alone
