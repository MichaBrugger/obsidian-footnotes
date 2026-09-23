# 19: the September 2026 feature round in one sitting (2026-09-22)

Claude: one pass over everything built 2026-09-21 and 22, for Jason to run before the beta. It gathers the human checks of sheets 15 (delete), 16 (placement), 17 (conversions) and 18 (copy and paste), adds the inline-footnote lint change and the icons, and orders them so settings change as few times as possible. Run `npm test` first; 2907 tests pass with 31 expected failures as of the last commit. Every fixture is in this note or in the companion note **19b - Paste target**. Undo (Ctrl+Z) between checks unless a check says otherwise.

Settings to start: defaults. **Placement relative to punctuation** = After punctuation, **Carry footnote definitions on copy, cut, and paste** on, **Preferred footnote naming style** = Keep as written, **Lint on footnote creation** off.

## 1. Delete footnote everywhere

Fixtures: a footnote used twice[^twice] and again[^twice], a right-click one[^menu], a chained one[^chain] whose definition cites another, and one inside a list item below.

- item with a footnote[^item]
- [^item]: defined inside the list item

- [ ] Caret inside the FIRST `[^twice]`, run **Delete footnote everywhere** from the palette: both references and the definition go, the toast reads well ("2 references and 1 definition")
- [ ] One undo brings both references and the definition back together, caret where it was
- [ ] Caret inside the `[^twice]:` label at the bottom: the same deletion from the definition's end
- [ ] Caret inside `[^chain]`: it goes, and a lint alert then names `[^inner]` as a definition nothing references (the deleted body was its only citation). Every delete in this section is followed by the lint alerts, which is why the nested-footnote alert also speaks while `[^chain]` exists: its body cites `[^inner]`, and the plugin calls a reference inside a definition body a nested footnote (ADR 1)
- [ ] Caret inside `[^item]`: the reference and the definition line inside the list go together, as Obsidian's own delete does (a definition inside a list item that ran over more than one line would be refused instead)
- [ ] Right-click ON `[^menu]`: the menu shows **Delete footnote everywhere** with your new icon, in the same section as **Rename footnote**, and the menu is no wider than before; choosing it deletes with the same toast
- [ ] Right-click the first `[^twice]` and choose Obsidian's OWN **Delete footnote and reference**: only that reference and the definition go, the second `[^twice]` is left pointing at nothing. This is the core bug the command exists to fix; undo

## 2. Footnote reference placement

Fixtures: This is "some bravo". 这是一个句子，引用来源。 他说「引用来源。」

- [ ] Settings page: **Placement relative to punctuation**, in the Footnote reference placement section, is a dropdown (After punctuation, Before punctuation, Don't move), shows After punctuation, and its description reads well and does not cut off at phone width; settings search for "placement" finds it
- [ ] After punctuation (default): caret inside `bravo`, numbered hotkey: the reference lands after the closing quote AND the full stop. Undo
- [ ] Set **Before punctuation**. Same press: after the closing quote, in front of the full stop. Undo
- [ ] Before, Chinese: caret in 来源 of the first Chinese sentence: the reference lands in front of the 。 and Reading view shows the superscript before the full stop. Undo
- [ ] Before, quoted Chinese: caret in 来源 of the quoted sentence: the reference lands after the 」, outside the quote. Undo
- [ ] Still Before: run **Lint footnotes** on this note. The two references in the lint fixture below move in front of their full stops, the quoted one stays outside its 」, the English one moves too (the known cost of one global setting), and one undo restores all of them

已有研究表明，该工艺可使能耗降低。[^gb] 他说「这是引文。」[^quote] An English sentence.[^en]

- [ ] Set **Don't move**. In Settings > Linting, **Fix footnote reference placement** is greyed out. Caret inside `bravo`, numbered hotkey: right after `bravo`, inside the closing quote (Don't move steps over nothing, your ruling of 2026-09-22); **Lint footnotes** moves nothing. Undo, set the placement back to **After punctuation**

## 3. Inline footnotes and the punctuation rule

Fixture: Content^[an inline note]. And "quoted^[another]". And a pair[^pair]^[third].

- [ ] Run **Lint footnotes**: the inline footnotes move past the full stop and past the closing quote and full stop, whole, bodies untouched (`Content.^[an inline note]`, `"quoted".^[another]`), and the reference-plus-inline pair crosses the full stop together. Reading view renders them. Undo

## 4. Converting between footnote styles

Fixtures: two inline footnotes with the same body^[the same note] and again^[the same note], a different one^[a different note], a single-line normal one[^single], and a long one[^long].

