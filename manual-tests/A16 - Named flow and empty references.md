# A16: named two-step flow and the empty-reference guard

Settings: defaults, popup OFF.

- [ ] Named hotkey inserts `[^]` with the caret inside the brackets
- [ ] Type a name, press the hotkey again with the caret still inside: the definition is created
- [ ] Type a name, then press the NUMBERED hotkey by accident: it creates the definition exactly like the named key — nothing is nested into the brackets (parity fixed 2026-08-09)
- [ ] A name with a space in it warns instead of creating a broken definition

Empty guard (QOL 2026-08-07) — get `[^]`, type NOTHING, caret inside:

- [ ] The NAMED hotkey toasts "type a name between the brackets", caret stays put
- [ ] The NUMBERED, INLINE, and PASTE hotkeys show the same toast, nothing nests
- [ ] Click elsewhere leaving the `[^]` behind, run **Lint footnotes**: the empty-reference alert fires (see L13)
