---
decoy: this frontmatter mentions [^1] and must never be touched
---

# L12: protected regions under lint and autonumber

Settings: all lint rules ON. Run **Lint footnotes** once, check, undo.

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
as one unclosed comment, which made this note display wrong - 2026-09-08.
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

- [ ] Lint: everything inside the math, the indented block, the comment, BOTH fences, the inline-code fakes, the escape, the inline footnote, and this file's frontmatter decoy is byte-for-byte untouched; only `swap me[^s1].` swaps to `swap me.[^s1]`
- [ ] The refs BEFORE the comment opener and AFTER its closer (`[^c1]`, `[^c3]`) are LIVE: they renumber/swap like normal text; the blockquoted `[^q1]` renumbers too
- [ ] The quoted fence above ended when its blockquote did — this checklist text is live, not phantom code
- [ ] Autonumber in the prose: none of `[^9]`, `[^8]`, `[^7]`, `[^90]`, `[^c2]`, `[^f1]`, `[^f2]`, `[^88]`, the escaped `[^9]`, or the inline `^[...]` content reserve numbers
