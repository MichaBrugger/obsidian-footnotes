---
footnote-prefix: p.
---

# 10: rename footnote (2026-08-12)

Settings: defaults (the frontmatter prefix stays inert until the last
check turns the prefix feature on). Undo between checks. Every fixture
is already in this note: two footnotes[^alpha] and[^Beta], a prefixed
one[^p.1], a right-click fixture here[^menu], plus a fenced decoy.

```
fake [^alpha] inside code, decoy [^menu] too
```

## The command

Run **Rename footnote** from the command palette with the caret in each spot:

- [ ] Caret inside `[^alpha]` above: the modal opens prefilled with `alpha`; rename to `gamma` renames the reference AND the definition, and the toast counts the places
- [ ] The fenced `[^alpha]` decoy is untouched
- [ ] One undo reverts the whole rename at once
- [ ] Caret on the `[^Beta]:` definition label at the bottom also opens the modal
- [ ] Renaming `alpha` to `Beta`: the modal stays open and explains the collision
- [ ] Renaming `Beta` to `beta` (case only) works; same footnote to Obsidian
- [ ] A name with a space, `a#b`, or `a[b` keeps the modal open with the reason
- [ ] Caret on plain prose: a toast asks for a reference or definition, no modal
- [ ] In Reading view the command is absent from the palette
- [ ] With the popup open on a footnote, running the rename first settles/closes the popup (no stranded popup bound to the old name)
- [ ] With `Per-note footnote prefix` AND the `Apply footnote prefix` lint rule ON (this note's prefix is `p.`), Rename on `[^p.1]` opens with only the `1` selected (the prefix visibly stays); type `5`, Enter: it becomes `[^p.5]`. Undo, rename again, delete the prefix too and type a bare `5`: the rename ADDS the prefix itself (`[^p.5]`) and the toast says the note's prefix was added, so no later lint renames it behind your back (2026-08-29). With the `Apply footnote prefix` rule OFF, the same bare rename stays bare and survives a lint

## The right-click menu (2026-08-13)

- [ ] Right-click ON `[^menu]` above: the menu shows **Rename footnote** with the pencil icon (like the native heading rename)
- [ ] Choosing it opens the same modal as the command, prefilled with `menu`
- [ ] Right-click on the `[^menu]:` definition label below: the item is there too
- [ ] Right-click on plain prose in this line: no **Rename footnote** in the menu
- [ ] Right-click on the fenced decoy above: no item (code is not a footnote)

(The long-press twin on the phone is sheet 24's.)

[^alpha]: first definition
[^Beta]: second definition
[^p.1]: prefixed fixture definition
[^menu]: the definition to rename
