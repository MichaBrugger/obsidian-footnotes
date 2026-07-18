# L3: move to bottom only

Settings: punctuation OFF, move to bottom ON, reindex OFF.

Run **Lint footnotes**, compare with the fence, then undo.

Para one[^1].

[^1]: def

Para two tail.

Expected (definition relocates below the tail, nothing renumbers):

```
Para one[^1].

Para two tail.

[^1]: def
```
