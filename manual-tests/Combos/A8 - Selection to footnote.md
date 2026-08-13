# A8: selection becomes a footnote (issue #35)

Settings: defaults (popup on or off both fine; see A3 for popup behavior).

Select the words `move this aside` in the next line before each press:

The paragraph wants to move this aside for later readers.

- [ ] NUMBERED hotkey: selection becomes `[^1]`, and the definition below holds `move this aside` (popup shows it prefilled; popup off jumps to the end of the body)
- [ ] Undo once: the sentence is back exactly as it was
- [ ] INLINE hotkey on the same selection: it becomes `^[move this aside]` in place, caret after the bracket
- [ ] Undo, select ` move this ` WITH the spaces: converting keeps both spaces in the sentence, only the words move
- [ ] Select the whole line by dragging through the newline: the whole line still converts
- [ ] NAMED hotkey with a selection: a toast redirects to the numbered/inline keys, nothing changes
- [ ] Paste-inline hotkey with a selection: same redirect toast, and the clipboard is untouched
