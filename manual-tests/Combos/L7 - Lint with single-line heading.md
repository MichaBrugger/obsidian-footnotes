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
