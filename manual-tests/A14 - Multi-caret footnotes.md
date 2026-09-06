# A14: multi-caret footnotes (2026-08-22)

Settings: defaults. Multiple Alt-clicked carets get the SAME footnote at
every one — cite one source many times in one press. Alt+CLICK places
carets; Alt+DRAG would make selections instead (those convert, see A8/A9).

Fixture, place carets after "alpha", after "charlie", and after "echo":

alpha bravo charlie delta echo

The fixture also keeps a numbered footnote alive[^5] for the refusal and lint checks — nothing to add by hand.

[^5]: five

- [ ] NUMBERED hotkey: the same `[^N]` lands at every caret with ONE definition; popup (or the jump) lands on that one definition; ONE undo reverts all of it
- [ ] NAMED hotkey: a `[^]` skeleton at every caret with a cursor inside each — type the name once, it fills all of them; a second press with the cursors STILL INSIDE the filled references creates the single shared definition (caret lands on it, or the popup opens on it and closing it returns the caret after the FIRST reference, 2026-08-29) — no "cursor inside an existing footnote" refusal (2026-08-27)
- [ ] NAMED second press while the skeletons are still EMPTY `[^]`: the empty-reference warning shows and every cursor stays for typing (2026-08-27)
- [ ] INLINE hotkey: `^[]` at every caret, typing writes the same body into all of them; a second press when done hops ONE cursor out, just past the FIRST inline footnote (the same landing every multi-caret flow ends on, 2026-08-29) — while still empty it warns and every cursor stays (2026-08-27)
- [ ] PASTE hotkey: the same clipboard text wrapped as `^[...]` at every caret, and ONE cursor left after the FIRST wrapper (no multi-cursor to click out of; ruling 2026-09-04)
- [ ] With `Insert footnote at end of word` ON, two carets in the SAME word produce ONE reference (they collapse to the word's end)
- [ ] ATOMIC refusal: put one caret inside the `code span` here (or inside the fixture's `[^5]`, or a definition body) with another caret in plain text — the press toasts and NOTHING is inserted at any caret
- [ ] With `Lint on footnote creation` and `Reindex` ON (popup off): the NUMBERED press at several carets renumbers everything (the fixture's `[^5]`→`[^1]`, the new references→`[^2]`) and lands on the new empty definition — full parity with a single-caret press (2026-08-25)
- [ ] MIXED shape: drag-select a word, then Alt-click a second caret elsewhere, press any footnote hotkey: the press REFUSES with the one-continuous-stretch toast and nothing changes anywhere — the extra caret is never silently dropped (2026-08-25)
