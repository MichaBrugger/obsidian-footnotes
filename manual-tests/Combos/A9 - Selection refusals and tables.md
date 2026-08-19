# A9: selection conversion refusals, and tables (issue #35)

Settings: defaults.

- [ ] Select across BOTH of these two short lines and press the numbered hotkey: they convert into ONE definition, the second line indented four spaces under the label (multi-paragraph selections, 2026-08-19); undo restores both lines
- [ ] With Ctrl-click, make TWO separate selections and press the numbered hotkey: a toast asks for one continuous stretch, nothing changes
- [ ] Select `code words` inside the span on this line: `some code words here` — the cuts-through-protected-text toast appears, nothing changes
- [ ] Select any text inside the fence below: same toast, nothing changes
- [ ] Select from the line ABOVE the fence to just its opening ``` line (cutting the block in half): same toast, nothing changes
- [ ] Select from the line above the fence through its closing ``` (the whole block): it converts — the fence rides into the definition indented, and renders as code inside the footnote

```
select me in here
```

| Convert in me | Notes |
| ------------- | ----- |
| cell word target | click into the cell first |

- [ ] With cell editing active, select `target` and press the INLINE hotkey: it becomes `^[target]` inside the cell, pipes intact
- [ ] Undo, select `word` and press the NUMBERED hotkey: the cell gets `[^1]` and the prefilled definition lands below the table
- [ ] Select only whitespace anywhere: the press behaves like a plain insert at the caret
- [ ] With the caret in a footnote definition's body below, EVERY insert hotkey (numbered, named, inline, paste) jumps back to the reference instead of creating (ruling 2026-08-13)
- [ ] Selecting text inside the definition body and pressing a converting hotkey refuses with the "can't go inside another footnote's definition" toast (a selection can't jump)

Fixture for the definition checks[^d].

[^d]: press the inline hotkey with the caret right here
