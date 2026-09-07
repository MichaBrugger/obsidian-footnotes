---
decoy: this note's own frontmatter is the frontmatter fixture
---

# A19: creation is blocked in protected text (rule 2026-08-12)

Settings: defaults. Always on, inline spans included. With the caret in
each spot, EVERY insert hotkey (numbered, named, inline, paste) toasts
"No footnote was created: ..." and changes nothing:

- [ ] Inside the fenced code block below
- [ ] Inside the `inline code span` on this line
- [ ] Inside the math block below, and inside $x + y$ inline math
- [ ] On this note's own frontmatter line at the top (source mode)
- [ ] In LIVE PREVIEW, click into the `decoy` property's value field and press each insert hotkey: the same toast, and NO footnote appears at the spot you last clicked in the prose (the Properties widget sits outside the editor, so that stale caret used to get the footnote; fixed 2026-09-04). The Rename footnote command from there toasts its "place the cursor on a footnote" message
- [ ] Just BEFORE the opening backtick or just AFTER the closing backtick of the span above, inserting still works normally
- [ ] Navigation is unaffected: the hotkey on a live reference elsewhere still jumps
- [ ] Swallow guards (press fuzzer, 2026-08-12): caret between `$5 or ` and `$6` in `pay $5 or $6 now` shows the same toast (the reference would complete a math pair and vanish); caret right after a lone `\` inserts the footnote BEFORE the backslash

```
block me [^here]
```

$$
E = mc^2
$$
