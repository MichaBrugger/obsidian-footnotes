# A19: creation is blocked in protected text (rule 2026-08-12)

Settings: defaults. Always on, inline spans included. With the caret in
each spot, EVERY insert hotkey (numbered, named, inline, paste) toasts
"No footnote was created: ..." and changes nothing:

- [ ] Inside the fenced code block below
- [ ] Inside the `inline code span` on this line
- [ ] Inside the math block below, and inside $x + y$ inline math
- [ ] On a frontmatter line (add `---` frontmatter to a scratch note)
- [ ] Just BEFORE the opening backtick or just AFTER the closing backtick of the span above, inserting still works normally
- [ ] Navigation is unaffected: the hotkey on a live reference elsewhere still jumps
- [ ] Swallow guards (press fuzzer, 2026-08-12): caret between `$5 or ` and `$6` in `pay $5 or $6 now` shows the same toast (the reference would complete a math pair and vanish); caret right after a lone `\` inserts the footnote BEFORE the backslash

```
block me [^here]
```

$$
E = mc^2
$$
