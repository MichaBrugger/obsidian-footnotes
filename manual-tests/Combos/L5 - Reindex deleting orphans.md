# L5: reindex with orphan deletion

Settings: reindex ON, keep orphaned definitions OFF (punctuation and move can stay ON).

Run **Lint footnotes**, compare with the fence, then undo.

Text[^3] here.

[^3]: used
[^9]: numbered orphan
[^lost]: named orphan

Expected (both orphans deleted, the used one renumbered):

```
Text[^1] here.

[^1]: used
```
