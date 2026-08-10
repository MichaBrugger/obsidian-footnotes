# Attack surface — obsidian-footnotes

Last verified against the code: 2026-08-10 (commit fa493c6). Second full
sweep added 24 confirmed-bug pins + 7 spec-question pins in test/hunt/
(bug-*.test.ts / spec-*.test.ts, all it.fails) covering: case-sensitive
prefix scanning, masked-name identity beyond the listing fix, YAML-comment
prefix parsing, HTML-comment boundary/short-form/mask-order/opener classes,
blockquote+list fence containers, reindex cap/cycle/stranded-frontmatter,
astral word-walk, table escape offsets, unsafe-integer autonumbering,
escaped markers, inline-footnote double-parsing, reading-view deferred lint.
If `git log` shows newer feature commits, treat their modules as prime
hunting ground and update this file at the end of the hunt.

## Module map

Pure modules (unit-probeable, the hunt's home turf):

| Module | Key exports | What it owns |
| --- | --- | --- |
| `src/markdown-scan.ts` | `DefinitionStart`, `normalizeEol`, `restoreEol`, `protectedLines`, `maskInlineCode`, `maskCommentSpans`, `maskInlineRegions`, `maskProtectedLines`, `maskedLineAt`, `removeLineRanges`, `findDefinitionBlocks` | Deciding which lines/spans are "protected" (code fences, inline code, HTML comments) and locating definition blocks. Known gaps (pinned): math regions and indented code are NOT protected; container-aware fences (blockquote/list) are broken in both directions |
| `src/insert-or-navigate-footnotes.ts` (1283 lines — the big one) | `AllMarkers`, `footnoteMarkerMatches`, `ExtractNameFromFootnote`, `isValidFootnoteName`, `readingViewActive`, `listExistingFootnoteDetails`, `listExistingFootnoteMarkersAndLocations`, `shouldJumpFromDetailToMarker`, `markerAtCursor`, `shouldJumpFromMarkerToDetail`, `jumpToFootnoteDetail`, `addFootnoteSectionHeader`, `buildDetailAppend`, `endOfWordOffset`, `footnotePrefix`, `footnotePrefixFromEditor`, `footnotePrefixProblem`, `computeNextFootnoteNumber`, `shouldCreateAutonumFootnote`, `sanitizeInlineFootnoteContent`, `inlineFootnoteSpanAt`, `inlineFootnoteExitCh`, `navigateMarkerIfInside`, `shouldCreateMatchingFootnoteDetail`, `warnPrefilledMarkerIfInside`, `warnEmptyMarkerIfInside`, `shouldCreateFootnoteMarker` | Marker grammar, autonumbering, insertion points, inline-footnote handling, prefix parsing |
| `src/linting/rules/re-index-footnotes.ts` | `reindexFootnotes`, `ReindexOptions` | Renumbering markers + definitions in reading order (fixpoint loop, 20-iteration cap) |
| `src/linting/linter.ts` | `lintFootnotes`, `LintOptions`, `reindexOptionsFromSettings`, `lintOptionsFromSettings`, `lintRulesAllDisabled`, `countEmptyFootnoteMarkers`, `lintBlockedByPrefix`, auto-lint triggers (`installLintOnSave`, `installVimWriteHook`, `lintAfterFootnoteCreation`, `runFootnoteTransformCommand`) | Composed lint pipeline + editor runner + save/vim/creation triggers |
| `src/linting/rules/apply-footnote-prefix.ts` | `applyFootnotePrefix`, `applyFootnotePrefixRule` | Rewriting plain numbered ids into the note's prefix namespace |
| `src/linting/rules/move-footnotes-to-the-bottom.ts` | `moveFootnoteDefinitionsToBottom` | Relocating definition blocks |
| `src/linting/rules/footnote-after-punctuation.ts` | `footnoteAfterPunctuation` | Swapping marker/punctuation order |
| `src/linting/ignore-types.ts` | `IgnoreType`, `applyIgnored` | Linter-parity mask/restore vocabulary (declaration-only so far — transforms still self-protect via markdown-scan; `IgnoreType.Math` is declared but NOT enforced anywhere) |
| `src/table-cursor.ts` | `activeTableCellEditor`, `tableRowCellSpans`, `resolveTableCellCursor` | Escape-aware table cell spans |
| `src/obsidian-internals.ts` | types only (`ObsidianEditorView`, `EditorWithCm`, `MarkdownEmbed`, `AppWithEmbedRegistry`, ...) | Cast targets for Obsidian private APIs |

Editor-bound (needs the live app — report hypotheses, don't probe):
`src/footnote-popup.ts` (embedRegistry popup), `src/main.ts` (command wiring),
`src/settings.ts` (settings tab + migrations), `src/set-footnote-prefix.ts`
(modal), parts of insert-or-navigate that take an `Editor`
(`runOutsideTableCell`, `insertInTableCell`, `jumpToFootnoteDetail`).

Key grammar facts to test against:

- Marker: `AllMarkers = /\[\^([^[\]]+)\]/g` — NO `(?!:)` lookahead since
  2026-08; definition-prefix filtering lives in `footnoteMarkerMatches`.
  Names exclude `[` and `]` but allow nearly everything else (including
  backticks/comment delimiters — masked-vs-raw identity traps).
- Definition: `DefinitionStart = /^\[\^([^[\]]+)\]:/` — column 0 only
  (blockquoted/callout definitions invisible to every scan).
- `isValidFootnoteName` rejects names with spaces (warns via Notice).
- Autonumber markers are plain integers, optionally behind a user prefix
  (`footnote-prefix` frontmatter property, **off by default** behind the
  `footnote-prefix` settings toggle). Prefix matching is supposed to be
  case-INSENSITIVE (Obsidian folds ids) — check every dynamic regex for /i.
- `footnotePrefix` is a hand-rolled YAML-subset reader — probe it against
  real YAML semantics (comments, quotes, duplicate keys, no-space colons).

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
| #55 | details appended at EOF not after block | placement: multiple definition blocks, definitions above markers, section header present/absent/duplicated, unclosed fence/comment at EOF |
| 6732fdb | prefix collisions | prefix × everything: prefix that is itself numeric ("12"), prefix equal to an existing name, prefix with regex metacharacters (`.`,`+`,`(`), empty-string prefix, prefix/marker case variants |
| 2026-08-10 | masked-name identity | names with code/comment spans: every path that reads a name from a MASKED line must re-slice the original (listing + applyFootnotePrefix fixed; press paths + reindex pinned unfixed) |
| 2026-08-10 | HTML comment boundaries | multi-line comment opener/closer lines: text before `<!--` / after `-->` is live; short forms `<!-->`/`<!--->` are complete comments; backticked/escaped openers are not openers; mask ordering (code before comment) |
| 2026-08-10 | container fences | a fence's closer must match its container: `> ``` ` can't close a doc-level fence; a quoted fence dies with its quote; list-item fences (`- ``` `) invert protection |
| 2026-08-10 | reindex fixpoints | idempotence vs the 20-iteration cap (21+-deep orphan chains), genuine cycles (defs split by marker lines + cyclic body refs), composition-order dependence |
| 2026-08-10 | line-0 residue | cutting content at line 0 can strand `---` at document start → manufactured frontmatter swallows live prose; blockquoted residue (`> ---`) renders as a quoted setext heading |

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
