# Attack surface — obsidian-footnotes

Last verified against the code: 2026-08-25 (post skills-refactor sweep).
Third full sweep (2026-08-25, all six lenses + per-finding skeptics with
micromark/@codemirror-state ground truth) added 7 confirmed-bug pins
(11 it.fails tests): code-span-in-name hides a real definition
(bug-code-span-name-hides-definition — mask runs before label carving;
real parsers carve the label FIRST), fenced code inside definition
continuations unprotected → orphan deletion eats code text
(bug-definition-continuation-fence-unprotected — fences lack the
definition-relative content-indent that listStack gives lists, while
comment/math openers are indent-insensitive there), inline-wrap CLOSE
bracket never liveness-checked in any inline entry point
(bug-inline-wrap-close-swallowed — emergent `$…$` swallows the closer),
simulateChanges same-from tie drops a character vs real CM6 semantics
(bug-simulate-changes-tie-drops-text — insert-before-replace, no loss;
real transactions are fine, but born-dead verdicts/cursor landings use
the corrupt simulation, and the shared test fake applies edits through
it BY DESIGN), nested-alert name dedupe missing
(bug-nested-alert-duplicate-names), mixed drag-selection + collapsed
caret silently drops the caret (bug-mixed-selection-extra-caret-dropped
— the 2026-08-22 ruling never covered the mixed shape), and rename to a
bare id silently swept back by apply-prefix
(bug-rename-swept-back-by-apply-prefix — planFootnoteRename is
prefix-blind). TWO PROBE-ERROR lessons worth keeping: (1) for
`[^a\`]:\`x]` the RAW side is CORRECT and the masked twin fabricates a
phantom reference — masking a char to NUL can only EXTEND a `[^…]`
match, so raw-vs-masked divergence does not automatically mean the raw
gate is wrong (referenceOccurrenceAtCursor's raw gate doubles as a
phantom guard; its "pure perf" comment overclaims); (2) the shared
test fake (test/helpers/fake-editor.ts) applies transactions through
simulateChanges, so a simulateChanges bug shows up as fake-document
"corruption" that real CM6 would not produce — always cross-check
command-level corruption claims against @codemirror/state.
Cleared clean this sweep: regressions lens (all 2026-08-25 extractions
— referenceOccurrenceAtCursor, definitionLabelWithName,
verifyLiveFootnoteInsertion, the landing helpers — carry their moved
fixes at every entry point), fence info-string/tilde interleaving, EOF
protected regions, lint pipeline ordering/idempotence on 16 adversarial
docs, multi-line conversion bodies × full lint pipeline, conversion ×
prefix × creation-lint.
Second full sweep (2026-08-10) added 24 confirmed-bug pins + 7
spec-question pins covering: case-sensitive prefix scanning, masked-name
identity beyond the listing fix, YAML-comment prefix parsing,
HTML-comment boundary/short-form/mask-order/opener classes,
blockquote+list fence containers, reindex cap/cycle/stranded-frontmatter,
astral word-walk, table escape offsets, unsafe-integer autonumbering,
escaped references, inline-footnote double-parsing, reading-view deferred lint.
If `git log` shows newer feature commits, treat their modules as prime
hunting ground and update this file at the end of the hunt. Post-2026-08-25
module changes to know: the raw-gate/masked-confirm lookup lives in
`referenceOccurrenceAtCursor` (doc-context), the label twin in
`definitionLabelWithName` (footnote-grammar), the born-dead verdict in
`verifyLiveFootnoteInsertion` (insertion-liveness), landings in
`landDefinitionBackedInsertion`/`landCellDefinitionAppend`
(create-footnote), the auto-lint gate in `safeLintTarget` (linter), and
the three modals share `ValidatedTextModal`. Lint-on-creation now fires
for single-caret, multi-caret, AND selection conversions (cells never).

## Module map

