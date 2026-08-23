# L5: reindex with orphan deletion

Settings: reindex ON, `Delete orphaned definitions` ON (Orphans section; punctuation and move can stay ON). Also retry with reindex OFF: the orphans still delete (deletion is its own rule since 2026-08-10), only the renumbering stops.

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
