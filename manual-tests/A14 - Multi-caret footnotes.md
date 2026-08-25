# A14: multi-caret footnotes (2026-08-22)

Settings: defaults. Multiple Alt-clicked carets get the SAME footnote at
every one — cite one source many times in one press. Alt+CLICK places
carets; Alt+DRAG would make selections instead (those convert, see A8/A9).

Fixture, place carets after "alpha", after "charlie", and after "echo":

alpha bravo charlie delta echo

- [ ] NUMBERED hotkey: the same `[^N]` lands at every caret with ONE definition; popup (or the jump) lands on that one definition; ONE undo reverts all of it
- [ ] NAMED hotkey: a `[^]` skeleton at every caret with a cursor inside each — type the name once, it fills all of them; a second press on one filled reference creates the single shared definition
- [ ] INLINE hotkey: `^[]` at every caret, typing writes the same body into all of them
- [ ] PASTE hotkey: the same clipboard text wrapped as `^[...]` at every caret
- [ ] With `Insert footnote at end of word` ON, two carets in the SAME word produce ONE reference (they collapse to the word's end)
- [ ] ATOMIC refusal: put one caret inside the `code span` here (or inside an existing footnote, or a definition body) — the press toasts and NOTHING is inserted at any caret
- [ ] With `Lint on footnote creation` and `Reindex` ON (popup off), add a `[^5]` + `[^5]: five` to the fixture first: the NUMBERED press at several carets renumbers everything (`[^5]`→`[^1]`, the new references→`[^2]`) and lands on the new empty definition — full parity with a single-caret press (2026-08-25)
