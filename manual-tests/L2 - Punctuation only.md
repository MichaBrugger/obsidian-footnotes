# L2: punctuation only

Settings: punctuation ON, move to bottom OFF, reindex OFF.

Run **Lint footnotes**, compare with the fence, then undo.

Beta[^2] alpha[^1], end.

[^1]: one
[^2]: two

Expected (numbers and order untouched, only the comma hop):

```
Beta[^2] alpha,[^1] end.

[^1]: one
[^2]: two
```
