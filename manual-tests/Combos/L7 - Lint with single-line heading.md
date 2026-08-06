# L7: lint with a single-line section heading

Settings: all rules ON, `Enable section heading` ON, heading set to `# Footnotes`.

Run **Lint footnotes** TWICE, compare with the fence, then undo.

body[^2] text[^1] end

[^1]: one
[^2]: two

Expected after the first lint, and UNCHANGED after the second (exactly one heading, ever; a blank line always separates the heading from the text above):

```
body[^1] text[^2] end

# Footnotes

[^1]: two
[^2]: one
```

## The existing heading anchors the section (issue #55, fixed 2026-08-05)

Undo, then move the whole `# Footnotes` section (heading + definitions) to the MIDDLE of the note with prose after it, and add one stray `[^9]: nine` definition (plus a `[^9]` marker) at the very end. Run **Lint footnotes**:

- [ ] The stray definition moves UP under the mid-note heading; the section stays exactly where you put it
- [ ] Nothing gets dragged to the bottom of the note, and linting again shows "No linting needed."
