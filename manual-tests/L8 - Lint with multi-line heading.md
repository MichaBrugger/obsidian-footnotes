# L8: lint with a multi-line divider heading

Settings: all rules ON, `Enable section heading` ON, heading set to the two lines `---` + `## Footnotes`.

This pins the 2026-07-17 bug where repeated linting re-added the heading each run.

Run **Lint footnotes** at least THREE times, compare with the fence, then undo.

body[^2] text[^1] end

[^1]: one
[^2]: two

Expected after the first lint, and UNCHANGED after every later one (exactly one divider + heading pair):

```
body[^1] text[^2] end

---
## Footnotes

[^1]: two
[^2]: one
```
