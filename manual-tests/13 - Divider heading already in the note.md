# 13: a divider + heading pair that already sits mid-note

Settings: `Enable section heading` ON, heading set to the two lines
`---` + `## Footnotes`, all lint rules ON. Undo between checks. The pair
below is the fixture: it sits in the MIDDLE of the note with prose
after it, as a user would have typed it.

Insert into this sentence for the insertion checks.

---
## Footnotes

[^1]: an existing definition under the user's own pair

Prose after the section, so the pair is not at the end of the note. A
reference to the existing footnote[^1] keeps it alive, and a stray
reference here[^9] has its definition at the very bottom.

- [ ] Inserting a footnote into the sentence at the top slots its definition under the pair above, no duplicate divider + heading at the end
- [ ] A blank line separates the new definition from the prose below it
- [ ] Undo, then run **Lint footnotes**: the stray `[^9]: nine` definition moves UP under the mid-note pair; linting again shows "No linting needed."

[^9]: nine