Pure modules (unit-probeable, the hunt's home turf):

| Module | Key exports | What it owns |
| --- | --- | --- |
| `src/parsing/markdown-scan.ts` | `DefinitionStart`, `normalizeEol`, `restoreEol`, `protectedLines`, `scanDocument`, `maskLineRegions`, `maskInlineRegions`, `maskProtectedLines`, `maskedLineAt`, `removeLineRanges`, `findDefinitionBlocks`, `definitionLabelIn` | ONE CommonMark-ordered scanner deciding which lines/spans are "protected" (fences with container depth, inline code, HTML comments incl. short forms, `$…$`/`$$…$$` math, indented code with a list content-indent stack, frontmatter) and locating definition blocks (region-absorbing end walk). The 2026-08-10 hunt-era gaps (math, indented code, container fences/regions, loose lists) are all FIXED and pinned — plus mutation-hardened (`test/mutation-hardening-scan.test.ts`) |
| `src/parsing/footnote-grammar.ts` (LEAF) | `AllReferences`, `ExtractNameFromFootnote`, `footnoteReferenceMatches`, `referenceOccurrences` (the ONE masked-match/raw-name iterator), `isValidFootnoteName`, `idListIncludes`, `referenceAtCursor`, `emptyReferenceStart`, `computeNextFootnoteNumber` | The reference grammar + autonumber scan; imports only markdown-scan |
| `src/parsing/footnote-prefix.ts` | `footnotePrefix`, `footnotePrefixFromEditor`, `footnotePrefixProblem`, `activeFootnotePrefix` | Hand-rolled YAML-subset prefix parsing + validity + settings-aware resolver |
| `src/editor/doc-context.ts` | `DocContext`/`docContext`, `docLines`, `listExistingFootnoteDefinitions` | One per-press lazy-masked document view + the definition listing (readingViewActive moved to obsidian-internals; the reference lister died production-dead, 2026-08-11) |
| `src/editor/cursor-motion.ts` | `moveCursorAndSetJumpPoint` (vim jumplist, single-transaction edits), `endOfWordOffset`, `adjustFootnotePosition` (end-of-word + safeInsertionCh nudge) | Caret placement + insertion-point adjustment |
| `src/editor/insertion-liveness.ts` | `ProtectedCreationNotice`, `safeInsertionCh`, `simulatedMaskedLine`, `simulateChanges`, `caretInsideMaskedSpan` | The born-dead safety kit: will inserted text still MEAN what it says? Escape/caret swallows, completed `$…$` pairs, reclassification — every failure mode found by the command-press property suite (2026-08-12) |
| `src/commands/press-guards.ts` | `caretGuardsHandled`, `warnProtectedCaretIfInside`, `warnDefinitionCaretIfInside`, `warnPrefilledReferenceIfInside` | A press was made — does something other than creation own it? Placeholder warnings, protected-caret refusal (Jason's 2026-08-12 rule), definition-interior refusal (2026-08-13: no footnotes inside definitions; the inline pair runs the full shouldJumpFromDefinitionToReference at its entries instead — navigateDefinitionLabelIfInside is gone) |
| `src/commands/definition-append.ts` | `addFootnoteSectionHeader`, `buildDefinitionAppend` (returns an optional phantom-frontmatter `prepend`) | Where a new definition lands |
| `src/commands/inline-footnotes.ts` | `sanitizeInlineFootnoteContent`, `inlineFootnoteSpanAt`, `inlineFootnoteExitCh`, `warnEmptyInlineFootnoteIfInside`, `exitInlineFootnoteIfInside` | Inline "^[...]" grammar + caret guards |
| `src/commands/navigation.ts` | `shouldJumpFromDefinitionToReference`, `shouldJumpFromReferenceToDefinition`, `jumpToFootnoteDefinition` | The jump half of the cascade; imports the popup, never the linter |
| `src/commands/create-footnote.ts` (the ONLY module importing linting/linter besides main-path wiring) | `createAutonumFootnote`, `createMatchingFootnoteDefinition`, `createFootnoteReference` (unified 2026-08-11: `(lineText, cursorPosition, plugin, doc, …) → boolean "handled"`), `insertInTableCell` (returns false on a refused, born-dead insertion) | The creation steps, each simulate-verified against insertion-liveness before any edit |
| `src/commands/insert-or-navigate-footnotes.ts` (~300 lines — thin cascade wiring) | the four command entries, `navigateReferenceIfInside` | Command entries + shared preamble (`withEditableEditor` — MUST stay continuation-passing: a value-returning helper adds a microtask hop that let a same-tick second press mint a second footnote, 63bc025). The 2026-08-11 split (see .claude/plans/split-insert-or-navigate.md) made the whole src graph ACYCLIC (madge + .madgerc verify; FootnotePlugin imports are type-only); the 2026-08-12 split carved guards/liveness/creation out |
| `src/commands/selection-footnote.ts` | `selectionPressHandled`, `SelectionSpanNotice`, `SelectionCommandNotice` | Issue #35 (2026-08-12): a creation press with a live selection converts it — autonum moves the text into a seeded definition body, inline wraps it as `^[…]` in place; named/paste redirect. Single-line only; whitespace trims back into prose; protected spans refuse UP FRONT (a selection eating a fence delimiter makes a live-looking result out of destroying the construct — found by the conversion property). Runs before every caret guard in all four entries |
| `src/commands/rename-footnote.ts` | `renameTargetAtCursor`, `planFootnoteRename`, `renameFootnote`, `RenameTargetNotice` | Issue #36 (2026-08-12): rename-symbol for footnotes — every masked-live occurrence (references + definition labels, case-insensitive) rewritten in one planned transaction. Collisions refuse (merging is the lint's job), invalid names refuse with the reason, and the plan simulate-verifies the WHOLE document's footnote structure (occurrence lists shift-adjusted per line, block start/name pairs) — a name that completes a construct ("a<!--") renames NOTHING. Modal is DOM territory; the two planners are pure |
| `src/linting/rules/re-index-footnotes.ts` | `reindexFootnotes`, `ReindexOptions` | Renumbering references + definitions in reading order (fixpoint loop, 30-iteration cap, cycle canonicalization) |
| `src/linting/linter.ts` | `lintFootnotes`, `LintOptions`, `reindexOptionsFromSettings`, `lintOptionsFromSettings`, `lintRulesAllDisabled`, `lintBlockedByPrefix`, auto-lint triggers (`installLintOnSave`, `installVimWriteHook`, `lintAfterFootnoteCreation`, `runFootnoteTransformCommand`) | Composed lint pipeline + editor runner + save/vim/creation triggers |
| `src/linting/lint-alerts.ts` | `noticeLintAlerts`, `countEmptyFootnoteReferences`, `orphanSafePrefixFor` | The post-lint alert tail (empty placeholders, orphans, duplicates — never silent), sharing ONE normalize/scan/mask |
| `src/linting/rules/merge-duplicate-definitions.ts` | `mergeDuplicateFootnoteDefinitions`, `duplicateFootnoteDefinitionNames` | Later duplicate definitions merge into the first as indented continuations (Obsidian renders only the LAST — ground truth 2026-08-12) |
| `src/linting/rules/apply-footnote-prefix.ts` | `applyFootnotePrefix`, `applyFootnotePrefixRule` | Rewriting plain numbered ids into the note's prefix namespace |
| `src/linting/rules/move-footnotes-to-the-bottom.ts` | `moveFootnoteDefinitionsToBottom` | Relocating definition blocks |
| `src/linting/rules/footnote-after-punctuation.ts` | `footnoteAfterPunctuation` | Swapping reference/punctuation order |
| `src/editor/table-cursor.ts` | `activeTableCellEditor`, `tableRowCellSpans`, `resolveTableCellCursor` | Escape-aware table cell spans |
| `src/editor/obsidian-internals.ts` | types (`ObsidianEditorView`, `EditorWithCm`, `MarkdownEmbed`, `AppWithEmbedRegistry`, ...) plus `viewEditor`, `readingViewActive`, `ensureTextPropertyType` | Cast targets + view-reality guards for Obsidian private APIs |

Editor-bound (needs the live app — report hypotheses, don't probe):
`src/commands/footnote-popup.ts` (embedRegistry popup), `src/main.ts` (command wiring),
`src/settings.ts` (settings tab + migrations), `src/commands/set-footnote-prefix.ts`
(modal), parts of insert-or-navigate that take an `Editor`
(`runOutsideTableCell`, `insertInTableCell`, `jumpToFootnoteDefinition`).

Key grammar facts to test against:

- Reference: `AllReferences = /\[\^([^[\]]+)\]/g` — NO `(?!:)` lookahead since
  2026-08; definition-prefix filtering lives in `footnoteReferenceMatches`.
  Names exclude `[` and `]` but allow nearly everything else (including
  backticks/comment delimiters — masked-vs-raw identity traps).
- Definition: `DefinitionStart = /^\[\^([^[\]]+)\]:/` — column 0 only
  (blockquoted/callout definitions invisible to every scan).
- `isValidFootnoteName` rejects names with spaces (warns via Notice).
- Autonumber references are plain integers, optionally behind a user prefix
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
| #56 | duplicate references of same footnote | multiplicity: duplicate *definitions*, reference with no definition, definition with no reference, self-referencing definition |
| #39 | null deref (`reading 'data'`) | empty/degenerate inputs: empty doc, doc of only references, only definitions, single char, trailing newline vs none |
| #17 | insert next to existing reference | adjacency: cursor inside/at-edge-of reference, two adjacent references, reference at line start/end |
| #28 | tables broke insertion | structure contexts: cell edges, escaped pipes `\|`, reference split by formatting |
| aeb3391 | dangling backslashes in inline content | escaping: `\]`, `\\`, backslash at end, pre-escaped brackets, pipe in table context |
| #55 | definitions appended at EOF not after block | placement: multiple definition blocks, definitions above references, section header present/absent/duplicated, unclosed fence/comment at EOF |
| 6732fdb | prefix collisions | prefix × everything: prefix that is itself numeric ("12"), prefix equal to an existing name, prefix with regex metacharacters (`.`,`+`,`(`), empty-string prefix, prefix/reference case variants |
| 2026-08-10 | masked-name identity | names with code/comment spans: every path that reads a name from a MASKED line must re-slice the original (listing + applyFootnotePrefix fixed; press paths + reindex pinned unfixed) |
| 2026-08-10 | HTML comment boundaries | multi-line comment opener/closer lines: text before `<!--` / after `-->` is live; short forms `<!-->`/`<!--->` are complete comments; backticked/escaped openers are not openers; mask ordering (code before comment) |
| 2026-08-10 | container fences | a fence's closer must match its container: `> ``` ` can't close a doc-level fence; a quoted fence dies with its quote; list-item fences (`- ``` `) invert protection |
| 2026-08-10 | reindex fixpoints | idempotence vs the 20-iteration cap (21+-deep orphan chains), genuine cycles (defs split by reference lines + cyclic body refs), composition-order dependence |
| 2026-08-10 | line-0 residue | cutting content at line 0 can strand `---` at document start → manufactured frontmatter swallows live prose; blockquoted residue (`> ---`) renders as a quoted setext heading |

## Lens checklists

### grammar
Blind spots caught only by an out-of-band hunt on 2026-07-17 — always cover
these three: **case-folding** (Obsidian treats footnote ids case-insensitively
and `footnote-popup.ts` lowercases, but other comparisons are case-sensitive —
probe `[^Note]` vs `[^note]` through every scan/jump/reindex path, including
orphan deletion: worst case is silent data loss); **degenerate `[^]`** (empty
name never matches `AllReferences`, so navigation misses it and a second hotkey
press nests references); **unicode word/grapheme boundaries** (`endOfWordOffset`
uses bare `\w` — probe combining marks, precomposed accents, CJK).

Targets: `AllReferences`, `ExtractNameFromFootnote`, `DefinitionStart`,
`isValidFootnoteName`, `listExistingFootnoteDefinitions`,
`listExistingFootnoteReferencesAndLocations`, `computeNextFootnoteNumber`.
Probe: name alphabets from the taxonomy; `[^1]:` vs `[^1] :`; definition
continuation lines (indented follow-ups); a definition whose body contains
another reference; references straddling bold/italic (`**[^1]**`); `[^]` (empty
name); very long names; names with regex metacharacters when later fed into
dynamic regexes (search the source for `new RegExp` — unescaped
interpolation is a classic here).

### contexts
Targets: `protectedLines`, `maskInlineCode`, `maskProtectedLines`,
`removeLineRanges`, and every caller that respects them.
Probe: everything in the #41 class row above, plus: fence info strings
(```` ```python ````), four-space-indented code, inline code with double
backticks, protected region at very start/end of doc, CRLF line endings,
a reference on the same line as a fence delimiter.

### offsets
Targets: `endOfWordOffset`, `inlineFootnoteExitCh`, `referenceAtCursor`,
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
- reference/definition pairing is preserved: every reference still resolves to the
  same *body text* after reindex
- reindex then tidy vs tidy then reindex — if results differ, is that
  intended?

### interactions
Probe pairs the other lenses treat separately: prefix × reindex (does
reindexing a prefixed doc respect the prefix? mixed prefixed/unprefixed
references?); reindex × protected contexts (reference in code fence must survive
untouched); move-to-bottom × section header (does the header stay attached?);
tidy × CRLF; named + autonumbered references in one doc; settings combinations
via `reindexOptionsFromSettings`/`tidyOptionsFromSettings` (each flag off/on).

### regressions
Re-read the closed-bug tests in `test/` (colon-in-name, ignore-code-blocks,
definition-append, footnote-prefix, reference-at-cursor...) and write *harder*
variants of each — the original fix often handles the reported case and
nothing else. The taxonomy table's "what to mutate" column is the worklist.
