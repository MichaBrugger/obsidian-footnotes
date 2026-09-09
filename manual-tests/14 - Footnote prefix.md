---
footnote-prefix: P-
---

# 14: the per-note footnote prefix

Settings: `Per-note footnote prefix` ON. Undo between checks. Every
fixture is already in this note: the frontmatter carries `P-`, one
prefixed footnote[^P-1] exists, a hand-written plain reference[^tag]
waits for the keeps-its-name check, and a hand-typed lowercase
prefixed reference[^p-1] sits here for the collision check. The lint
side of prefixes is sheet 15; an invalid property is sheet 16.

## Inserting under a prefix

- [ ] Numbered hotkey inserts `[^P-2]` in this sentence, NOT a colliding `[^P-1]` (the lowercase `[^p-1]` reserves its number; ids fold case, 2026-08-10)
- [ ] Again right after the new reference chains `[^P-3]`
- [ ] Named hotkey creates `[^P-]` with the caret right after the prefix, so the namespace is visible while you type the name
- [ ] Type a name and press again inside `[^P-tag]`: the `[^P-tag]:` definition is created
- [ ] Press again inside an UNTOUCHED `[^P-]` instead: the caret STAYS PUT and the toast says "This footnote reference has only the prefix. Type a name after it."; no bare-prefix footnote is created (every footnote hotkey behaves the same)
- [ ] The fixture's plain `[^tag]` keeps its name at definition creation (press inside it); linting applies the prefix to it later (sheet 15)
- [ ] Toggle the feature OFF: the hotkeys insert plain `[^1]` / `[^]`

## The Set footnote prefix command

Run **Set footnote prefix** from the command palette:

- [ ] The modal opens prefilled with `P-`
- [ ] `10` + Enter: inline "The footnote prefix can't end in a number. Its footnotes would be indistinguishable from plain numbered ones." and the modal stays open
- [ ] `a b`, `a[b`, `a#b` + Enter: inline "The footnote prefix can't contain spaces, backticks, brackets, or "#"." and the modal stays open
- [ ] `7.` + Enter: the modal closes, a notice confirms, the frontmatter now says `7.`
- [ ] The numbered hotkey now inserts `[^7.1]` in this sentence (a fresh namespace; the `P-` footnotes are untouched)
- [ ] Rerun the command, clear the field, Enter: the property is removed
- [ ] Turn `Per-note footnote prefix` OFF, set a prefix via the command: the confirmation warns "Footnote prefix set to "...", but the "Per-note footnote prefix" setting is turned off, so it won't be used until you enable it." (QOL 2026-08-07); turn it back ON afterwards
- [ ] In Reading view, **Set footnote prefix** is still available in the palette (a frontmatter edit is fine there)

(The phone keyboard-above-the-dialog check is sheet 24's.)

[^P-1]: the first prefixed footnote
