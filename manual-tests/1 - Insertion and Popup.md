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

## Selection becomes a footnote (issue #35, 2026-08-12)

Select text first, then press a footnote hotkey — the selection converts instead of inserting at the caret. Always on, single-line selections only.

- [ ] Select a few words in this sentence and press the NUMBERED hotkey: the selection is replaced by `[^N]` and the selected text becomes that footnote's definition body at the bottom (popup shows it pre-filled when the popup setting is on; otherwise the caret jumps to the end of the body)
- [ ] Select a few words and press the INLINE hotkey: the selection becomes `^[the words]` in place, caret after the closing bracket
- [ ] Select a few words and press the NAMED hotkey: a modal asks for the name, and Enter creates `[^name]` with the selection as its definition (added 2026-08-13)
- [ ] Select with an extra space at either end (drag sloppily): the spaces stay in the prose, only the trimmed words move into the footnote
- [ ] Select a whole line by dragging through the newline (caret ends at the start of the next line): the whole line still converts
- [ ] Select across TWO lines: a toast asks for a single-line selection, nothing changes
- [ ] Select something and press the NAMED hotkey: a toast redirects to the numbered/inline keys, nothing changes
- [ ] Same for the paste-inline hotkey (and the clipboard is not read)
- [ ] Select text inside the `inline code span` here, or inside the code block above: the protected-text toast appears, nothing changes
- [ ] Select only whitespace: the press behaves like a normal insert at the caret
- [ ] In a table cell with cell editing active, selecting a word and pressing the inline hotkey wraps it inside the cell; the numbered hotkey replaces it with `[^N]` and the pre-filled definition lands below the table
- [ ] Undo (Ctrl+Z) after a conversion restores the selected text in one step

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

## Protected text (rule added 2026-08-12)

Footnote creation is blocked inside code, math, comments, and frontmatter. It is always on, and inline spans count too. With the cursor in each spot below, every insert hotkey (numbered, named, inline, paste inline) shows "No footnote was created: footnotes can't go inside code, math, or other protected text." and changes nothing:

- [ ] Inside the fenced code block below
- [ ] Inside the `inline code span` on this line
- [ ] Inside the math block below, and inside $x + y$ inline math
- [ ] On a frontmatter line (add `---` frontmatter to a scratch note)
- [ ] Just BEFORE the opening backtick or just AFTER the closing backtick of the span above, inserting still works normally
- [ ] Navigation is unaffected: the hotkey on a live reference/definition elsewhere in the note still jumps
- [ ] Swallow guards (found by the press fuzzer 2026-08-12): with the caret between `$5 or ` and `$6` on a line like `pay $5 or $6 now`, the numbered hotkey shows the same protected-text toast instead of inserting a reference that would complete a math pair and vanish; the caret right after a lone `\` inserts the footnote BEFORE the backslash (both stay live)

```
block me [^here]
```

$$
E = mc^2
$$

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
