# L13: orphans, empty references, missing definitions

Settings: all rules ON; the Orphans toggles start OFF (alerts, not
deletions — orphans are never silent, 2026-08-10).

Fixture: text[^used] here, a stray[^99] with no definition, an empty [^]
reference, and an untouched prefix placeholder [^3.] in this sentence.

[^used]: referenced definition
[^lost]: named orphan, nothing uses it
[^31]: numbered orphan, also unused

- [ ] **Lint footnotes**: an alert names the definitions nothing references (`lost`, `31`), and they stay in the note
- [ ] The alert for `stray[^99]` says to write its definition or delete the reference
- [ ] The empty `[^]` gets its own alert (it won't render); the bare prefix placeholder `[^3.]` counts as unfilled exactly like `[^]` (QOL 2026-08-07)
- [ ] `Delete orphaned references` ON + lint: `stray[^99]` is removed from the text, spacing healed (2026-08-10)
- [ ] `Delete orphaned definitions` ON + lint: both orphan definitions are deleted (see L5 for the reindex interplay)
