# 09: multiple cursors (2026-08-22)

Settings: defaults. Undo between checks. Every fixture is already in this note. Multiple Alt-clicked carets get the SAME footnote at every one: cite one source many times in one press. Alt+CLICK places carets; Alt+DRAG would make selections instead (those convert, sheet 06).

Fixture, place carets after "alpha", after "charlie", and after "echo":

alpha bravo charlie delta echo

The fixture also keeps a numbered footnote alive[^5] for the refusal and lint checks, a hashed reference[^#tag] for the invalid-name refusal, and a `code span` for the atomic refusal.

[^5]: five

- [ ] NUMBERED hotkey: the same `[^N]` lands at every caret with ONE definition; the popup (or the jump) lands on that one definition; ONE undo reverts all of it
- [ ] NAMED hotkey: a `[^]` skeleton at every caret with a cursor inside each; type the name once, it fills all of them; a second press with the cursors STILL INSIDE the filled references creates the single shared definition (the caret lands on it, or the popup opens on it and closing it returns the caret after the FIRST reference, 2026-08-29); no "cursor inside an existing footnote" refusal (2026-08-27)
- [ ] NAMED second press while the skeletons are still EMPTY `[^]`: the empty-reference warning shows and every cursor stays for typing (2026-08-27)
- [ ] INLINE hotkey: `^[]` at every caret, typing writes the same body into all of them; a second press when done hops ONE cursor out, just past the FIRST inline footnote (the same landing every multi-caret flow ends on, 2026-08-29); while still empty it warns and every cursor stays (2026-08-27)
- [ ] PASTE hotkey: the same clipboard text wrapped as `^[...]` at every caret, and ONE cursor left after the FIRST wrapper (ruling 2026-09-04)
- [ ] With `Insert footnote at end of word` ON, two carets in the SAME word produce ONE reference (they collapse to the word's end)
- [ ] ATOMIC refusal: put one caret inside the `code span` above (or inside the fixture's `[^5]`, or its definition body) with another caret in plain text: the press toasts and NOTHING is inserted at any caret
- [ ] With `Lint on footnote creation` and `Reindex` ON (popup off): the NUMBERED press at several carets renumbers everything (the fixture's `[^5]` becomes `[^1]`, the new references `[^2]`) and lands on the new empty definition; full parity with a single-caret press (2026-08-25)
- [ ] MIXED shape: drag-select a word, then Alt-click a second caret elsewhere, press any footnote hotkey: the press REFUSES with the one-continuous-stretch toast and nothing changes anywhere; the extra caret is never silently dropped (2026-08-25)

## Refusals (the toast, nothing created)

- [ ] Two Alt-click carets, one in prose and one inside `[^5]`, any insert key: "No footnotes were created: footnotes can't be nested inside other footnotes."
- [ ] Two carets, both inside `[^#tag]`, NAMED key: the won't-work-as-a-footnote toast, nothing created
- [ ] Two carets in prose, PASTE key with an empty clipboard: "The clipboard is empty, so there is nothing to put in an inline footnote."
