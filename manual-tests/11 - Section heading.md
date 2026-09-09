# 11: the footnote section heading

Settings: `Enable section heading` ON, `Trim blank lines` ON, all lint
rules ON. Run the single-line half with the heading set to
`# Footnotes`, then the divider half with the two lines `---` +
`## Footnotes`. Undo between checks. Every fixture is already in this
note; the "heading already in the note" cases are sheets 12 and 13.

## Single-line heading `# Footnotes`

Insert into this sentence twice.

- [ ] The first footnote creates `# Footnotes` above its definition at the note's end, with a blank line separating the heading from the text above
- [ ] The second footnote appends below the first definition, no second heading

Then undo both and run **Lint footnotes** TWICE on the fixture below:

body[^2] text[^1] end

[^1]: one
[^2]: two

Expected after the first lint, and UNCHANGED after the second (exactly one heading, ever):

```
body[^1] text[^2] end

# Footnotes

[^1]: two
[^2]: one
```

- [ ] The second lint shows "No linting needed."

## Divider heading `---` + `## Footnotes`

Undo everything, switch the heading setting to the two lines, and insert into this sentence twice.

- [ ] The first footnote creates a blank line, the divider, the heading, then the definition
- [ ] The second footnote appends below the first definition, no second divider or heading

Then undo both and run **Lint footnotes** at least THREE times on the same fixture (this pins the 2026-07-17 bug where every lint re-added the heading):

```
body[^1] text[^2] end

---
## Footnotes

[^1]: two
[^2]: one
```

- [ ] Every lint after the first leaves the note unchanged (exactly one divider + heading pair)
