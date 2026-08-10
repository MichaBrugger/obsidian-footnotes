# Insertion and popup

> [!info] How to use
> Work through the checklist with your footnote hotkeys. Undo (Ctrl+Z) between experiments to reset a section. Settings referenced here live in the plugin's main settings tab.

## Numbered insertion

Place the cursor in the middle of the word references below and press the auto-numbered hotkey.

- [ ] Cursor mid-word → reference lands at the END of the word (with `Insert footnote at end of word` on)
- [ ] The word before punctuation: reference lands after the comma, here, and after the period, here.
- [ ] First footnote in this note creates the definition at the bottom (turn on `Enable section heading` first to watch the heading appear)
- [ ] Second insertion numbers sequentially and appends its definition right below the first
- [ ] Pressing the hotkey with the caret immediately AFTER an existing reference inserts a consecutive footnote instead of navigating

## Named insertion

- [ ] Named hotkey inserts `[^]` with the caret inside the brackets
- [ ] Type a name, press the hotkey again with the caret still inside → the definition is created
- [ ] Type a name, then press the NUMBERED hotkey by accident: it creates the definition exactly like the named key, nothing is nested into the brackets (bug from beta.9 phone testing, fixed 2026-08-09; the inline keys already behaved this way)
- [ ] Try a name with a space in it → the plugin warns instead of creating a broken definition

## Empty reference guard (QOL 2026-08-07)

Press the named hotkey to get `[^]`, type NOTHING, and with the caret still between the brackets:

- [ ] Pressing the NAMED hotkey again toasts "type a name between the brackets" and the caret stays put (it used to silently hop out)
- [ ] The NUMBERED hotkey shows the same toast, nothing is nested into the brackets
- [ ] The INLINE and paste-inline hotkeys do the same
- [ ] Clicking elsewhere and leaving the `[^]` behind: running **Lint footnotes** alerts that the note has an empty reference (see note 3)

## Inline footnotes

- [ ] Inline hotkey inserts `^[]` with the caret inside
- [ ] Second press while the `^[]` is still EMPTY toasts to type its text and the caret stays put (QOL 2026-08-08; every footnote hotkey does the same, like the empty `[^]` guard)
- [ ] Type some text between the brackets, then press again: NOW the caret hops past the closing bracket
- [ ] Copy this sentence, then use the paste-inline hotkey: The clipboard text
  spans two lines and should collapse to one.
- [ ] With the caret inside an EXISTING inline footnote, the paste-inline hotkey hops out past the closing bracket instead of nesting the clipboard into it (fixed 2026-08-07)

## Hotkeys inside an inline footnote (QOL)

Place the caret inside this inline footnote^[press the numbered or named hotkey while in here] and:

- [ ] The NUMBERED hotkey hops the caret just past the closing bracket, no reference is nested inside
- [ ] The NAMED hotkey does the same
- [ ] The inline hotkey still exits too (its original second-press behavior)

## Inline hotkey inside a regular footnote (QOL, the reverse)

Insert a numbered footnote into this sentence, put the caret back INSIDE its `[^1]` reference, then press the INLINE hotkey:

- [ ] It jumps to the footnote's definition (or opens the popup) exactly like the numbered/named hotkeys, no `^[]` nested into the reference
- [ ] Type a bare `[^tag]` by hand, caret inside, inline hotkey → the definition is created like the named hotkey would
- [ ] The paste-inline hotkey navigates the same way, and the clipboard stays untouched for the next real paste

## Existing heading claims the first footnote (QOL)

Turn on `Enable section heading` (heading `# Footnotes`), then insert a footnote into this sentence.

- [ ] The definition lands under the heading below, NOT at the end of the note, and no second heading appears
- [ ] With the toggle still ON but the heading textarea CLEARED, inserting a first footnote adds no stray blank lines above the definition (empty heading counts as no heading, QOL 2026-08-07)

# Footnotes

Content after the heading stays below the new definition.

## Reading view (bug fixed 2026-08-08)

Switch this note to Reading view, then:

- [ ] Pressing any footnote hotkey does nothing: no toast, and switching back to editing view shows NO stray `[^]` or `^[]` anywhere (one press used to invisibly edit the hidden buffer, and a second press toasted about the reference it planted)
- [ ] The footnote commands are missing from the command palette while in Reading view
- [ ] **Set footnote prefix** is still available there (a frontmatter edit is fine in Reading view)

## Popup editor

Turn on `Edit footnotes in a popup`, then:

- [ ] Inserting a footnote opens the popup at the cursor, focused for typing
- [ ] The footnote hotkey toggles the popup closed; Escape and clicking outside close it too
- [ ] Rapid double-press creates ONE footnote and toggles its popup
- [ ] Type a definition, close, immediately insert the next footnote, the typed definition survives
- [ ] Type a definition and PAUSE ~2s with the popup still open: the text appears in the note's definition line below (live propagation, matching Obsidian's stock footnote hover editor; deliberate, 2026-08-08)
- [ ] Known accepted quirk (same as the stock hover editor): after typing AND undoing inside the popup, an undo in the main editor may bring the text back once; a second undo settles it

## Tables

| Insert here    | And here          |
| -------------- | ----------------- |
| Click in me () | Named one here () |

- [ ] With the caret inside a cell (cell editor active), numbered/named/inline insertion lands inside the cell without shredding the pipes
- [ ] The definition still lands at the bottom of the note, outside the table
