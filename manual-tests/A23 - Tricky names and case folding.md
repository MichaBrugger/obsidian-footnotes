---
footnote-prefix: P-
---

# A23: tricky names, case folding, tricky prefixes (2026-08-10)

Settings: defaults; prefix items need `Per-note footnote prefix` ON (the
frontmatter above already carries `P-`, inert until then).

Fixture: a backticked name [^ba`ck], dollar names pay[^a$1] and[^b$2] now,
a case pair case[^Note] with its lowercase definition below, and a
hand[^p-1] typed lowercase-prefixed reference for the collision check.

- [ ] Press inside the backticked reference: the won't-work-as-a-footnote toast names `[^ba`ck]` and the characters a name can't contain; nothing is inserted
- [ ] Press inside `[^a$1]`: its definition is CREATED normally (dollar names are valid and render)
- [ ] Autonumber right after `and[^b$2]`: the span between the dollars is NOT math — both dollar names stay footnotes
- [ ] Press inside `[^Note]`: navigates to the LOWERCASE `[^note]:` definition (ids fold case; no duplicate)
- [ ] Prefix feature ON (prefix `P-` from the frontmatter), with the fixture's `hand[^p-1] typed`: autonumber mints `[^P-2]`, NOT a colliding `[^P-1]`
- [ ] Change the property to `footnote-prefix: 2. # a comment` by hand: the ordinary invalid-prefix toast (the whole text after the colon is the value; YAML comments aren't honored, ruling 2026-09-05)
- [ ] Change it to `footnote-prefix: #chapter-` by hand: the invalid-prefix toast names `"#"` as the problem; nothing is minted (it used to mint `[^#chapter-1]`, an id the popup can never open; ruling 2026-09-05)
- [ ] Names with `#` are refused everywhere (2026-09-05; they render in Reading view, but Obsidian's footnote hover and sidebar say "Footnote not found"): the named modal and the Rename footnote modal refuse `a#b` inline with the ordinary "can't contain spaces, backticks, brackets, or "#"" reason; the named two-step press inside a hand-typed `[^#y]` with no definition toasts the ordinary won't-work-as-a-footnote warning and creates nothing
- [ ] Popup ON, with a hand-typed `hand[^#x]` reference and its `[^#x]:` definition: the hotkey inside it JUMPS to the definition at once, no "Waiting for Obsidian to index" notice (the popup can't bind ids containing `#`)
- [ ] Change it to `footnote-prefix:2.` (no space after the colon) by hand: it is IGNORED — Obsidian shows no property, the plugin reads none

[^note]: lowercase definition for the uppercase reference
