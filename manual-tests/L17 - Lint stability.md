[^t1]: def
---
text[^t1]
---
prose after the second divider keeps the fixture honest.

# L17: lint stability paranoia (2026-08-10)

Settings: all rules ON; second item needs `Lint on save` ON.

The fixture IS this note's top: the definition sits on the very first
line with a `---` right below it — the exact shape that used to tempt
the lint into minting frontmatter. Nothing to build by hand.

- [ ] Lint moves the definition down WITHOUT turning the top of the note into frontmatter (no swallowed prose; a blank line appears above the first `---`)
- [ ] With lint-on-save ON, saving twice in a row never rewrites the second time (no churn)
