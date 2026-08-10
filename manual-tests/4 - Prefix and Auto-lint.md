---
footnote-prefix: 3.
---

# Prefix and auto-lint triggers

## Per-note footnote prefix

This note's frontmatter sets `footnote-prefix: 3.` and already contains one prefixed footnote[^3.1].

- [ ] With `Per-note footnote prefix` ON: the auto-numbered hotkey inserts `[^3.2]` here (counting continues within the prefix)
- [ ] Another press right after that reference chains `[^3.3]`
- [ ] Named hotkey prefills the prefix: it creates `[^3.]` with the caret after the prefix; type the name, press again inside to create the definition (a second press inside the untouched `[^3.]` keeps the caret put and asks for a suffix)
- [ ] With the toggle OFF: the same hotkey inserts plain `[^1]` (the property is ignored)
- [ ] With `Apply the note's footnote prefix` ON: linting renumbers prefixed footnotes WITHIN their namespace (e.g. `[^3.5]` can become `[^3.2]`) but always keeps the prefix, so merged chapters never collide
- [ ] With `Apply the note's footnote prefix` OFF: prefixed footnotes are treated as NAMED footnotes and keep their ids (no namespace renumbering; QOL 2026-08-08)
- [ ] With `Apply the note's footnote prefix` ON (Linting page): running **Lint footnotes** converts the plain footnotes in the Lint-on-save section below into `3.`-prefixed ones, and would rename a named `[^tag]` to `[^3.tag]` (undo afterwards)
- [ ] Type an untouched placeholder `[^3.]` into a sentence and run **Lint footnotes**: the unnamed-reference alert counts it just like `[^]` (a bare prefix is an unfilled footnote, QOL 2026-08-07); remove it afterwards

[^3.1]: the first prefixed footnote

## Set footnote prefix command (QOL)

Run **Set footnote prefix** from the command palette:

- [ ] The modal opens prefilled with this note's current prefix (`3.`)
- [ ] Entering `10` and pressing Enter shows the ends-in-a-number error inline, and the modal stays open
- [ ] Entering a prefix with a space does the same
- [ ] Fixing it to `4.` and pressing Enter closes the modal and updates the property in the frontmatter
- [ ] Running the command again and clearing the field removes the property entirely
- [ ] Escape still cancels without changes
- [ ] With `Per-note footnote prefix` turned OFF, saving a prefix warns that the feature toggle is off, so the prefix won't be used yet (QOL 2026-08-07)

## Digit-ending prefix guards (QOL)

Set the property to a digit-ending value (e.g. `10`) by hand in the frontmatter, then:

- [ ] The auto-numbered hotkey (with the prefix toggle ON) shows a "No footnote was created" toast and inserts NOTHING (same for the named hotkey; no cleanup needed, fixed 2026-08-07)
- [ ] **Lint footnotes** alerts "Linting canceled" and changes NOTHING
- [ ] Lint on save / on footnote creation cancel with the same alert
- [ ] Restoring `3.` makes everything work again

## Lint on save

Turn on `Lint on save` (Linting settings page), make a mess of the line below by hand (or just trust it), then:

- [ ] Ctrl+S lints this note before the write, messy[^20] references[^10] reorder to `[^1]`/`[^2]`
- [ ] Saving AGAIN right away shows "No linting needed." (a manual save is an explicit command and reports its outcome, decided 2026-08-08; only lint on footnote creation is silent when clean)
- [ ] With vim keybindings enabled (Settings → Editor), `:w` lints exactly the same way
- [ ] Doing nothing and waiting does NOT lint, background autosave never triggers it

[^20]: twenty, used first
[^10]: ten, used second

## Lint on footnote creation

Turn on `Lint on footnote creation` (it replaced `Lint on focused file change`), then insert a NEW auto-numbered footnote into the messy Lint-on-save line above:

- [ ] Creating the footnote lints the whole note immediately ("Footnotes linted." notice) and the caret lands on the new empty definition
- [ ] Creating a footnote in an already-clean spot shows NO notice (silent when nothing changes)
- [ ] With the popup editor ON, the lint runs after the popup closes instead
- [ ] Switching between notes never triggers a lint anymore
