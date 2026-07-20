# Insertion and popup

> [!info] How to use
> Work through the checklist with your footnote hotkeys. Undo (Ctrl+Z) between experiments to reset a section. Settings referenced here live in the plugin's main settings tab.

## Numbered insertion

Place the cursor in the middle of the word markers below and press the auto-numbered hotkey.

- [ ] Cursor mid-word → marker lands at the END of the word (with `Insert footnote at end of word` on)
- [ ] The word before punctuation: marker lands after the comma, here, and after the period, here.
- [ ] First footnote in this note creates the detail at the bottom (turn on `Enable section heading` first to watch the heading appear)
- [ ] Second insertion numbers sequentially and appends its detail right below the first
- [ ] Pressing the hotkey with the caret immediately AFTER an existing marker inserts a consecutive footnote instead of navigating

## Named insertion

- [ ] Named hotkey inserts `[^]` with the caret inside the brackets
- [ ] Type a name, press the hotkey again with the caret still inside → the detail is created
- [ ] Try a name with a space in it → the plugin warns instead of creating a broken detail

## Inline footnotes

- [ ] Inline hotkey inserts `^[]` with the caret inside
- [ ] Second press while still inside hops the caret past the closing bracket
- [ ] Copy this sentence, then use the paste-inline hotkey: The clipboard text
  spans two lines and should collapse to one.

## Hotkeys inside an inline footnote (QOL)

Place the caret inside this inline footnote^[press the numbered or named hotkey while in here] and:

- [ ] The NUMBERED hotkey hops the caret just past the closing bracket, no marker is nested inside
- [ ] The NAMED hotkey does the same
- [ ] The inline hotkey still exits too (its original second-press behavior)

## Existing heading claims the first footnote (QOL)

Turn on `Enable section heading` (heading `# Footnotes`), then insert a footnote into this sentence.

- [ ] The detail lands under the heading below, NOT at the end of the note, and no second heading appears

# Footnotes

Content after the heading stays below the new detail.

## Popup editor

Turn on `Edit footnotes in a popup`, then:

- [ ] Inserting a footnote opens the popup at the cursor, focused for typing
- [ ] The footnote hotkey toggles the popup closed; Escape and clicking outside close it too
- [ ] Rapid double-press creates ONE footnote and toggles its popup
- [ ] Type a detail, close, immediately insert the next footnote, the typed detail survives

## Tables

| Insert here    | And here          |
| -------------- | ----------------- |
| Click in me () | Named one here () |

- [ ] With the caret inside a cell (cell editor active), numbered/named/inline insertion lands inside the cell without shredding the pipes
- [ ] The detail still lands at the bottom of the note, outside the table
