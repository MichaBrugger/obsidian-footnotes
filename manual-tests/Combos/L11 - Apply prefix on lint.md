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

Expected (plain ones reindex to reading order, then take the prefix CONTINUING after `2.5`; the prefixed one is untouched):

```
b[^2.6] a[^2.7] pre[^2.5] end

[^2.6]: two
[^2.7]: one
[^2.5]: already prefixed
```

- [ ] Running lint again shows "No linting needed." (idempotent)
- [ ] With `Apply the note's footnote prefix` OFF, plain footnotes only reindex to `[^1]`/`[^2]` and keep no prefix
