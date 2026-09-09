# 02: named footnotes

Settings: defaults, popup OFF. Undo between checks. Every fixture is
already in this note.

## The two-step flow

Insert into this sentence.

- [ ] Named hotkey inserts `[^]` with the caret inside the brackets
- [ ] Type a name, press the hotkey again with the caret still inside: the `[^name]:` definition is created
- [ ] Type a name, then press the NUMBERED hotkey by accident: it creates the definition exactly like the named key; nothing is nested into the brackets (parity fixed 2026-08-09)
- [ ] Type a name with a space in it and press again: a toast warns that the name won't work as a footnote, no broken definition is created

## Empty reference guard (QOL 2026-08-07)

Fixture: an empty [^] reference sits in this sentence. Put the caret between its brackets.

- [ ] The NAMED hotkey toasts "This footnote reference is empty. Type a name between the brackets." and the caret stays put
- [ ] The NUMBERED, INLINE, and PASTE hotkeys show the same toast, nothing nests

(An abandoned `[^]`'s lint alert is sheet 23's check.)
