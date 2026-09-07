# A3: popup editor on vs off

Fixture reference to navigate from: jump me[^1] now.

[^1]: the definition to land on

With `Edit footnotes in a popup` ON:

- [ ] Inserting opens the popup at the caret; the caret never leaves the text
- [ ] Pressing the hotkey inside `[^1]` opens the popup on its definition
- [ ] Hotkey again / Escape / click outside closes it
- [ ] With the popup open, click into the NOTE's text and press Escape: the popup closes from there too (2026-09-04)
- [ ] With the popup open (focus inside it), press the Toggle reading view hotkey ONCE: the popup closes and the note switches to Reading view in that one press; toggle back, no popup left behind (2026-09-04)
- [ ] With the popup open, switch to Reading view with the pen icon instead: the popup closes (2026-09-04)

With `Edit footnotes in a popup` OFF:

- [ ] Inserting jumps the caret to the new definition at the bottom
- [ ] Pressing inside `[^1]` jumps to the definition, centered; pressing on the definition jumps back
