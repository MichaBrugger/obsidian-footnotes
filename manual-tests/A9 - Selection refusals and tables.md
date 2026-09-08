# A9: selection conversion refusals, and tables (issue #35)

Settings: defaults. (Plain multi-line conversion lives in A8; the block
zoo in A13 — this sheet owns the REFUSALS and the table cases.)

- [ ] With Alt+DRAG (Windows; Option on macOS), make TWO separate selections and press the numbered hotkey: a toast asks for one continuous stretch, nothing changes (wording fixed 2026-08-21 — Ctrl-click was wrong; verified live via editor eval)
- [ ] Same two selections, PASTE hotkey: the paste key's own redirect ("To turn the selected text into a footnote, use the numbered, named, or inline footnote command."), not the one-stretch toast (2026-09-08)
- [ ] With Alt+CLICK, place extra CARETS instead (no dragged ranges): the press inserts the same footnote at every caret — that's A14's sheet
- [ ] Select `code words` inside the span on this line: `some code words here` — the cuts-through-protected-text toast appears, nothing changes
- [ ] Select an entire short `code span` INCLUDING both backticks plus a word on each side: it converts — the span rides into the footnote whole (2026-08-19)
- [ ] Select a stretch CONTAINING a live reference like this one[^n] and convert: the contains-a-footnote toast, nothing changes (no nesting, ruling 2026-08-24)
- [ ] Select HALF of that reference (drag through `[^` only) and convert: same toast — a cut would corrupt it
- [ ] Select a stretch containing an inline footnote^[like this] and convert: same toast
- [ ] A dead fake in code — select `` `fake [^9]` `` whole with a word each side: it CONVERTS (masked fakes aren't footnotes)
- [ ] Select any text inside the fence below: same toast, nothing changes
- [ ] Select from the line ABOVE the fence to just its opening `` ``` `` line (cutting the block in half): same toast, nothing changes
- [ ] Select from the line above the fence through its closing `` ``` `` line (the whole block): it converts — the fence rides into the definition indented, and renders as code inside the footnote

```
select me in here
```

| Convert in me | Notes |
| ------------- | ----- |
| cell word target | click into the cell first |

- [ ] With cell editing active, select `target` and press the INLINE hotkey: it becomes `^[target]` inside the cell, pipes intact
- [ ] Undo, select `word` and press the NUMBERED hotkey: the cell gets `[^1]` and the prefilled definition lands below the table
- [ ] Switch to SOURCE mode. Select `word target` inside the cell and press the numbered hotkey: converts in place, pipes intact (text inside one cell is fine)
- [ ] Undo. Select from `target` through the pipe into `click` (two cells) and press any converting hotkey: the "cuts through a table" toast, nothing changes (ruling 2026-09-04: a cell, a few cells, or a row never become a footnote; only text inside one cell, or the whole table with the text around it, which is A13's fixture)
- [ ] Select the header row through the `| --- |` row and convert: same toast, nothing changes
- [ ] Select only whitespace anywhere: the press behaves like a plain insert at the caret
- [ ] With the caret in a footnote definition's body below, EVERY insert hotkey (numbered, named, inline, paste) jumps back to the reference instead of creating (ruling 2026-08-13)
- [ ] Selecting text inside the definition body and pressing a converting hotkey refuses with the "can't be nested inside other footnotes" toast (a selection can't jump)

Fixture for the definition checks[^d].

[^d]: press the inline hotkey with the caret right here
[^n]: nesting-refusal fixture definition
