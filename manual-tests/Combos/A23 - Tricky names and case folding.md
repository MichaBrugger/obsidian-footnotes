# A23: tricky names, case folding, tricky prefixes (2026-08-10)

Settings: defaults; prefix items need `Per-note footnote prefix` ON.

Fixture: a backticked name [^ba`ck], a dollar name [^a$1], and case
pair case[^Note] with its lowercase definition below.

- [ ] Press inside the backticked reference: a toast says the name contains backticks and won't render; nothing is inserted
- [ ] Press inside `[^a$1]`: its definition is CREATED normally (dollar names are valid and render)
- [ ] Autonumber next to `pay[^a$1] and[^b$2]`: the span between the dollars is NOT math — both stay footnotes
- [ ] Press inside `[^Note]`: navigates to the LOWERCASE `[^note]:` definition (ids fold case; no duplicate)
- [ ] Prefix `P-` set, with `hand[^p-1] typed` in the note: autonumber mints `[^P-2]`, NOT a colliding `[^P-1]`
- [ ] `footnote-prefix: 2. # a comment` in frontmatter: inserts use `2.`, no phantom-value complaint (YAML comments stripped)
- [ ] `footnote-prefix:2.` (no space after the colon) is IGNORED — Obsidian shows no property, the plugin reads none

[^note]: lowercase definition for the uppercase reference
