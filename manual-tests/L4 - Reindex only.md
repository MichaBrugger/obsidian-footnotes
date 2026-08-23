# L4: reindex only

Settings: punctuation OFF, move to bottom OFF, reindex ON, keep orphans ON, renumber named OFF.

Run **Lint footnotes**, compare with the fence, then undo.

b[^2] a[^1], end

[^1]: one
[^2]: two

Expected (numbers and definition order flip, the comma stays put):

```
b[^1] a[^2], end

[^1]: two
[^2]: one
```
