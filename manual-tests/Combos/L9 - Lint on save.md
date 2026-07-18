# L9: lint on save

Settings: `Lint on save` ON, everything else default.

The messy line below reindexes to `[^1]`/`[^2]` only on a MANUAL save.

messy[^20] markers[^10] here

[^20]: twenty, used first
[^10]: ten, used second

- [ ] Ctrl+S lints (then undo restores the mess in one step)
- [ ] With vim keybindings on, `:w` lints identically
- [ ] Waiting with the note open does nothing (background autosave never lints)
- [ ] With `Lint on save` OFF again, Ctrl+S leaves the mess alone
