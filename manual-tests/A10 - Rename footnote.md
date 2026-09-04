---
footnote-prefix: p.
---

# A10: rename footnote command (issue #36)

Settings: defaults (the frontmatter prefix stays inert until the last
check turns the prefix feature on). Fixture: two footnotes[^alpha]
and[^Beta], a prefixed one[^p.1], plus a fenced decoy.

```
fake [^alpha] inside code
```

Run **Rename footnote** from the command palette with the caret in each spot:

- [ ] Caret inside `[^alpha]` above: modal opens prefilled with `alpha`; rename to `gamma` renames the reference AND the definition, and the toast counts the places
- [ ] The fenced `[^alpha]` decoy above is untouched
- [ ] One undo reverts the whole rename at once
- [ ] Caret on the `[^Beta]:` definition label below also opens the modal
- [ ] Renaming `alpha` to `Beta`: the modal stays open and explains the collision
- [ ] Renaming `Beta` to `beta` (case only) works — same footnote to Obsidian
- [ ] A name with a space keeps the modal open with the reason
- [ ] Caret on plain prose: a toast asks for a reference or definition, no modal
- [ ] In Reading view the command is absent from the palette
- [ ] With the popup open on a footnote, running the rename first settles/closes the popup (no stranded popup bound to the old name)
- [ ] With `Per-note footnote prefix` AND the `Apply footnote prefix` lint rule ON (this note's prefix is already `p.`), Rename on the fixture's `[^p.1]` opens with only the `1` selected (the prefix visibly stays); type `5`, Enter: it becomes `[^p.5]`. Undo, rename again, delete the prefix too and type a bare `5`: the rename ADDS the prefix itself (`[^p.5]`) and the toast says the note's prefix was added, so no later lint ever renames it behind your back (2026-08-29, replacing the 2026-08-25 refusal). With the `Apply footnote prefix` rule OFF, the same bare rename stays bare and survives a lint

[^alpha]: first definition
[^Beta]: second definition
[^p.1]: prefixed fixture definition
