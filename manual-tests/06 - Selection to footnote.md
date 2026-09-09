# 06: selection to footnote

Settings: defaults (popup on or off both fine; the popup is sheet 04).
Undo between checks. Every fixture is already in this note. Tables are
sheet 08 and the block zoo is sheet 07; this sheet owns plain
conversions and their refusals.

This fixture keeps a numbered footnote alive[^5] for the numbering and lint checks below.

[^5]: five

## Converting

Select the words `move this aside` in the next line before each press:

The paragraph wants to move this aside for later readers. A second sentence rides along for the multi-line checks.

- [ ] NUMBERED hotkey: the selection becomes `[^6]` (numbering continues past the fixture's `[^5]`) and the definition below holds `move this aside` (popup ON shows it prefilled; popup OFF jumps to the end of the body)
- [ ] Undo once: the sentence is back exactly as it was
- [ ] INLINE hotkey on the same selection: it becomes `^[move this aside]` in place, caret after the bracket
- [ ] Undo, select ` move this ` WITH the spaces: the words move, the space AFTER them stays in the sentence, and the space BEFORE them goes with the reference so it attaches to `to` (`wants to[^6] aside`; a reference never has a space in front of it, 2026-09-08)
- [ ] Undo, select the second sentence of the paragraph whole (from `A second` to its period): the reference lands right after the first sentence's period, `readers.[^6]`, not `readers. [^6]` (2026-09-08)
- [ ] With `Expand selections to whole words` ON (the default): select from INSIDE `paragraph` to INSIDE `readers`; the conversion takes `paragraph wants to move this aside for later readers.` whole, cut-off ends completed and the period included (2026-08-29); with the toggle OFF, the same selection converts exactly as made
- [ ] Select the whole line by dragging through the newline: the whole line still converts
- [ ] Select BOTH sentences of the example paragraph plus this line (three-plus lines) and press the NUMBERED hotkey: everything moves into ONE definition, continuation lines indented four spaces; the blank separator lines between paragraphs carry the same four-space indent (2026-08-21), so the whole body sits flush, and the rendered footnote shows the paragraphs (2026-08-19)
- [ ] With the popup setting ON, the same multi-line conversion opens the popup showing the whole multi-paragraph body, no Properties widget bleed
- [ ] NAMED hotkey with a selection: a modal asks for the name; Enter creates `[^name]` with the selection as its definition, one undo reverts it all
- [ ] NAMED hotkey with a MULTI-LINE selection: same modal flow, the body lands multi-paragraph
- [ ] In the modal: a name another footnote already uses, or one with a space, shows the reason inline and stays open; Escape cancels with nothing changed
- [ ] With the modal open and a name typed, press ANY footnote hotkey (numbered/named/inline): it submits exactly like Enter, footnote created, modal closed (2026-08-22); with an INVALID name typed, the hotkey shows the inline reason and the modal stays open
- [ ] PASTE hotkey with a selection: a toast redirects to the other keys, and the clipboard is untouched
- [ ] With `Lint on footnote creation` and `Reindex` ON (popup off): converting a selection (NUMBERED, and NAMED via the modal) renumbers everything (the fixture's `[^5]` becomes `[^1]`, the new footnote `[^2]`, or its name kept) right after the conversion; every footnote-creating press lints, same as a plain insert (2026-08-25)
- [ ] Same setup: after that lint settles, the cursor sits at the END of the NEW footnote's definition body (`[^2]: move this aside`, or `[^name]: ...` for the named flow) even though the lint renumbered it and moved the definitions to the bottom; never on the other footnote or back in the paragraph (2026-08-26)

## Refusals (the toast, nothing changes)

Fixture lines: `one two three` for the multi-selection checks; `some code words here` with the code span; a live reference here[^n]; an inline footnote^[like this]; a dead fake `fake [^9]` in code; and the fence below.

- [ ] With Alt+DRAG (Windows; Option on macOS), make TWO separate selections in `one two three` and press the numbered hotkey: "Select one continuous stretch of text to turn it into a footnote." (wording fixed 2026-08-21)
- [ ] Same two selections, PASTE hotkey: the paste key's own redirect ("To turn the selected text into a footnote, use the numbered, named, or inline footnote command."), not the one-stretch toast (2026-09-08)
- [ ] With Alt+CLICK, place extra CARETS instead (no dragged ranges): the press inserts the same footnote at every caret; that flow is sheet 09
- [ ] Select `code words` inside the span: the cuts-through-protected-text toast
- [ ] Select the entire `code span` INCLUDING both backticks plus a word on each side: it converts; the span rides into the footnote whole (2026-08-19)
- [ ] Select a stretch CONTAINING the live reference `[^n]`: the can't-be-nested toast (no nesting, ruling 2026-08-24)
- [ ] Select HALF of that reference (drag through `[^` only): the same toast; a cut would corrupt it
- [ ] Select a stretch containing the inline footnote `^[like this]`: the same toast
- [ ] Select the dead fake `` `fake [^9]` `` whole with a word each side: it CONVERTS (masked fakes aren't footnotes)
- [ ] Select any text inside the fence below: the protected-text toast
- [ ] Select from the line ABOVE the fence to just its opening `` ``` `` line (cutting the block in half): the same toast
- [ ] Select from the line above the fence through its closing `` ``` `` line (the whole block): it converts; the fence rides into the definition indented, and renders as code inside the footnote
- [ ] Select only whitespace anywhere: the press behaves like a plain insert at the caret
- [ ] Any multi-line selection + INLINE hotkey: "Inline footnotes are single-line. Use the numbered or named footnote command to convert a multi-line selection." (ruling 2026-08-20)

```
select me in here
```

## Inside a definition body

Fixture for the definition checks[^d].

- [ ] With the caret in the `[^d]:` body below, EVERY insert hotkey (numbered, named, inline, paste) jumps back to the reference instead of creating (ruling 2026-08-13)
- [ ] Selecting text inside that body and pressing a converting hotkey refuses with the can't-be-nested toast (a selection can't jump)

[^d]: press the inline hotkey with the caret right here
[^n]: nesting-refusal fixture definition
