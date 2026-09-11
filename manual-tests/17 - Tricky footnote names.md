# 17: tricky footnote names (2026-08-10)

Settings: defaults; the popup check needs `Edit footnotes in a popup` ON. Undo between checks. Every fixture is already in this note.

Fixture: a backticked name [^ba`ck], dollar names pay[^a$1] and[^b$2] now, a case pair case[^Note] with its lowercase definition below, a hashed reference[^#y] with no definition, a hashed reference with a definition[^#x], and a CJK name[^注].

- [ ] Press inside the backticked reference: the toast ""[^ba`ck]" won't work as a footnote. Footnote names can't contain spaces, backticks, brackets, or "#"." and nothing is inserted (a backtick inside a reference is id text to Obsidian, not a code opener, 2026-09-08; a backticked name is still invalid)
- [ ] Press inside `[^a$1]`: its definition is CREATED normally (dollar names are valid and render)
- [ ] Numbered hotkey right after `and[^b$2]`: the span between the dollars is NOT math; both dollar names stay footnotes
- [ ] Press inside `[^Note]`: navigates to the LOWERCASE `[^note]:` definition (ids fold case; no duplicate)
- [ ] Names with `#` are refused everywhere (2026-09-05; they render in Reading view, but Obsidian's footnote hover and sidebar say "Footnote not found"): the named press inside `[^#y]` toasts the same won't-work-as-a-footnote warning and creates nothing; the name modal (sheet 06) and the Rename modal (sheet 10) refuse `a#b` inline
- [ ] Popup ON: the hotkey inside `[^#x]` JUMPS to its definition at once, no popup and no "Waiting for Obsidian to index the new footnote" notice (the popup can't bind ids containing `#`)
- [ ] Press inside `[^注]`: navigates to its definition (Obsidian accepts it, so the plugin does too; the colon and dotted names are sheet 05's)

[^note]: lowercase definition for the uppercase reference
[^#x]: a hashed definition the popup can never open
[^注]: a CJK name
