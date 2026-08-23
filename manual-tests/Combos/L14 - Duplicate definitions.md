# L14: duplicate definitions (rule 2026-08-12)

Settings: all rules ON, `Merge duplicate definitions` OFF to start.
Obsidian renders only the LAST definition of a duplicated footnote;
earlier ones are dead text (verified live).

dup here[^dup].

[^dup]: body
[^dup]: another body

- [ ] Lint with merge OFF: an alert says `[^dup]` is defined more than once and only the last renders; both stay
- [ ] `Merge duplicate definitions` ON, lint: the bodies merge into ONE definition, the second body as an indented continuation; Reading view shows both lines
- [ ] Lint again: nothing changes (idempotent)
- [ ] Before merging (undo to the duplicate state): the hotkey on `[^dup]` jumps to the LAST definition — the one Obsidian renders
