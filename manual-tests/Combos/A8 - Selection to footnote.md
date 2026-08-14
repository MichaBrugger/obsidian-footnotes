# A8: selection becomes a footnote (issue #35)

Settings: defaults (popup on or off both fine; see A3 for popup behavior).

Select the words `move this aside` in the next line before each press:

The paragraph wants to move this aside for later readers.

- [ ] NUMBERED hotkey: selection becomes `[^1]`, and the definition below holds `move this aside` (popup shows it prefilled; popup off jumps to the end of the body)
- [ ] Undo once: the sentence is back exactly as it was
- [ ] INLINE hotkey on the same selection: it becomes `^[move this aside]` in place, caret after the bracket
- [ ] Undo, select ` move this ` WITH the spaces: converting keeps both spaces in the sentence, only the words move
- [ ] Select the whole line by dragging through the newline: the whole line still converts
- [ ] NAMED hotkey with a selection: a modal asks for the name; Enter creates `[^name]` with the selection as its definition, one undo reverts it all
- [ ] In the modal: a name that's already defined, or one with a space, shows the reason inline and stays open; Escape cancels with nothing changed
- [ ] Paste-inline hotkey with a selection: a toast redirects to the other keys, and the clipboard is untouched
