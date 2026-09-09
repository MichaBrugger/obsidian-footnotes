---
footnote-prefix: 3.
---

# 23: what the linter alerts about instead of fixing

Settings: all lint rules ON; the Orphans toggles and `Merge duplicate
definitions` start OFF (alerts, not deletions; orphans are never
silent, 2026-08-10). For the `[^3.]` placeholder check: `Per-note
footnote prefix` ON (the frontmatter above carries `3.`) with the
`Apply footnote prefix` lint rule OFF, so nothing gets renamed. Undo
between checks. Every fixture is already in this note, so ONE run of
**Lint footnotes** raises every alert below at once.

Fixture: text[^used] here, a stray[^99] with no definition and five
more strays[^o1] in[^o2] a[^o3] row[^o4] here[^o5], an empty [^]
reference, an untouched prefix placeholder [^3.] in this sentence,
hand-typed invalid names [^bad name] and [^c#d], a nesting
footnote[^nest], a footnote with a fenced code block in its
body[^fence], and dup here[^dup].

x [^aa`a] [^bb#b] [^cc`c] y

## Orphans, strays, and empties

- [ ] An alert names the definitions nothing references (`lost`, `31`), and they stay in the note
- [ ] The missing-definition alert lists ALL SIX strays (`99`, `o1` to `o5`), no "...", and says to write their definitions or delete the references (2026-09-08)
- [ ] The empty `[^]` gets its own alert (it won't render); the bare prefix placeholder `[^3.]` counts as unfilled exactly like `[^]` (QOL 2026-08-07)
- [ ] `Delete orphaned references` ON + lint: every stray reference is removed from the text, spacing healed (2026-08-10)
- [ ] `Delete orphaned definitions` ON + lint: both orphan definitions are deleted (the reindex interplay is sheet 20's)

## Invalid names

- [ ] The invalid-name alert lists FIVE names (`[^bad name]`, `[^c#d]`, `[^aa`a]`, `[^bb#b]`, `[^cc`c]`) and ends with "Footnote names can't contain spaces, backticks, brackets, or "#"." (2026-09-08: backticks inside a reference are footnote-id text to Obsidian, not code openers, so the `x ... y` line is THREE names, not one merged span; a backticked name stays invalid)

## Nesting

- [ ] An alert names `[^nest]` as the definition that cites another footnote inside its body and says nested footnotes don't survive export; the lint never rewrites or deletes the nested content itself (2026-08-24)

## Code inside a definition body

- [ ] `Delete orphaned references` ON + lint: the `[^99]` inside the `[^fence]:` body's code block is code and SURVIVES untouched (orphan deletion no longer eats reference-shaped text out of definition-body fences, 2026-08-25); the footnote renders its code block intact in Reading view

## Duplicate definitions (rule 2026-08-12)

Obsidian renders only the LAST definition of a duplicated footnote;
earlier ones are dead text (verified live).

- [ ] Merge OFF: an alert says `[^dup]` is defined more than once and only the last renders; both stay
- [ ] `Merge duplicate definitions` ON, lint: the bodies merge into ONE definition, the second body as an indented continuation; Reading view shows both lines
- [ ] Lint again: nothing changes (idempotent)

[^used]: referenced definition
[^lost]: named orphan, nothing uses it
[^31]: numbered orphan, also unused
[^nest]: a definition citing another[^used] footnote in its body
[^fence]: a definition with a code block
    ```js
    const ref = "[^99]";
    ```
[^dup]: body
[^dup]: another body
