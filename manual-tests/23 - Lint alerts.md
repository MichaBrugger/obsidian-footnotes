---
footnote-prefix: 3.
---
# 23: what the linter alerts about instead of fixing

Settings: all lint rules ON except `Reindex` OFF (the alerts speak about the post-lint text, and reindex would rename the numbered fixtures before they are named); the Orphans toggles and `Merge duplicate definitions` start OFF (alerts, not deletions; orphans are never silent, 2026-08-10). For the `[^3.]` placeholder check: `Per-note footnote prefix` ON (the frontmatter above carries `3.`) with the `Apply the note's footnote prefix` lint rule OFF, so nothing gets renamed. Undo between checks. Every fixture is already in this note, so ONE run of **Lint footnotes** raises every alert below at once.

Fixture: text[^used] here, a stray[^99] with no definition and five more strays[^o1] in[^o2] a[^o3] row[^o4] here[^o5], an empty [^] reference, an untouched prefix placeholder [^3.] in this sentence, hand-typed invalid names [^bad name] and [^c#d], a hashed name that does have a definition[^#jump], a nesting footnote[^nest], a footnote with a fenced code block in its body[^fence], and dup here[^dup].

x [^aa`a] [^bb#b] [^cc`c] y

A definition one blank line short, lima[^lz] here:
prose line
[^lz]: no blank line above me

## Orphans, strays, and empties

- [ ] An alert names the definitions nothing references (`lost`, `31`), and they stay in the note
- [ ] The missing-definition alert lists ALL SIX strays (`99`, `o1` to `o5`), no "...", and says to write their definitions or delete the references (2026-09-08)
- [ ] The empty `[^]` gets its own alert (it won't render); the bare prefix placeholder `[^3.]` counts as unfilled exactly like `[^]` (QOL 2026-08-07)
- [ ] `Delete orphaned references` ON + lint: every stray reference is removed from the text, spacing healed (2026-08-10)
- [ ] `Delete orphaned definitions` ON + lint: both orphan definitions are deleted (the reindex interplay is sheet 20's)

## A definition one blank line short (2026-09-09)

- [ ] The lazy-definition alert: "This note has a footnote definition that Obsidian reads as plain text because there is no blank line above it ("[^lz]:"). Add a blank line above it." (Reading view shows `[^lz]: no blank line above me` as plain text); `lz` is NOT in the missing-definition alert
- [ ] `Delete orphaned references` ON + lint: `lima[^lz]` keeps its reference (the fix is the blank line, not a deletion)

## Invalid names

- [ ] The invalid-name alert lists SIX names (`[^bad name]`, `[^c#d]`, `[^#jump]`, `[^aa`a]`, `[^bb#b]`, `[^cc`c]`) and ends with "Footnote names can't contain spaces, backticks, brackets, or "#"." (2026-09-08: backticks inside a reference are footnote-id text to Obsidian, not code openers, so the `x ... y` line is THREE names, not one merged span; a backticked name stays invalid)
- [ ] `[^#jump]` is counted even though it has a definition and renders in Reading view: Obsidian's own footnote hover and sidebar cannot find it (2026-09-08)

## Nesting

- [ ] An alert names `[^nest]` as the definition that cites another footnote inside its body and says nested footnotes don't survive export; the lint never rewrites or deletes the nested content itself (2026-08-24)

## Code inside a definition body

- [ ] `Delete orphaned references` ON + lint: the `[^99]` inside the `[^fence]:` body's code block is code and SURVIVES untouched (orphan deletion no longer eats reference-shaped text out of definition-body fences, 2026-08-25); the footnote renders its code block intact in Reading view

## Duplicate definitions (rule 2026-08-12)

Obsidian renders only the LAST definition of a duplicated footnote; earlier ones are dead text (verified live).

- [ ] Merge OFF: an alert says `[^dup]` is defined more than once and only the last renders; both stay
- [ ] `Merge duplicate definitions` ON, lint: the bodies merge into ONE definition, the second body as an indented continuation; Reading view shows both lines
- [ ] Lint again: nothing changes (idempotent)

## Every alert that lists footnotes

- [ ] Any alert that lists footnotes lists EVERY one, never an ellipsis (2026-09-08)

[^used]: referenced definition
[^lost]: named orphan, nothing uses it
[^31]: numbered orphan, also unused
[^#jump]: a hashed definition that renders but the popup can never open
[^nest]: a definition citing another[^used] footnote in its body
[^fence]: a definition with a code block
    ```js
    const ref = "[^99]";
    ```
[^dup]: body
[^dup]: another body

## Definitions inside a list item (ruling 1, 2026-09-20)

Settings: all lint rules ON. The fixture below defines two footnotes inside list items; Reading view renders both.

- [^la]: a definition written right after the list marker
- item three

    [^lb]: a definition indented to the item's margin (four spaces)

Uses: alpha[^la] and bravo[^lb].

- [ ] Lint footnotes: no alert names `[^la]` or `[^lb]` as a reference with no definition, and neither reference is deleted with orphan-reference deletion on
- [ ] After the lint, both names read exactly as before (reindex leaves a name defined inside an item alone, and hands its number to no other footnote)
