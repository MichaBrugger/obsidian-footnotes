---
footnote-prefix: 2.
---

# L11: lint applies the note's footnote prefix

Settings: `Per-note footnote prefix` ON, `Apply the note's footnote prefix` ON (both default to that except the first), all lint rules ON.

This note has plain footnotes written "before" the prefix existed, one already-prefixed footnote, and one named footnote.

Run **Lint footnotes** on the mess, compare with the fence, then undo.

b[^2] a[^1] pre[^2.5] n[^note] end

[^1]: one
[^2]: two
[^2.5]: already prefixed
[^note]: named

Expected (plain ones adopt the prefix and named ones keep their name behind it — bug fixed 2026-07-20 — then the WHOLE namespace renumbers by reading order; prefixed footnotes are numbered footnotes, so `2.5` becomes `2.3`):

```
b[^2.1] a[^2.2] pre[^2.3] n[^2.note] end

[^2.1]: two
[^2.2]: one
[^2.3]: already prefixed
[^2.note]: named
```

- [ ] Running lint again shows "No linting needed." (idempotent)
- [ ] With `Apply the note's footnote prefix` OFF, plain footnotes reindex to `[^1]`/`[^2]`, the prefixed one still renumbers within its namespace, and `[^note]` keeps its name
