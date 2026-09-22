# 16: footnote reference placement (2026-09-21)

Claude: automated coverage lives in test/footnote-placement.test.ts (the landing walk, the end-of-word hop, the selection grab, the lint rule and the saved-setting guard in all three placements) and the property suite draws all three; run `npm test` before this sheet. What is left needs the live app: the settings page, typing under an input method, and what Reading view shows.

Settings: defaults except where a check says otherwise. Undo between checks. Fixtures are in this note: an English sentence to cite, a Chinese one, and a quoted one.

## The settings page

- [ ] Settings > Footnote Shortcut: **Placement relative to punctuation**, in the Footnote reference placement section, is a dropdown with three choices (After punctuation, Before punctuation, Don't move), it shows After punctuation on a fresh install, and its description reads well and fits without cutting off on a phone-width window
- [ ] Settings search for "placement" finds it (Obsidian 1.13 settings search)

## Inserting under each placement

Put the caret inside the word "bravo" in each sentence below and press the numbered footnote hotkey, then undo.

- [ ] After punctuation: This is "some bravo". The reference lands after the closing quote AND the full stop
- [ ] Before punctuation: This is "some bravo". The reference lands after the closing quote and in front of the full stop
- [ ] Before punctuation, Chinese: 这是一个句子，引用来源。 with the caret in 来源: the reference lands in front of the 。 and Reading view shows the superscript before the full stop
- [ ] Before punctuation, quoted Chinese: 他说「引用来源。」 with the caret in 来源: the reference lands after the 」 (outside the quote, as every convention wants)
- [ ] Don't move: This is "some bravo". The reference lands after the closing quote and in front of the full stop, and running **Lint footnotes** afterwards moves nothing

## The lint rule under Before punctuation

Set the placement to Before punctuation, then run **Lint footnotes** on this note.

- [ ] The two references below move in front of their full stops, the quoted one stays outside its 」, and one undo brings all of them back

已有研究表明，该工艺可使能耗降低。[^gb] 他说「这是引文。」[^quote] An English sentence.[^en]

[^gb]: GB/T 7714-2015 puts the marker before the full stop in its worked examples
[^quote]: outside the closing bracket in every convention
[^en]: an English sentence in the same note moves too under a global setting; that is the known cost of not having a per-language table
