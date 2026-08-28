---
footnote-prefix: P-
---

# A23: tricky names, case folding, tricky prefixes (2026-08-10)

Settings: defaults; prefix items need `Per-note footnote prefix` ON (the
frontmatter above already carries `P-`, inert until then).

Fixture: a backticked name [^ba`ck], dollar names pay[^a$1] and[^b$2] now,
a case pair case[^Note] with its lowercase definition below, and a
hand[^p-1] typed lowercase-prefixed reference for the collision check.

- [ ] Press inside the backticked reference: a toast says the name contains backticks and won't render; nothing is inserted
- [ ] Press inside `[^a$1]`: its definition is CREATED normally (dollar names are valid and render)
- [ ] Autonumber right after `and[^b$2]`: the span between the dollars is NOT math — both dollar names stay footnotes
- [ ] Press inside `[^Note]`: navigates to the LOWERCASE `[^note]:` definition (ids fold case; no duplicate)
- [ ] Prefix feature ON (prefix `P-` from the frontmatter), with the fixture's `hand[^p-1] typed`: autonumber mints `[^P-2]`, NOT a colliding `[^P-1]`
- [ ] Change the property to `footnote-prefix: 2. # a comment` by hand: inserts use `2.`, no phantom-value complaint (YAML comments stripped)
- [ ] Change it to `footnote-prefix:2.` (no space after the colon) by hand: it is IGNORED — Obsidian shows no property, the plugin reads none

[^note]: lowercase definition for the uppercase reference
