# L1: all lint rules on (defaults)

Settings: punctuation ON, move to bottom ON, reindex ON, keep orphans ON, renumber named OFF.

Run **Lint footnotes** on the mess, compare with the fence, then undo.

Beta[^2] alpha[^1], end.

[^1]: one
[^2]: two

Expected:

```
Beta[^1] alpha,[^2] end.

[^1]: two
[^2]: one
```
