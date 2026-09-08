---
footnote-prefix: P-
---

# A24: every refusal in one place (2026-09-05)

Settings: defaults, popup OFF unless a check says otherwise. Turn
`Per-note footnote prefix` ON only for the prefix section (this note's
frontmatter carries `P-` for it). Undo between checks. A refusal means:
the stated toast (or the inline reason in a modal) appears and the note
does not change. Toast wording is quoted exactly so a drift shows up.

Fixture references: plain[^1] here, second[^2] here, a bare[^] empty one,
an inline^[body] one, a spaced [^bad name] one, a hashed [^#tag] one, and a
`[^code]: fake` inside inline code.

## Caret guards (any insert key: numbered, named, inline, paste)

- [ ] Caret inside the code span above, or inside the fence below: "No footnote was created: footnotes can't go inside code, math, or other protected text."
- [ ] Caret in the body of the `[^1]:` definition at the bottom: the key JUMPS back to the reference (a jump, not a toast; the nesting refusal below is the selection twin)
- [ ] Caret inside the bare `[^]`: "This footnote reference is empty. Type a name between the brackets." (caret stays)
- [ ] Caret inside `^[body]` after deleting the body so it reads `^[]`: "This inline footnote is empty. Type its text between the brackets."
- [ ] Caret inside `[^bad name]`, NAMED key: "Footnote name "bad name" contains spaces, so it won't work as a footnote in Obsidian. Remove the spaces."
- [ ] Caret inside `[^#tag]`, NAMED key: same shape, naming `"#"` as the offender
- [ ] Prefix feature ON, caret inside a fresh `[^P-]` placeholder (press the named key once, type nothing): "Please add a footnote suffix after the prefix."

```
fence [^fake] here
```

## Selection refusals

Fixture lines for these: `one two three` and `alpha $x+y$ beta` and the
table further down.

- [ ] Two Alt-dragged selections, any converting key: "Select one continuous stretch of text to turn it into a footnote."
- [ ] Any selection, PASTE key: "To turn the selected text into a footnote, use the auto-numbered, named, or inline footnote command."
- [ ] A selection spanning two lines, INLINE key: "Inline footnotes are single-line. Use the auto-numbered or named footnote command to convert a multi-line selection."
- [ ] Select `x+y` inside the dollars (cutting the math), numbered key: "No footnote was created: the selection cuts through code, math, or other protected text. Select all of it or none of it."
- [ ] Select `plain[^1] here` (contains a live reference): "No footnote was created: the selection contains a footnote, and footnotes can't be nested inside other footnotes."
- [ ] Select text inside the `[^1]:` definition body at the bottom: "No footnote was created: footnotes can't go inside another footnote's definition."
- [ ] Select from the row `| a | b |` through `| 1 | 2 |` (part of a table, source mode): "No footnote was created: the selection cuts through a table. Select text inside one cell, or the whole table with the text around it."
- [ ] Named key on a selection, then edit the note behind the open modal and press Enter: "The note changed while naming the footnote. Reselect the text and try again."

before the table

| a | b |
| --- | --- |
| 1 | 2 |

after the table

## Naming and renaming (inline reasons in the modal)

- [ ] Named key on a selection, type `a[b`, then `a b`, then `a` + backtick + `b`, then `a#b`: each shows "Footnote names can't contain spaces, backticks, brackets, or "#"."
- [ ] Type `1` (already defined): ""[^1]" is already defined. Pick a new name."
- [ ] Rename footnote with the caret on plain prose: "Place the cursor on a footnote reference or definition to rename it."
- [ ] Rename `[^1]` to `bad name`, `a#b`, `a[b`: the same message, inline
- [ ] Rename `[^1]` to `2` (the second live footnote below): ""[^2]" is already used by another footnote."

## Multi-caret

- [ ] Two Alt-click carets, one in prose and one inside `[^1]`, any insert key: "No footnotes were created: one of the cursors is inside an existing footnote."
- [ ] Two carets, both inside `[^#tag]`, NAMED key: the contains-"#" warning, nothing created
- [ ] Two carets in prose, PASTE key with an empty clipboard: "The clipboard is empty, so there is nothing to put in an inline footnote."

## Prefix (feature ON)

- [ ] Set footnote prefix modal: `a b`, `a[b`, `a#b` each refuse inline with "The footnote prefix can't contain spaces, backticks, brackets, or "#"."; `12` refuses with "The footnote prefix can't end in a number. Its footnotes would be indistinguishable from plain numbered ones."
- [ ] Hand-edit the property to `footnote-prefix: bad prefix`, numbered key: "No footnote was created: this note's footnote-prefix ("bad prefix") is invalid. The footnote prefix can't contain spaces, backticks, brackets, or "#"."
- [ ] Same property, run Lint: "Linting canceled: this note's footnote-prefix ("bad prefix") is invalid. ..." (same reason appended)
- [ ] Feature OFF, Set footnote prefix to `2.`: saved, but the toast warns "Footnote prefix set to "2.", but the "Per-note footnote prefix" setting is turned off, so it won't be used until you enable it."

## Where the editor isn't editable

- [ ] Reading view, every insert key: nothing happens, no toast, the file is untouched (A18 has the long form)
- [ ] Live Preview, click into a Properties value field, every insert key: the protected-text toast; Rename footnote from there: the "Place the cursor on a footnote" toast
- [ ] All lint rules OFF, run Lint: "All lint rules are turned off in the plugin settings, so there is nothing to lint."

## Popup (setting ON)

- [ ] Numbered key with the popup ON: no refusal (control). Then press inside `[^#tag]` after adding a `[^#tag]:` definition: the key JUMPS to the definition at once, no popup, no "Waiting for Obsidian to index the new footnote…" notice (the popup can't bind an id containing `#`)

## Lint alerts (reported, not refused)

These are the linter speaking about what it could not or was not allowed
to fix; L13 and L14 own the detail. Spot-check that each names its
footnotes in quotes and never splits a quoted name across lines:

- [ ] A `[^lost]` with no definition, delete-orphans OFF: "This note has a footnote reference with no definition ("[^lost]"). Write its definition or delete the reference."
- [ ] A `[^unused]:` nothing references, delete-orphans OFF: "This note has a footnote definition nothing references ("[^unused]"). Add its reference in the text or delete the definition."
- [ ] Two `[^d]:` definitions, merge OFF: "This note defines "[^d]" more than once. Obsidian renders only the last definition. Merge them, or turn on "Merge duplicate definitions"."
- [ ] The bare `[^]` fixture: "This note has an unnamed footnote reference ("[^]"). Give it a name or delete it."

[^1]: the plain definition
[^2]: the second definition
