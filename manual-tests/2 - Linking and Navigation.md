# Linking and navigation

> [!info] How to use
> Place the caret INSIDE a marker and press the footnote hotkey to jump to its detail; press again on the detail line to jump back to the first use of the marker. Test once with `Edit footnotes in a popup` off (classic jump) and once with it on (popup opens instead).

Jump from this numbered marker[^1] and from this repeated one[^1], jumping back from the detail always lands on the FIRST use. A multi-digit one[^12] works the same.

Named footnotes navigate too: a plain name[^plain], an uppercase name[^Chapter], and the hard cases, a colon in the name[^arXiv:2026.0717] and a dotted name[^named-footnote.1].

- [ ] Marker → detail jump lands CENTERED in the viewport, at the END of the detail text
- [ ] Detail → marker jump returns to the first use, centered
- [ ] The multi-line detail below lands the caret at the end of its LAST continuation line
- [ ] Colon and uppercase names open the popup bound to the right detail (popup on)
- [ ] With the caret just AFTER a marker's closing bracket, the hotkey inserts a new footnote instead of navigating

Filler so the jumps actually travel, scroll matters here.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.

Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.

[^1]: the first numbered detail
[^12]: multi-digit detail
[^plain]: a plainly named detail
[^Chapter]: uppercase names are stored lowercased internally, jumping and the popup must both still work
[^arXiv:2026.0717]: colons in names used to break jumping (issue #50)
[^named-footnote.1]: dots are fine in names
[^multiline]: this detail has continuation lines
    the caret should land at the end
    of this very last line, right here

A trailing marker so the multi-line detail has a use: jump from me[^multiline].
