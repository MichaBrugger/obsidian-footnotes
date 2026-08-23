# L6: reindex renumbering named footnotes

Settings: reindex ON, renumber named footnotes ON (keep orphans ON).

Run **Lint footnotes**, compare with the fence, then undo.

a[^note] b[^5] end

[^5]: five
[^note]: the named one

Expected (the named footnote becomes a number by appearance order):

```
a[^1] b[^2] end

[^1]: the named one
[^2]: five
```
