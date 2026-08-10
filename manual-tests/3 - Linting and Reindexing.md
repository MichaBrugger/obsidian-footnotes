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

> A blockquote with a reference[^12] joins in.

Fakes that must not move, count, or change:

```
[^1]: a fenced fake definition
a fenced fake reference [^77]
```

Inline code with a fake reference `[^88]` and a fake definition `[^55]: nope`.

<!-- [^66]: a commented-out definition stays commented out -->

## Definitions (deliberately scrambled)

[^9]: nine, used first in the text, so reindexing makes it number 1
    a continuation line that must travel with its definition

    a second paragraph of the same footnote, still attached
[^2]: two, coincidentally already in the right relative spot
[^method]: named footnotes keep their names
[^orphanned]: a NAMED orphan, no reference uses it anywhere
[^12]: twelve, cited from the blockquote
[^31]: a NUMBERED orphan, also unused
[^arXiv:2026.0717]: colon and uppercase in one name
[^NOTE]: an uppercase name

Prose AFTER the definitions, so "move to the bottom" has real work: after linting, every definition should sit below this line.

## Expected after one lint (default settings)

- [ ] Numbered references renumber by first appearance: `[^9]`→`[^1]`, `[^2]` stays `[^2]`, `[^4]`→`[^3]`, `[^12]`→`[^4]`, and BOTH uses of the old `[^9]` change together
- [ ] Named references (`method`, `arXiv:2026.0717`, `NOTE`) keep their names, reference and definition alike
- [ ] EVERY reference sitting before punctuation swaps to sit after it, named ones included: `wrong side[^3].` becomes `wrong side.[^3]`, and the commas after `early`, `named one`, `again`, and the hard names all hop the same way
- [ ] All definitions move below the "Prose AFTER" line, ordered by first appearance; the mid-document `four` definition joins them
- [ ] The `nine` definition's continuation line AND its second paragraph travel with it
- [ ] The named orphan keeps its name and sits after the referenced definitions; the numbered orphan gets the next free number (`[^5]`); an alert reports the definitions nothing references (Orphans are never silent, 2026-08-10)
- [ ] Both inline footnotes are byte-for-byte untouched
- [ ] The frontmatter decoy, the fenced block, both inline-code fakes, and the HTML-comment fake are all byte-for-byte untouched
- [ ] Running lint a second time reports nothing to do (idempotent)
- [ ] With `Delete orphaned definitions` ON (Orphans section, 2026-08-10): both orphans are deleted instead, even with `Reindex` OFF
- [ ] With `Renumber named footnotes` on: the named footnotes get numbers by appearance order too

## Lint notices (QOL 2026-08-07)

- [ ] Type a bare `[^]` into the mess above and run **Lint footnotes**: an extra alert says the note has an empty footnote reference that won't render (it fires alongside the normal lint notice, and also when the lint otherwise had nothing to do; undo afterwards)
- [ ] Turn OFF all three rules AND Reindex AND both Orphans toggles on the Linting page, then run **Lint footnotes**: it says all lint rules are turned off, instead of the misleading "No linting needed." (Ctrl+S with lint-on-save says the same, 2026-08-10)
- [ ] Add a reference with no definition (like `stray[^99]`) and lint: an alert names it and says to write its definition or delete the reference; with `Delete orphaned references` ON (Orphans section) the lint removes it from the text instead, healing the spacing (2026-08-10)
- [ ] On the Linting page, `Renumber named footnotes` is greyed out while `Reindex` is off, `Apply the note's footnote prefix` is greyed out while the prefix feature is off (main tab), and the two `Orphans` toggles are never greyed
- [ ] The Linting page shows the new **Orphans** section between Rules and Reindexing, holding `Delete orphaned references` and `Delete orphaned definitions` (both OFF by default; off means the lint ALERTS about that orphan kind instead)
- [ ] With the Linter plugin ENABLED, the Linting page opens with a "Using the Linter plugin?" note telling you to turn off Linter's own footnote rules (both plugins rewriting the same footnotes conflicts, verified 2026-08-08); with Linter disabled or uninstalled, the note is hidden
