# 12: a `# Footnotes` heading that already sits mid-note

Settings: `Enable section heading` ON, heading `# Footnotes`, all lint rules ON. Undo between checks. The heading below is the fixture: it sits in the MIDDLE of the note with prose after it, exactly as a user would have typed it (issue #55, fixed 2026-08-05).

Insert into this sentence for the insertion checks.

[^9]: nine

# Footnotes

[^1]: an existing definition under the user's own heading

Prose after the section, so the heading is not at the end of the note. A reference to the existing footnote[^1] keeps it alive, and a stray reference here[^9] has its definition above the heading.

- [ ] Inserting a footnote into the sentence at the top appends its definition under the heading above, below `[^1]:` and last in the section, with no duplicate `# Footnotes` at the end
- [ ] A blank line separates the new definition from the prose below it, so the prose does NOT render as part of the footnote (bug fixed 2026-07-20)
- [ ] Undo, then run **Lint footnotes**: the stray `[^9]: nine` definition above the heading (renumbered to `[^2]: nine` by reindex on the way) moves DOWN under the heading, below `[^1]:`; the section stays exactly where it is and nothing is dragged to the bottom of the note
- [ ] Linting again shows "No linting needed."
