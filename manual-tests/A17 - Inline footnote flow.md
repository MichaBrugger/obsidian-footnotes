# A17: inline footnote flow

Settings: defaults.

- [ ] Inline hotkey inserts `^[]` with the caret inside
- [ ] Second press while still EMPTY toasts to type its text, caret stays put (QOL 2026-08-08)
- [ ] Type text between the brackets, press again: NOW the caret hops past the closing bracket
- [ ] Copy this sentence, then use the paste-inline hotkey: The clipboard text
  spans two lines and should collapse to one.
- [ ] Caret inside an EXISTING filled inline footnote + paste-inline hotkey: it hops out past the bracket instead of nesting the clipboard (fixed 2026-08-07)

Hotkeys inside this inline footnote^[put the caret in here], a bare
reference[^tag] with no definition, and the reverse:

- [ ] NUMBERED and NAMED hotkeys inside the inline footnote hop just past the closing bracket, nothing nested
- [ ] Insert a numbered footnote, put the caret back INSIDE its reference, press the INLINE hotkey: it navigates to the definition (or popup) — no `^[]` nested into the reference
- [ ] Caret inside the bare `[^tag]` above, INLINE hotkey: the definition is created like the named key would
- [ ] The PASTE hotkey navigates the same way, and the clipboard stays untouched for the next real paste
