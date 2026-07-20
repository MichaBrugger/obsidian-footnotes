---
footnote-prefix: 2.
---

# L11: lint applies the note's footnote prefix

Settings: `Per-note footnote prefix` ON, `Apply the note's footnote prefix` ON (both default to that except the first), all lint rules ON.

This note has plain footnotes written "before" the prefix existed, plus one already-prefixed footnote.

Run **Lint footnotes** on the mess, compare with the fence, then undo.

b[^2] a[^1] pre[^2.5] end

[^1]: one
[^2]: two
[^2.5]: already prefixed

Expected (plain ones adopt the prefix, then the WHOLE namespace renumbers by reading order; prefixed footnotes are numbered footnotes, so `2.5` becomes `2.3`):

```
b[^2.1] a[^2.2] pre[^2.3] end

[^2.1]: two
[^2.2]: one
[^2.3]: already prefixed
```

- [ ] Running lint again shows "No linting needed." (idempotent)
- [ ] With `Apply the note's footnote prefix` OFF, plain footnotes reindex to `[^1]`/`[^2]` and the prefixed one still renumbers within its namespace
