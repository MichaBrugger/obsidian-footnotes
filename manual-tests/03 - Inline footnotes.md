# 03: inline footnotes

Settings: defaults. Undo between checks. Every fixture is already in
this note.

## Typing one

Insert into this sentence.

- [ ] Inline hotkey inserts `^[]` with the caret inside
- [ ] Second press while still EMPTY toasts "This inline footnote is empty. Type its text between the brackets." and the caret stays put (QOL 2026-08-08)
- [ ] Type text between the brackets, press again: NOW the caret hops past the closing bracket

## From the clipboard

Copy the next two lines together, put the caret at the end of this sentence, and press the paste-inline hotkey.

the clipboard text
spans two lines

- [ ] The result is ONE inline footnote on one line: `^[the clipboard text spans two lines]`
- [ ] Caret inside the EXISTING filled inline footnote in the fixture below + paste-inline hotkey: it hops out past the bracket instead of nesting the clipboard (fixed 2026-08-07)

## Hotkeys inside inline footnotes and references

Fixture: an inline footnote^[put the caret in here], a bare reference[^tag] with no definition, and a numbered footnote[^1] with one.

- [ ] NUMBERED and NAMED hotkeys inside the inline footnote hop just past its closing bracket, nothing nested
- [ ] Caret INSIDE `[^1]`, INLINE hotkey: it navigates to the definition (or opens the popup); no `^[]` nested into the reference
- [ ] Caret inside the bare `[^tag]`, INLINE hotkey: the definition is created exactly like the named key would
- [ ] The PASTE hotkey navigates the same way inside `[^1]`, and the clipboard stays untouched for the next real paste

[^1]: the numbered fixture definition
