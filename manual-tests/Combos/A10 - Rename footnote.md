# A10: rename footnote command (issue #36)

Settings: defaults. Fixture: two footnotes[^alpha] and[^Beta] plus a fenced decoy.

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

[^alpha]: first definition
[^Beta]: second definition
