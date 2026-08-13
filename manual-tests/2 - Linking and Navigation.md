# Linking and navigation

> [!info] How to use
> Place the caret INSIDE a reference and press the footnote hotkey to jump to its definition; press again on the definition line to jump back to the first use of the reference. Test once with `Edit footnotes in a popup` off (classic jump) and once with it on (popup opens instead).

Jump from this numbered reference[^1] and from this repeated one[^1], jumping back from the definition always lands on the FIRST use. A multi-digit one[^12] works the same.

Named footnotes navigate too: a plain name[^plain], an uppercase name[^Chapter], and the hard cases, a colon in the name[^arXiv:2026.0717] and a dotted name[^named-footnote.1].

- [ ] Reference → definition jump lands CENTERED in the viewport, at the END of the definition text
- [ ] Definition → reference jump returns to the first use, centered
- [ ] The multi-line definition below lands the caret at the end of its LAST continuation line
- [ ] Colon and uppercase names open the popup bound to the right definition (popup on)
- [ ] With the caret just AFTER a reference's closing bracket, the hotkey inserts a new footnote instead of navigating

## Orphaned definition (QOL 2026-08-07)

The definition at the very bottom of this note has NO reference anywhere. Put the caret on it and press a footnote hotkey:

- [ ] A "Nothing references this footnote" toast appears, the caret stays put, and NOTHING is inserted (it used to insert a brand-new footnote right into the definitions)
- [ ] The same happens with the caret on its indented continuation line

## Rename footnote (issue #36, 2026-08-12)

Run **Rename footnote** from the command palette (bind a hotkey if you like) with the caret in each spot:

- [ ] Caret inside `[^plain]` anywhere in this note → modal opens prefilled with `plain`; rename it to `renamed` → every `[^plain]` reference AND the `[^plain]:` definition update in one step, and the toast counts the places
- [ ] One Ctrl+Z undoes the whole rename at once
- [ ] Caret on the DEFINITION label line (`[^renamed]: …`) also opens the modal for that name
- [ ] Renaming to a name already in use (try `Chapter`) keeps the modal open and explains the collision
- [ ] Renaming `[^Chapter]` to `chapter` (case only) works — it's the same footnote to Obsidian
- [ ] A name with a space keeps the modal open with the reason
- [ ] A reference-shaped `[^…]` inside a code block is NOT renamed along with the live ones (add one to a fence and check)
- [ ] Caret on plain prose → toast asks for a reference or definition, no modal
- [ ] In Reading view the command is absent from the palette
- [ ] With the popup open on a footnote, running the rename first settles/closes the popup (no stranded popup bound to the old name)

Filler so the jumps actually travel, scroll matters here.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.

Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.

[^1]: the first numbered definition
[^12]: multi-digit definition
[^plain]: a plainly named definition
[^Chapter]: uppercase names are stored lowercased internally, jumping and the popup must both still work
[^arXiv:2026.0717]: colons in names used to break jumping (issue #50)
[^named-footnote.1]: dots are fine in names
[^multiline]: this definition has continuation lines
    the caret should land at the end
    of this very last line, right here

A trailing reference so the multi-line definition has a use: jump from me[^multiline].

[^orphan]: no reference anywhere uses this definition, on purpose
    its continuation line behaves the same way
