# A8: selection becomes a footnote (issue #35)

Settings: defaults (popup on or off both fine; see A3 for popup behavior).

This fixture keeps a numbered footnote alive[^5] for the numbering and lint checks below — nothing to add by hand.

[^5]: five

Select the words `move this aside` in the next line before each press:

The paragraph wants to move this aside for later readers. A second sentence rides along for the multi-line checks.

- [ ] NUMBERED hotkey: selection becomes `[^6]` (numbering continues past the fixture's `[^5]`), and the definition below holds `move this aside` (popup shows it prefilled; popup off jumps to the end of the body)
- [ ] Undo once: the sentence is back exactly as it was
- [ ] INLINE hotkey on the same selection: it becomes `^[move this aside]` in place, caret after the bracket
- [ ] Undo, select ` move this ` WITH the spaces: converting keeps both spaces in the sentence, only the words move
- [ ] With `Expand selections to whole words` ON (the default): select from INSIDE `paragraph` to INSIDE `readers` — the conversion takes `paragraph wants to move this aside for later readers.` whole, cut-off ends completed and the period included (2026-08-29); with the toggle OFF, the same selection converts exactly as made
- [ ] Select the whole line by dragging through the newline: the whole line still converts
- [ ] Select BOTH sentences of the example paragraph plus this line (three-plus lines) and press the NUMBERED hotkey: everything moves into ONE definition, continuation lines indented four spaces — the blank separator lines between paragraphs carry the same four-space indent (2026-08-21), so the whole body sits flush; the rendered footnote shows the paragraphs (2026-08-19)
- [ ] With the popup setting ON, the same multi-line conversion opens the popup showing the whole multi-paragraph body, no Properties widget bleed
- [ ] NAMED hotkey with a selection: a modal asks for the name; Enter creates `[^name]` with the selection as its definition, one undo reverts it all
- [ ] NAMED hotkey with a MULTI-LINE selection: same modal flow, the body lands multi-paragraph
- [ ] In the modal: a name another footnote already uses, or one with a space, shows the reason inline and stays open; Escape cancels with nothing changed
- [ ] With the modal open and a name typed, press ANY footnote hotkey (numbered/named/inline): it submits exactly like Enter — footnote created, modal closed (2026-08-22); with an INVALID name typed, the hotkey shows the inline reason and the modal stays open
- [ ] Paste-inline hotkey with a selection: a toast redirects to the other keys, and the clipboard is untouched
- [ ] With `Lint on footnote creation` and `Reindex` ON (popup off): converting a selection (NUMBERED, and NAMED via the modal) renumbers everything (the fixture's `[^5]`→`[^1]`, the new footnote→`[^2]`/its name kept) right after the conversion — every footnote-creating press lints, same as a plain insert (2026-08-25)
- [ ] Same setup: after that lint settles, the cursor sits at the END of the NEW footnote's definition body (`[^2]: move this aside`, or `[^name]: …` for the named flow) even though the lint renumbered it and moved the definitions to the bottom — never on the other footnote or back in the paragraph (2026-08-26)
