# Attack surface — obsidian-footnotes

Last verified against the code: 2026-07-17 (commit a0b8c30 — linting now
lives in src/linting/ as Linter-shaped rules; the 22 bugs from the first
hunt are fixed and their pins are green regression tests in test/hunt/). If `git log`
shows newer feature commits, treat their modules as prime hunting ground and
update this file at the end of the hunt.

## Module map

Pure modules (unit-probeable, the hunt's home turf):

| Module | Key exports | What it owns |
| --- | --- | --- |
| `src/markdown-scan.ts` | `DefinitionStart`, `protectedLines`, `maskInlineCode`, `maskProtectedLines`, `removeLineRanges`, `findDefinitionBlocks` | Deciding which lines/spans are "protected" (code fences, inline code) and locating definition blocks |
| `src/insert-or-navigate-footnotes.ts` (892 lines — the big one) | `AllMarkers`, `ExtractNameFromFootnote`, `isValidFootnoteName`, `listExistingFootnoteDetails`, `listExistingFootnoteMarkersAndLocations`, `shouldJumpFromDetailToMarker`, `markerAtCursor`, `addFootnoteSectionHeader`, `buildDetailAppend`, `endOfWordOffset`, `footnotePrefix`, `computeNextFootnoteNumber`, `sanitizeInlineFootnoteContent`, `inlineFootnoteExitCh` | Marker grammar, autonumbering, insertion points, inline-footnote handling |
| `src/linting/rules/re-index-footnotes.ts` | `reindexFootnotes`, `ReindexOptions` | Renumbering markers + definitions in reading order |
| `src/linting/linter.ts` | `tidyFootnotes` (alias `lintFootnotes`), `TidyOptions`, `reindexOptionsFromSettings`, `tidyOptionsFromSettings`, auto-tidy triggers (`installTidyOnSave`, `noteActiveLeafForAutoTidy`) | Composed lint pipeline + editor runner + save/file-change triggers |
| `src/linting/rules/move-footnotes-to-the-bottom.ts` | `moveFootnoteDefinitionsToBottom` | Relocating definition blocks |
| `src/linting/rules/footnote-after-punctuation.ts` | `footnoteAfterPunctuation` | Swapping marker/punctuation order |
| `src/linting/ignore-types.ts` | `IgnoreType`, `applyIgnored` | Linter-parity mask/restore vocabulary (declaration-only so far — transforms still self-protect via markdown-scan) |
| `src/table-cursor.ts` | `tableRowCellSpans`, `resolveTableCellCursor` | Escape-aware table cell spans |

Editor-bound (needs the live app — report hypotheses, don't probe):
`src/footnote-popup.ts` (embedRegistry popup), `src/main.ts` (command wiring),
`src/settings.ts`, parts of insert-or-navigate that take an `Editor`
(`runOutsideTableCell`, `insertInTableCell`, `jumpToFootnoteDetail`).

Key grammar facts to test against:

- Marker: `AllMarkers = /\[\^([^[\]]+)\](?!:)/g` — a marker is `[^name]` NOT
  followed by `:`. Names exclude `[` and `]` but allow nearly everything else.
- Definition: `DefinitionStart = /^\[\^([^[\]]+)\]:/` — column 0 only.
- `isValidFootnoteName` rejects names with spaces (warns via Notice).
- Autonumber markers are plain integers, optionally behind a user prefix
  (`footnote-prefix` frontmatter property, **off by default** behind the
  `footnote-prefix` settings toggle).

## Historical bug taxonomy (mutate these, don't just repeat them)

Every closed bug is a *class*; hunters probe the class's neighbors:

| Issue | Bug | Class → what to mutate |
| --- | --- | --- |
| #50/#51 | `:` and uppercase in names broke jump | name-alphabet: probe `.`, `-`, `_`, emoji, CJK, digits-only, leading/trailing `-`, name that equals a prefix of another |
| #41 | `[^x]` inside code blocks miscounted | protected contexts: nested/indented fences, ` ``` ` inside inline code, tilde fences, unclosed fence at EOF, frontmatter, `$...$` math, HTML comments, callouts, blockquotes |
| #56 | duplicate markers of same footnote | multiplicity: duplicate *definitions*, marker with no definition, definition with no marker, self-referencing detail |
| #39 | null deref (`reading 'data'`) | empty/degenerate inputs: empty doc, doc of only markers, only definitions, single char, trailing newline vs none |
| #17 | insert next to existing marker | adjacency: cursor inside/at-edge-of marker, two adjacent markers, marker at line start/end |
| #28 | tables broke insertion | structure contexts: cell edges, escaped pipes `\|`, marker split by formatting |
| aeb3391 | dangling backslashes in inline content | escaping: `\]`, `\\`, backslash at end, pre-escaped brackets, pipe in table context |
| #55 | details appended at EOF not after block | placement: multiple definition blocks, definitions above markers, section header present/absent/duplicated |
| 6732fdb | prefix collisions | prefix × everything: prefix that is itself numeric ("12"), prefix equal to an existing name, prefix with regex metacharacters (`.`,`+`,`(`), empty-string prefix |

## Lens checklists

### grammar
Blind spots caught only by an out-of-band hunt on 2026-07-17 — always cover
these three: **case-folding** (Obsidian treats footnote ids case-insensitively
and `footnote-popup.ts` lowercases, but other comparisons are case-sensitive —
probe `[^Note]` vs `[^note]` through every scan/jump/reindex path, including
orphan deletion: worst case is silent data loss); **degenerate `[^]`** (empty
name never matches `AllMarkers`, so navigation misses it and a second hotkey
press nests markers); **unicode word/grapheme boundaries** (`endOfWordOffset`
uses bare `\w` — probe combining marks, precomposed accents, CJK).

Targets: `AllMarkers`, `ExtractNameFromFootnote`, `DefinitionStart`,
`isValidFootnoteName`, `listExistingFootnoteDetails`,
`listExistingFootnoteMarkersAndLocations`, `computeNextFootnoteNumber`.
Probe: name alphabets from the taxonomy; `[^1]:` vs `[^1] :`; definition
continuation lines (indented follow-ups); a definition whose body contains
another marker; markers straddling bold/italic (`**[^1]**`); `[^]` (empty
name); very long names; names with regex metacharacters when later fed into
dynamic regexes (search the source for `new RegExp` — unescaped
interpolation is a classic here).

### contexts
Targets: `protectedLines`, `maskInlineCode`, `maskProtectedLines`,
`removeLineRanges`, and every caller that respects them.
Probe: everything in the #41 class row above, plus: fence info strings
(```` ```python ````), four-space-indented code, inline code with double
backticks, protected region at very start/end of doc, CRLF line endings,
a marker on the same line as a fence delimiter.

### offsets
Targets: `endOfWordOffset`, `inlineFootnoteExitCh`, `markerAtCursor`,
`tableRowCellSpans`, `resolveTableCellCursor`.
Probe: offset 0, offset == length, offset > length; surrogate pairs (emoji)
and combining characters around the cursor; empty string; word at end of
line; punctuation-only words; tabs; cells containing escaped pipes at the
span boundary.

### properties
Targets: `reindexFootnotes`, `tidyFootnotes`, `moveFootnoteDefinitionsToBottom`,
`footnoteAfterPunctuation`.
Probe these invariants on adversarial docs (build ~20 nasty docs mixing the
taxonomy rows and hand-check the interesting ones):
- idempotence: `f(f(doc)) === f(doc)` for each transform and for tidy's
  composition
- content preservation: transforms may reorder/renumber but must never drop
  or duplicate non-footnote text (compare the multiset of non-footnote lines)
- marker/definition pairing is preserved: every marker still resolves to the
  same *body text* after reindex
- reindex then tidy vs tidy then reindex — if results differ, is that
  intended?

### interactions
Probe pairs the other lenses treat separately: prefix × reindex (does
reindexing a prefixed doc respect the prefix? mixed prefixed/unprefixed
markers?); reindex × protected contexts (marker in code fence must survive
untouched); move-to-bottom × section header (does the header stay attached?);
tidy × CRLF; named + autonumbered markers in one doc; settings combinations
via `reindexOptionsFromSettings`/`tidyOptionsFromSettings` (each flag off/on).

### regressions
Re-read the closed-bug tests in `test/` (colon-in-name, ignore-code-blocks,
detail-append, footnote-prefix, marker-at-cursor...) and write *harder*
variants of each — the original fix often handles the reported case and
nothing else. The taxonomy table's "what to mutate" column is the worklist.