- [ ] Run **Convert inline footnotes to normal footnotes**: the three inline footnotes above become numbered references, two definitions are appended after the last definition block (the identical bodies share one), the toast reads "Converted 3 inline footnotes into 2 normal footnotes (1 identical body merged)."
- [ ] One undo brings all three inline footnotes back and removes both definitions
- [ ] Set **Preferred footnote naming style** to **Named** and run the command again: the references read `[^same]`, `[^same]`, `[^different]`, with definitions to match. Undo
- [ ] Still under **Named**, run **Lint footnotes**: every numbered footnote in this note whose definition offers a word takes that word as its name (`[^twice]` and the other named ones stay as they are), a second lint changes nothing, and Reading view still renders every footnote. Undo
- [ ] Set **Preferred footnote naming style** to **Numbered** and run **Lint footnotes**: the named footnotes become numbers by order of appearance. Undo, set it back to Keep as written
- [ ] Turn **Lint on footnote creation** on and run the same command: it lints straight after (numbering follows the text) and the note reads right in Reading view. Undo, turn the setting off
- [ ] Run **Convert normal footnotes to inline footnotes**: `[^twice]` (if you restored it) becomes identical inline copies, `[^single]` becomes one, `[^long]` and `[^item]` stay, and the toast names them with their reasons ("more than one line", "inside a list item") and says a definition used more than once became copies
- [ ] One undo restores references and definitions together
- [ ] Round trip: convert to inline, then back to normal: a footnote that was used twice comes back as ONE definition with two references (the name is now a number, the sharing is restored)

## 5. Copying, cutting, and pasting

Open **19b - Paste target** in a second pane. Fixture paragraph: a paragraph with a shared footnote[^shared] and another use of it[^shared], one with its own[^own], and the chained one[^chain].

- [ ] Select the fixture paragraph, Ctrl+C, click at the end of the line in 19b, Ctrl+V: the text lands, definitions for `shared`, `own`, `chain` and `inner` are appended after `[^1]: an existing one`, the toast reads "Pasted with 4 footnote definitions: 4 added, 0 reused, 0 renamed.", Reading view renders every footnote
- [ ] One undo in 19b removes the text and all four definitions together
- [ ] Ctrl+V a second time: 0 added, 4 reused, and the references point at the existing definitions. Paste once more after the `[^own-2]` rename of the next check: the toast says "4 reused (1 under a name this note already had)"
- [ ] In 19b add a line `[^own]: a different body` at the bottom, Ctrl+V again: `[^own]` arrives renamed to `[^own-2]` with its own definition, toast says 1 renamed
- [ ] Copy `Existing[^1] text.` from 19b, paste it here at the end of a paragraph: it lands as `[^1]` with its definition (this note has no `[^1]`). Undo
- [ ] Cut: select exactly `one with its own[^own]` and Ctrl+X: the phrase and the `[^own]` definition leave in the SAME undo step, the toast says one definition was cut; Ctrl+V elsewhere in this note brings both back. Undo twice
- [ ] Cut one of the two `[^shared]` uses: the definition stays, and pasting it elsewhere reuses it
- [ ] Paste the copied paragraph into Notepad or a browser field: the text, then a blank line, then the four definition lines (they travel in the clipboard text on purpose, so a cut pasted outside Obsidian loses nothing)
- [ ] Cut a phrase whose footnote only it uses, paste it into Notepad: the definition line is there; paste it back into this note: it lands as a footnote again, not as a stray definition line

## 6. Icons and the palette

- [ ] Command palette: **Delete footnote everywhere**, **Convert inline footnotes to normal footnotes** and **Convert normal footnotes to inline footnotes** are listed, each with its icon (the two convert icons are placeholders until yours land; the delete icon is yours)
- [ ] Phone or mobile emulation: the three commands can be added to the toolbar and their icons read at toolbar size
- [ ] Settings page: command and setting names in the descriptions are bold and footnote syntax is in code style (the naming dropdown and the prefix toggle show both); **Preferred footnote naming style**, **Placement relative to punctuation**, **Per-note footnote prefix**, the carry toggle, and the Linting page's **Reindex** break their descriptions into bullet lists (one value or case per bullet, a closing line after the list where there is one) with a modest indent that still reads at phone width; settings search for "meaningful" still finds the naming dropdown, which proves the search reads formatted descriptions

## 7. The phone (needs the beta on the phone)

- [ ] Long-press `[^menu]` to select it, tap the delete toolbar icon: the deletion happens and the toast fits the screen
- [ ] Select text with a footnote, Copy from the long-press menu, paste into another note: the definition follows
- [ ] Cut a phrase whose footnote only it uses: the definition leaves with it in one undo

[^twice]: cited twice, one line
[^pair]: for the pair check in section 3
[^menu]: the right-click fixture
[^chain]: this body cites[^inner] another
[^inner]: only the chained body cites this
[^gb]: GB/T 7714-2015 puts the marker before the full stop in its worked examples
[^quote]: outside the closing bracket in every convention
[^en]: an English sentence in the same note moves too under a global setting
[^single]: one line
[^long]: first line
    second line, so this one has no inline form
[^shared]: used twice in the paste fixture
[^own]: used once in the paste fixture
