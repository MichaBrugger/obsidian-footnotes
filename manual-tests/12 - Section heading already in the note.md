# 12: a `# Footnotes` heading that already sits mid-note

Settings: `Enable section heading` ON, heading `# Footnotes`, all lint
rules ON. Undo between checks. The heading below is the fixture: it
sits in the MIDDLE of the note with prose after it, exactly as a user
would have typed it (issue #55, fixed 2026-08-05).

Insert into this sentence for the insertion checks.

# Footnotes

[^1]: an existing definition under the user's own heading

Prose after the section, so the heading is not at the end of the note.
A reference to the existing footnote[^1] keeps it alive, and a stray
reference here[^9] has its definition at the very bottom.

- [ ] Inserting a footnote into the sentence at the top slots its definition under the heading above, no duplicate `# Footnotes` at the end
- [ ] A blank line separates the new definition from the prose below it, so the prose does NOT render as part of the footnote (bug fixed 2026-07-20)
- [ ] Undo, then run **Lint footnotes**: the stray `[^9]: nine` definition at the bottom moves UP under the mid-note heading; the section stays exactly where it is
- [ ] Nothing gets dragged to the bottom of the note, and linting again shows "No linting needed."

[^9]: nine
