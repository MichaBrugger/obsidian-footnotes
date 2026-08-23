# L17: lint stability paranoia (2026-08-10)

Settings: all rules ON; second item needs `Lint on save` ON.

Scratch-note fixture: put `[^t1]: def` as the FIRST line, `---` on the
line right below it, then a `text[^t1]` line, another `---`, and prose.

- [ ] Lint moves the definition down WITHOUT turning the top of the note into frontmatter (no swallowed prose; a blank line appears above the first `---`)
- [ ] With lint-on-save ON, saving twice in a row never rewrites the second time (no churn)
