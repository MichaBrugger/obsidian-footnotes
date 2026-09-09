---
footnote-prefix: P-
---

# 19: every refusal in one place (2026-09-05)

Settings: defaults, popup OFF unless a check says otherwise. Turn
`Per-note footnote prefix` ON only for the prefix section (this note's
frontmatter carries `P-` for it). Undo between checks. A refusal means:
the stated toast (or the inline reason in a modal) appears and the note
does not change. Toast wording is quoted exactly so a drift shows up.
Every fixture is already in this note; the invalid-property toasts are
sheet 16.

Fixture references: plain[^1] here, second[^2] here, a bare[^] empty one,
an inline^[body] one, a spaced [^bad name] one, a hashed [^#tag] one, a
hashed one with a definition[^#jump], a reference with no
definition[^lost], a duplicated one[^d], and a `[^code]: fake` inside
inline code. Below the definitions, `[^unused]:` has no reference.

## Caret guards (any insert key: numbered, named, inline, paste)

- [ ] Caret inside the code span above, or inside the fence below: "No footnote was created: footnotes can't go inside code, math, or other protected text."
- [ ] Caret in the body of the `[^1]:` definition at the bottom: the key JUMPS back to the reference (a jump, not a toast; the nesting refusal below is the selection twin)
- [ ] Caret inside the bare `[^]`: "This footnote reference is empty. Type a name between the brackets." (caret stays)
- [ ] Caret inside `^[body]` after deleting the body so it reads `^[]`: "This inline footnote is empty. Type its text between the brackets."
- [ ] Caret inside `[^bad name]`, NAMED key: ""[^bad name]" won't work as a footnote. Footnote names can't contain spaces, backticks, brackets, or "#"."
- [ ] Caret inside `[^#tag]`, NAMED key: the same toast, naming `[^#tag]`
- [ ] Prefix feature ON, caret inside a fresh `[^P-]` placeholder (press the named key once, type nothing): "This footnote reference has only the prefix. Type a name after it."

```
fence [^fake] here
```

## Selection refusals

Fixture lines for these: `one two three` and `alpha $x+y$ beta` and the
table further down.

- [ ] Two Alt-dragged selections, any converting key: "Select one continuous stretch of text to turn it into a footnote."
- [ ] Any selection, PASTE key: "To turn the selected text into a footnote, use the numbered, named, or inline footnote command."
- [ ] A selection spanning two lines, INLINE key: "Inline footnotes are single-line. Use the numbered or named footnote command to convert a multi-line selection."
- [ ] Select `x+y` inside the dollars (cutting the math), numbered key: "No footnote was created: the selection cuts through code, math, or other protected text. Select all of it or none of it."
- [ ] Select `plain[^1] here` (contains a live reference): "No footnote was created: footnotes can't be nested inside other footnotes."
- [ ] Select text inside the `[^1]:` definition body at the bottom: the same nesting toast
- [ ] Select from the row `| a | b |` through `| 1 | 2 |` (part of a table, source mode): "No footnote was created: the selection cuts through a table. Select text inside one cell, or the whole table with the text around it."
- [ ] Named key on a selection, then edit the note behind the open modal and press Enter: "The note changed while naming the footnote. Reselect the text and try again."

before the table

| a | b |
| --- | --- |
| 1 | 2 |

after the table

## Naming and renaming (inline reasons in the modal)

- [ ] Named key on a selection, type `a[b`, then `a b`, then `a` + backtick + `b`, then `a#b`: each shows "Footnote names can't contain spaces, backticks, brackets, or "#"."
- [ ] Type `1` (already a footnote): ""[^1]" is already used by another footnote."
- [ ] Rename footnote with the caret on plain prose: "Place the cursor on a footnote reference or definition to rename it."
- [ ] Rename `[^1]` to `bad name`, `a#b`, `a[b`: the same message, inline
- [ ] Rename `[^1]` to `2` (the second live footnote): ""[^2]" is already used by another footnote."

## Multi-caret

- [ ] Two Alt-click carets, one in prose and one inside `[^1]`, any insert key: "No footnotes were created: footnotes can't be nested inside other footnotes."
- [ ] Two carets, both inside `[^#tag]`, NAMED key: the won't-work-as-a-footnote toast, nothing created
- [ ] Two carets in prose, PASTE key with an empty clipboard: "The clipboard is empty, so there is nothing to put in an inline footnote."

## Prefix (feature ON)

- [ ] Set footnote prefix modal: `a b`, `a[b`, `a#b` each refuse inline with "The footnote prefix can't contain spaces, backticks, brackets, or "#"."; `12` refuses with "The footnote prefix can't end in a number. Its footnotes would be indistinguishable from plain numbered ones."
- [ ] Feature OFF, Set footnote prefix to `2.`: saved, but the toast warns "Footnote prefix set to "2.", but the "Per-note footnote prefix" setting is turned off, so it won't be used until you enable it." (then set it back to `P-`)

## Where the editor isn't editable

- [ ] Reading view, every insert key: nothing happens, no toast, the file is untouched (sheet 18 has the long form)
- [ ] Live Preview, click into the Properties value field, every insert key: the protected-text toast; Rename footnote from there: the "Place the cursor on a footnote" toast
- [ ] All lint rules OFF, run Lint: "All lint rules are turned off in the plugin settings, so there is nothing to lint."

## Popup (setting ON)

- [ ] Numbered key with the popup ON: no refusal (control). Then press inside `[^#jump]`: the key JUMPS to its definition at once, no popup, no "Waiting for Obsidian to index the new footnote..." notice (the popup can't bind an id containing `#`)

## Lint alerts (reported, not refused)

These are the linter speaking about what it could not or was not allowed
to fix; sheet 23 owns the detail. With every Orphans toggle OFF and
merging OFF, ONE run of **Lint footnotes** on this note raises all of
these at once. Spot-check that each names its footnotes in quotes and
never splits a quoted name across lines:

- [ ] "This note has a footnote reference with no definition ("[^lost]"). Write its definition or delete the reference."
- [ ] "This note has a footnote definition nothing references ("[^unused]"). Add a "[^unused]" reference in the text, or delete the definition."
- [ ] "This note defines "[^d]" more than once. Obsidian renders only the last definition. Merge them, or turn on "Merge duplicate definitions"."
- [ ] "This note has an unnamed footnote reference ("[^]"). Give it a name or delete it."
- [ ] "This note has 2 footnotes with invalid names ("[^bad name]", "[^#tag]"). Footnote names can't contain spaces, backticks, brackets, or "#"." (2026-09-08; `[^#jump]` has a definition, so it is a working-but-unfindable footnote and is listed too if the linter counts it: note which)
- [ ] Any alert that lists footnotes lists EVERY one, never an ellipsis (2026-09-08)

[^1]: the plain definition
[^2]: the second definition
[^#jump]: a hashed definition the popup can never open
[^d]: first body
[^d]: second body
[^unused]: nothing references this definition
