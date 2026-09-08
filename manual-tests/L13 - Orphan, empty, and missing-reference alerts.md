---
footnote-prefix: 3.
---

# L13: orphans, empty references, missing definitions

Settings: all rules ON; the Orphans toggles start OFF (alerts, not
deletions — orphans are never silent, 2026-08-10). For the `[^3.]`
placeholder check: `Per-note footnote prefix` ON (the frontmatter above
carries `3.`) with the `Apply footnote prefix` lint rule OFF, so nothing
gets renamed.

Fixture: text[^used] here, a stray[^99] with no definition, an empty [^]
reference, an untouched prefix placeholder [^3.] in this sentence, and a
hand-typed invalid name [^bad name] that no rule will touch.

[^used]: referenced definition
[^lost]: named orphan, nothing uses it
[^31]: numbered orphan, also unused

- [ ] **Lint footnotes**: an alert names the definitions nothing references (`lost`, `31`), and they stay in the note
- [ ] The alert for `stray[^99]` says to write its definition or delete the reference
- [ ] The empty `[^]` gets its own alert (it won't render); the bare prefix placeholder `[^3.]` counts as unfilled exactly like `[^]` (QOL 2026-08-07)
- [ ] The invalid name gets its own alert: "This note has a footnote with an invalid name ("[^bad name]"). Footnote names can't contain spaces, backticks, brackets, or "#"." (2026-09-08; add a `[^c#d]` and the alert lists both)
- [ ] Paste `x [^aa`a] [^bb#b] [^cc`c] y` on its own line and lint: the invalid-name alert lists THREE names (`[^aa`a]`, `[^bb#b]`, `[^cc`c]`), not one merged span (2026-09-08: backticks inside a reference are footnote-id text to Obsidian, not code openers; a backticked name stays invalid)
- [ ] Add five stray references (`[^o1]` to `[^o5]`) with no definitions and lint: the missing-definition alert lists ALL five names, no "…" (2026-09-08)
- [ ] `Delete orphaned references` ON + lint: `stray[^99]` is removed from the text, spacing healed (2026-08-10)
- [ ] `Delete orphaned definitions` ON + lint: both orphan definitions are deleted (see L5 for the reindex interplay)
- [ ] Hand-type a reference INSIDE a definition body (e.g. `[^used]: referenced definition citing[^lost]`) and lint: an alert names the nesting definition and says nested footnotes don't survive export — the lint never rewrites or deletes the nested content itself (2026-08-24)
- [ ] Put a fenced code block INSIDE a definition's indented body (the label line, then a four-space-indented `` ```js `` opener, a code line containing `[^99]`, and a four-space-indented `` ``` `` closer), turn `Delete orphaned references` ON and lint: the fenced `[^99]` is code and SURVIVES untouched — orphan deletion no longer eats reference-shaped text out of definition-body fences (2026-08-25); the footnote renders its code block intact in Reading view
