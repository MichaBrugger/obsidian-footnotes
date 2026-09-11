# 11: the footnote section heading

Settings: `Enable section heading` ON, `Trim blank lines` ON, all lint rules ON. Run the single-line half with the heading set to `# Footnotes`, then the divider half with the two lines `---` + `## Footnotes`. Undo between checks. This note deliberately holds no footnote definitions at all: the plugin creates the heading only for a note that has none, so a fixture footnote would keep every check from firing. Sheets 12 and 13 hold the "heading already in the note" cases, and the linter's own heading creation on a note that has definitions but no heading is sheet 20's.

## Single-line heading `# Footnotes`

Insert into this sentence twice.

- [ ] The first footnote creates `# Footnotes` above its definition at the note's end, with a blank line separating the heading from the text above
- [ ] The second footnote appends below the first definition, no second heading
- [ ] With both footnotes still in place, run **Lint footnotes** twice: the first run changes nothing and the second says "No linting needed." (exactly one heading, ever; this pins the 2026-07-17 bug where every lint re-added the heading)
- [ ] Undo everything back to this fixture

## Divider heading `---` + `## Footnotes`

Switch the heading setting to the two lines and insert into this sentence twice.

- [ ] The first footnote creates a blank line, the divider, the heading, then the definition
- [ ] The second footnote appends below the first definition, no second divider or heading
- [ ] With both footnotes still in place, run **Lint footnotes** twice: the first run changes nothing and the second says "No linting needed."
- [ ] Undo everything and switch the heading setting back to `# Footnotes`
