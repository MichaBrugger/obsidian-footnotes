# 05: navigation

Settings: run once with `Edit footnotes in a popup` OFF (the classic
jump) and once ON (the popup opens instead). Every fixture is already
in this note.

Jump from this numbered reference[^1] and from this repeated one[^1];
jumping back from the definition lands on the FIRST use. Multi-digit[^12]
works; so do a plain name[^plain], an uppercase name[^Chapter], a colon
name[^arXiv:2026.0717], and a dotted name[^named-footnote.1].

- [ ] Popup OFF: inserting a footnote into this sentence jumps the caret to the new definition at the bottom
- [ ] Reference to definition jump lands CENTERED, at the END of the definition text
- [ ] Definition to reference jump returns to the FIRST use, centered
- [ ] The multi-line definition below lands the caret at the end of its LAST continuation line
- [ ] Colon and uppercase names navigate to the right definition (popup ON: the popup is bound to it)
- [ ] Callout: a press inside `[^cq]` below navigates to the definition INSIDE the callout, no duplicate minted at the bottom (2026-08-10); pressing on the callout's `[^cq]:` line jumps back

> [!note] A callout
> body[^cq] here
>
> [^cq]: callout definition

## Orphan definitions (QOL 2026-08-07)

Caret on the orphan definition at the very bottom, press any footnote hotkey:

- [ ] "Nothing references this footnote" toast, caret stays, NOTHING inserted
- [ ] Same on its indented continuation line

## Duplicate definitions

Obsidian renders only the LAST definition of a duplicated footnote (verified live 2026-08-12).

- [ ] The hotkey on this reference dup here[^dup] jumps to the LAST `[^dup]:` definition, the one that renders
- [ ] With `Edit footnotes in a popup` ON, the same press still JUMPS to the last definition instead of opening the popup (2026-09-09: Obsidian's own lookup hands the popup the FIRST definition, so a duplicated footnote skips the popup); turn the popup back OFF

Filler so the jumps travel; scroll matters here.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

[^1]: the first numbered definition
[^12]: multi-digit definition
[^plain]: a plainly named definition
[^Chapter]: uppercase names are stored lowercased internally; jumping and the popup both still work
[^arXiv:2026.0717]: colons in names used to break jumping (issue #50)
[^named-footnote.1]: dots are fine in names
[^multiline]: this definition has continuation lines
    the caret should land at the end
    of this very last line, right here
[^dup]: body
[^dup]: another body

A trailing use so the multi-line definition jumps: from me[^multiline].

[^orphan]: no reference anywhere uses this definition, on purpose
    its continuation line behaves the same way
