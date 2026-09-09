# 01: numbered footnotes

Settings: defaults, popup OFF (the popup is sheet 04). Undo (Ctrl+Z)
between checks. Every fixture is already in this note.

## Insertion basics

Insert into this sentence for the first two checks. The third uses the
existing reference here[^1] and its definition at the bottom.

- [ ] The first footnote inserted lands its definition at the very bottom of the note, right below the existing `[^1]:` line
- [ ] A second insertion numbers sequentially and appends its definition right below the first
- [ ] With the caret immediately AFTER the existing `[^1]`'s closing `]`, the hotkey inserts a consecutive new footnote instead of navigating

## Insert at end of word ON (the default)

Fixture: Alpha bravo charlie, end of clause, then more words. 另一句中文。

- [ ] Numbered hotkey mid-"bravo": the reference lands after "bravo"
- [ ] Caret mid-"clause" (just before the comma): the reference lands AFTER the comma
- [ ] Caret mid-word in `中文。`: the reference lands AFTER the fullwidth stop (CJK punctuation counts, 2026-08-10)
- [ ] The named and inline hotkeys respect the same end-of-word rule

## Insert at end of word OFF

Turn `Insert footnote at end of word` OFF and reuse the fixture line:

- [ ] Numbered hotkey mid-"bravo": the reference lands exactly at the caret, mid-word
- [ ] Same for the named and inline hotkeys

[^1]: the existing definition
