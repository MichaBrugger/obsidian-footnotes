---
footnote-prefix: 2=
---
# 15: the linter under a footnote prefix

Settings: `Per-note footnote prefix` ON, the `Apply the note's footnote prefix` lint rule ON (both default to that except the first), all other lint rules ON. `Renumber named footnotes` stays OFF. Every fixture is already in this note: plain footnotes written "before" the prefix existed, one already-prefixed footnote, and one named footnote.

Run **Lint footnotes** on the mess, compare with the fence, then undo. The fence shows the shape; the definitions land at the very bottom of this note, below the checklist.

b[^2] a[^1] pre[^2=5] n[^note] end

[^1]: one
[^2]: two
[^2=5]: already prefixed
[^note]: named

Expected (plain ones adopt the prefix and named ones keep their name behind it, bug fixed 2026-07-20, then the WHOLE namespace renumbers by reading order; prefixed footnotes are numbered footnotes, so `2=5` becomes `2=3`):

```
b[^2=1] a[^2=2] pre[^2=3] n[^2=note] end

[^2=1]: two
[^2=2]: one
[^2=3]: already prefixed
[^2=note]: named
```

- [ ] The fence matches
- [ ] Running lint again shows "No linting needed." (idempotent)
- [ ] With `Apply the note's footnote prefix` OFF, plain footnotes reindex to `[^1]`/`[^2]` while the prefixed one and `[^note]` BOTH keep their ids (prefixed footnotes are treated as named while the rule is off, QOL 2026-08-08); turn it back ON afterwards
- [ ] The settings page greys `Apply the note's footnote prefix` out while the prefix feature itself is off (main tab)
