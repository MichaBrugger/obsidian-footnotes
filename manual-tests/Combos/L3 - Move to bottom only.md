# L3: move to bottom only

Settings: punctuation OFF, move to bottom ON, reindex OFF.

Run **Lint footnotes**, compare with the fence, then undo.

Para one[^1].

[^1]: def

Para two tail.

Expected (definition relocates below the tail, nothing renumbers):

```
Para one[^1].

Para two tail.

[^1]: def
```

Multi-paragraph travel: a definition with a continuation line, a blank,
and a second paragraph moves as ONE block:

Para[^m] cite.

[^m]: first line
    continuation line

    second paragraph, still the same footnote

Tail prose.

- [ ] After lint, the whole `[^m]` block sits below the tail, intact (blank separator included)
