---
footnote-prefix: 7-
---

# A6: per-note footnote prefix ON

Settings: `Per-note footnote prefix` ON.

This note already carries one prefixed footnote[^7-1], and a hand-written
plain reference[^tag] waits here for the keeps-its-name check.

- [ ] Numbered hotkey inserts `[^7-2]` in this sentence
- [ ] Again right after the new reference chains `[^7-3]`
- [ ] Named hotkey creates `[^7-]` with the caret right after the prefix, so the namespace is visible while you type the name
- [ ] Type a name and press again inside `[^7-tag]`: the `[^7-tag]:` definition is created
- [ ] Press again inside the UNTOUCHED `[^7-]` instead: the caret STAYS PUT and a toast says the reference has only the prefix and asks for a name after it; no bare-prefix footnote is created (every footnote hotkey behaves the same)
- [ ] The fixture's plain `[^tag]` keeps its name at definition creation (press inside it); linting applies the prefix to it later
- [ ] Toggle OFF: the hotkeys insert plain `[^1]` / `[^]`

[^7-1]: the first prefixed footnote
