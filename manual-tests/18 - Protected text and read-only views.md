---
decoy: this note's own frontmatter is the frontmatter fixture, mentions [^1], and must never be touched
---

# 18: protected text and read-only views

Settings: defaults; the lint half needs all lint rules ON. Undo between
checks. Every fixture is already in this note.

## Creation is blocked in protected text (rule 2026-08-12)

Always on, inline spans included. With the caret in each spot, EVERY
insert hotkey (numbered, named, inline, paste) toasts "No footnote was
created: footnotes can't go inside code, math, or other protected
text." and changes nothing:

- [ ] Inside the fenced code block below
- [ ] Inside the `inline code span` on this line
- [ ] Inside the `$$` math block below, and inside $x + y$ inline math
- [ ] On this note's own frontmatter line at the top (source mode)
- [ ] In LIVE PREVIEW, click into the `decoy` property's value field and press each insert hotkey: the same toast, and NO footnote appears at the spot you last clicked in the prose (the Properties widget sits outside the editor, so that stale caret used to get the footnote; fixed 2026-09-04). Rename footnote from there toasts "Place the cursor on a footnote reference or definition to rename it."
- [ ] Just BEFORE the opening backtick or just AFTER the closing backtick of the span above, inserting works normally
- [ ] Navigation is unaffected: the hotkey on the live reference swap me[^s1] further down still jumps
- [ ] Swallow guards (press fuzzer, 2026-08-12): caret between `$5 or ` and `$6` in pay $5 or $6 now shows the same toast (the reference would complete a math pair and vanish); caret right after the lone backslash here \ inserts the footnote BEFORE the backslash

```
block me [^here]
```

$$
E = mc^2
$$

## Reading view (fixed 2026-08-08)

Switch this note to Reading view:

- [ ] Pressing any footnote hotkey does nothing: no toast, and flipping back to editing view shows NO stray `[^]` or `^[]` anywhere (presses used to edit the hidden buffer invisibly)
- [ ] The footnote commands are missing from the command palette while in Reading view; **Set footnote prefix** stays available (a frontmatter edit is fine there)

## Lint and the numbered command leave protected regions alone

Run **Lint footnotes** once, check, undo.

Math inline $x[^9].$ stays, display too:

$$
[^8]: mathematical label
y[^7]
$$

    indented code[^90] block, standalone

Comment boundaries: live[^c1] <!-- hidden [^c2]
--> live again[^c3].

(The short-form comment `<!-->` is deliberately NOT in this sheet: Reading
view shows it as literal text and the plugin treats it as complete, both
per CommonMark, but Live Preview's highlighter paints everything after it
as one unclosed comment, which made this note display wrong, 2026-09-08.
The short form is pinned by units instead.)

> ```
> quoted fence[^f1]

- ```
  listed fence[^f2]
  ```

Inline code fakes `[^88]` and `[^55]: nope`, an escaped literal \[^9],
an inline footnote ^[^inline-content] here, and a quoted live ref:

> quoted text[^q1] renumbers like any live text

Real refs to lint: swap me[^s1].

[^c1]: one
[^c3]: three
[^s1]: swap definition
[^q1]: quoted-reference definition

- [ ] Lint: everything inside the math, the indented block, the comment, BOTH fences, the inline-code fakes, the escape, the inline footnote, and this note's frontmatter decoy is byte-for-byte untouched; only `swap me[^s1].` swaps to `swap me.[^s1]`
- [ ] The refs BEFORE the comment opener and AFTER its closer (`[^c1]`, `[^c3]`) are LIVE: they renumber/swap like normal text; the blockquoted `[^q1]` renumbers too
- [ ] The quoted fence above ended when its blockquote did: this checklist text is live, not phantom code
- [ ] The numbered command in the prose: none of `[^9]`, `[^8]`, `[^7]`, `[^90]`, `[^c2]`, `[^f1]`, `[^f2]`, `[^88]`, the escaped `[^9]`, or the inline `^[...]` content reserve numbers
