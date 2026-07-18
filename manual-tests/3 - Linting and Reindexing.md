---
decoy: this frontmatter mentions [^1] and must never be touched
---

# Linting and reindexing

> [!info] How to use
> This note is a one-shot fixture: run the **Lint footnotes** command, compare against the checklist, then undo (Ctrl+Z) to restore the mess and try again with different settings (the reindexing options live on the Linting settings page).

## The mess

This paragraph cites late[^9] then early[^2], then a named one[^method], then the late one again[^9], and one with punctuation on the wrong side[^4]. An inline footnote^[inline footnotes carry their text with them, so linting leaves them alone] sits in the middle, and a second inline one has brackets^[balanced [pairs] survive] inside.

[^4]: four, a definition stranded mid-document, out of order

Interlude prose so the definition above really is mid-document. Now the hard names: a colon name[^arXiv:2026.0717], an uppercase name[^NOTE], and a repeat of the named one[^method].

> A blockquote with a marker[^12] joins in.

Fakes that must not move, count, or change:

```
[^1]: a fenced fake definition
a fenced fake marker [^77]
```

Inline code with a fake marker `[^88]` and a fake detail `[^55]: nope`.

<!-- [^66]: a commented-out definition stays commented out -->

## Definitions (deliberately scrambled)

[^9]: nine, used first in the text, so reindexing makes it number 1
    a continuation line that must travel with its definition

    a second paragraph of the same footnote, still attached
[^2]: two, coincidentally already in the right relative spot
[^method]: named footnotes keep their names
[^orphanned]: a NAMED orphan, no marker uses it anywhere
[^12]: twelve, cited from the blockquote
[^31]: a NUMBERED orphan, also unused
[^arXiv:2026.0717]: colon and uppercase in one name
[^NOTE]: an uppercase name

Prose AFTER the definitions, so "move to the bottom" has real work: after linting, every definition should sit below this line.

## Expected after one lint (default settings)

- [ ] Numbered markers renumber by first appearance: `[^9]`→`[^1]`, `[^2]` stays `[^2]`, `[^4]`→`[^3]`, `[^12]`→`[^4]`, and BOTH uses of the old `[^9]` change together
- [ ] Named markers (`method`, `arXiv:2026.0717`, `NOTE`) keep their names, marker and definition alike
- [ ] EVERY marker sitting before punctuation swaps to sit after it, named ones included: `wrong side[^3].` becomes `wrong side.[^3]`, and the commas after `early`, `named one`, `again`, and the hard names all hop the same way
- [ ] All definitions move below the "Prose AFTER" line, ordered by first appearance; the mid-document `four` definition joins them
- [ ] The `nine` definition's continuation line AND its second paragraph travel with it
- [ ] The named orphan keeps its name and sits after the referenced definitions; the numbered orphan gets the next free number (`[^5]`)
- [ ] Both inline footnotes are byte-for-byte untouched
- [ ] The frontmatter decoy, the fenced block, both inline-code fakes, and the HTML-comment fake are all byte-for-byte untouched
- [ ] Running lint a second time reports nothing to do (idempotent)
- [ ] With `Keep orphaned definitions` off: both orphans are deleted instead
- [ ] With `Renumber named footnotes` on: the named footnotes get numbers by appearance order too
