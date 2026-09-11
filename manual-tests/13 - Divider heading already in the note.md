# 13: a divider + heading pair that already sits mid-note

Settings: `Enable section heading` ON, heading set to the two lines `---` + `## Footnotes`, all lint rules ON. Undo between checks. The pair below is the fixture: it sits in the MIDDLE of the note with prose after it, as a user would have typed it.

Insert into this sentence for the insertion checks.

[^9]: nine

---
## Footnotes

[^1]: an existing definition under the user's own pair

Prose after the section, so the pair is not at the end of the note. A reference to the existing footnote[^1] keeps it alive, and a stray reference here[^9] has its definition above the pair.

- [ ] Inserting a footnote into the sentence at the top appends its definition under the pair above, below `[^1]:` and last in the section, with no duplicate divider + heading at the end
- [ ] A blank line separates the new definition from the prose below it, so the prose does NOT render as part of the footnote
- [ ] Undo, then run **Lint footnotes**: the stray `[^9]: nine` definition above the pair (renumbered to `[^2]: nine` by reindex on the way) moves DOWN under the pair, below `[^1]:`; the section stays exactly where it is and nothing is dragged to the bottom of the note
- [ ] Linting again shows "No linting needed."
