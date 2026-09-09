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

## Obsidian `%%` comments (2026-09-09)

Obsidian hides a `%%` comment but still parses it: a reference inside a
comment is a real reference (it binds its definition and takes a number,
though its own superscript is hidden), while a definition inside a `%%`
block comment is dead. A `%%` at the start of a line with no second `%%`
on that line opens a block comment through the next `%%` anywhere; a
mid-line `%%` pairs only within its own line. The plugin matches this.

Hidden reference, live definition: november[^n1] here.
%%
A commented paragraph with a hidden reference[^n2] in it.
%%

Dead definition: oscar[^o1] here.
%%
[^o1]: this definition sits inside a comment and never renders
%%

Inline comment with a hidden reference: papa %%hidden[^n3]%% here.

Numbering counts hidden references: romeo[^1] %%hidden[^2]%% sierra[^3] here.

A comment-only line is still a paragraph line, tango[^p9] here:
%% a comment-only line %%
[^p9]: a label right under a comment line (lazy)

An HTML comment line is a block, uniform[^h1] here:
<!-- an HTML comment line -->
[^h1]: a label right under an HTML comment line (a definition)

[^n1]: november
[^n2]: the hidden reference's definition: it renders, with no visible marker
[^n3]: papa's hidden reference's definition
[^1]: romeo
[^2]: the hidden second reference's definition
[^3]: sierra

- [ ] Reading view: `[^n1]`, `[^h1]`, `[^1]`, `[^3]` render as footnotes; the `n2`, `n3`, and `2` entries appear in the footnote list (each with a back-arrow) though no marker is visible for them; `sierra` shows as `[3]`, not `[2]`; `oscar[^o1]` renders as plain text; `tango[^p9]` renders as plain text and the `[^p9]:` line reads as prose
- [ ] Hotkey inside the hidden `[^n2]` (Source mode or Live Preview): navigates to its definition (or opens the popup), exactly like a visible reference
- [ ] **Lint footnotes** (defaults): the missing-definition alert names `o1` (its only definition is commented out); `[^p9]:` becomes a definition (a blank line above it, then gathered to the bottom with the others; `tango[^p9]` renders after that); `[^h1]:` gathers too (it was a definition all along); nothing is inserted or moved inside either `%%` block, and the commented `[^o1]:` line is untouched; the hidden `[^n2]`, `[^n3]`, `[^2]` references are left where they are and nothing renumbers (the hidden `[^2]` holds its number)
- [ ] Undo, turn `Delete orphaned definitions` ON, lint again: the `n2`, `n3`, and `2` definitions SURVIVE (referenced from inside comments); undo and turn it back OFF
