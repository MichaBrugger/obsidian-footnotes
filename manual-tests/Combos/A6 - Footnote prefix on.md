---
footnote-prefix: 7.
---

# A6: per-note footnote prefix ON

Settings: `Per-note footnote prefix` ON.

This note already carries one prefixed footnote[^7.1].

- [ ] Auto-numbered hotkey inserts `[^7.2]` in this sentence
- [ ] Again right after the new marker chains `[^7.3]`
- [ ] Named hotkey creates `[^7.]` with the caret right after the prefix, so the namespace is visible while you type the name
- [ ] Type a name and press again inside `[^7.tag]` — the `[^7.tag]:` detail is created
- [ ] Press again inside the UNTOUCHED `[^7.]` instead — the caret hops out past the bracket and no bare-prefix footnote is created (every footnote hotkey hops the same way)
- [ ] A hand-typed plain `[^tag]` keeps its name at detail creation; linting applies the prefix to it later
- [ ] Toggle OFF: the hotkeys insert plain `[^1]` / `[^]`

[^7.1]: the first prefixed footnote
