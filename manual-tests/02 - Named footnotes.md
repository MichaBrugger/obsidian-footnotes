# 02: named footnotes

Settings: defaults, popup OFF. Undo between checks. Every fixture is already in this note.

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

## Naming a selection (the name modal)

Select `name me` in the next line and press the NAMED hotkey; the fixture footnote[^1] below is what the already-used check collides with.

A sentence you can name me from, twice over.

- [ ] In the modal, type `a[b`, then `a b`, then `a` + backtick + `b`, then `a#b`: each shows "Footnote names can't contain spaces, backticks, brackets, or "#"." inline and the modal stays open
- [ ] Type `1` (already a footnote): ""[^1]" is already used by another footnote."
- [ ] Named key on a selection, then edit the note behind the open modal and press Enter: "The note changed while naming the footnote. Reselect the text and try again."

(An abandoned `[^]`'s lint alert is sheet 23's check.)

[^1]: the fixture definition the modal collides with
