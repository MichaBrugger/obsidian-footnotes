# Attack surface, obsidian-footnotes

Last verified against the code: 2026-09-13 (after the 0.2.0 release, and
after the six-lens-plus-eleven-row sweep of the same day).
Pins so far: 107 `bug-*.test.ts` and 31 `spec-*.test.ts` files in
`test/hunt/` from four sweeps (2026-07-17, 2026-08-10, 2026-08-25,
2026-09-13) plus the manual passes of September. The 2026-09-13 sweep left
29 new bug pins and 19 new spec pins, all still expected-fail, waiting on
Jason's fix list for 0.2.1. Two older pins are expected-fail and ruled on: `bug-moved-definition-adopts-
indented-code` (move-to-bottom parks a definition above an indented code
chunk, which Obsidian then reads as the definition's body) and the
cross-line inline code span in `spec-questions` (Obsidian renders a
backtick run across a line break as one code span; the scanner masks per
line). Leave both alone.

## Changed since the last sweep (2026-08-25 to 2026-09-13)

Every row below got its own hunter on 2026-09-13 on top of the six lenses
(17 hunters, 25 skeptics, about 50 probe files). The pins that came out of
each row are listed in the taxonomy under 2026-09-13. The rows stay here
as the map of what changed; the next sweep should treat them as ordinary
ground and put its weight on whatever changes after 2026-09-13.

| Change | Where | What to attack |
| --- | --- | --- |
| **Prose-label rule.** A `[^x]:` directly under a paragraph line, list item, quote line, table row, or `%%` comment-only line is a *lazy label*: paragraph text to Obsidian, not a definition. Its own `[^x]` is a live reference. A label starts a definition after a blank line, a heading, a rule, a closed fence, a callout title line, another definition, or at the top of the note. Labels indented one to three spaces are definitions; four is code. | `definitionStartLines`, `lazyDefinitionLabelLines` (markdown-scan); `DocContext.definitionStarts()`; `referenceOccurrences(line, masked, labelIsDefinition)` (footnote-grammar) | Every reader of the reference set that must know which labels are real: reindex, orphans, rename, selection, alerts. Containers: a label under a quoted paragraph, under a list continuation, under a table's last row, under a callout body line, after an HTML-comment line (which is a block, so the label under it is a definition). |
| **Fix-lazy-definitions rule** (new, first in the pipeline, on by default) inserts the blank line a lazy label needs; move-to-bottom then gathers it. With the rule off, an alert names the labels. | `fixLazyDefinitions`, `fixLazyDefinitionsRule` (rules/fix-lazy-definitions), `lint-alerts` | Idempotence; interaction with move-to-bottom, reindex, orphan deletion, the section heading; a lazy label whose "fix" changes what the line above means (setext heading, table, list). |
| **`%%` comments** read the way Obsidian reads them: a reference inside a comment, inline or block, is real (binds, takes a number); a definition inside a `%%` block is dead; nothing inside a block comment is moved, renamed, or fixed; the definition append never lands inside an unclosed block. A comment-only `%% c %%` line is a paragraph line. | `scanDocument` (`inCommentBlock`, `commentBlockCloseAt`, `endsProtected`), the linter's rules, `rewriteFootnoteNames`, `buildDefinitionAppend` | Openers and closers mid-line, inside definition bodies, inside blockquotes and list items (a quoted block ends with its quote), unclosed at end of note, a label directly under a bare closer (a definition), an indented closer inside a continuation. The differential oracle recuses `%%` documents, so nothing automated has cross-checked these. |
| **Minimal write-back.** Every lint trigger writes only the characters that changed, line by line (an LCS over lines, trimmed to differing characters), then restores folds through an offset map. | `lineDiffChanges`, `mapFoldLines` (editor/document-diff); `replaceMinimal` in linter | Lints that delete, insert, and move lines in one pass; duplicate lines; CRLF; folds that straddle a moved definition or a deleted line; a fold whose whole range is replaced. |
| **Landing convention.** A reference inserted at the end of a word steps past every closing mark after it (quotes straight and curly, brackets, emphasis and highlight markers, a markdown link's `(url)` as a whole) and the punctuation after those. The punctuation lint rule follows the same walk and leaves a reference already placed after a closing mark alone. | `referenceLandingAfter`, `ClosingMarkChars`, `TrailingPunctuationChars` (markdown-scan); `endOfWordOffset`, `adjustFootnotePosition` (cursor-motion); `footnoteAfterPunctuation` | Stacked closers, CJK punctuation, a link whose `(url)` contains parentheses, emphasis that opens but never closes, end of line, a closer that is also an opener (`*`), a caret already after the punctuation. |
| **Selections.** A whole table selected edge to edge (with or without surrounding blank lines) converts; a partial table refuses. Only a fence-first body starts under an empty label line (`[^6]:` then the fence); headings, tables, quotes, rules, and math sit on the label line. A selection that swallows the section heading writes the definition after it, not inside. Leading spaces are absorbed. Cell selections are a named type with offsets into the cell text. | `selectionPressHandled`, `convertSelectionToNamed`, `convertCellSelectionToNamed`, `absorbLeadingSpace`, `CellSelection` (selection-footnote); `cellSelection`, `cellCaret` (table-cursor) | Selections touching a fence delimiter, a table edge, a definition label, the heading; a selection that is exactly a blank line; multi-selection paste (redirects with its own message). |
| **Rename reads the selection.** A reference or a definition label the selection overlaps is the target (a phone's long press selects the word first). A label inside a `%%` block is no target; a lazy label's own `[^x]` is. Rename adds the note's prefix when the apply-prefix lint rule is on. | `renameTargetInSelection`, `renameTargetAtCursor`, `planFootnoteRename` (rename-footnote); `rewriteFootnoteNames` | Selections spanning two references, ends in either order, a selection that touches only a bracket, names that are prefixes of other names (`[^a]` and `[^ab]`), a name appearing inside a code span on the same line as a real reference. |
| **Popup routing.** A footnote defined more than once jumps to the last definition, the one Obsidian renders, instead of opening the popup on the first. | `popupRouteFor`, `definedMoreThanOnce` (navigation) | Duplicates split across a callout and column 0, a duplicate inside a `%%` block (dead) or a fence (dead), case variants of one name. |
| **Undo notice.** The partial-undo notice names what is left and promises a second undo only when the plugin split a creation into two steps (a table-cell creation by the numbered key). | `noteSplitCreation`, `undoOrphanMessage`, `orphanedByUndo` (editor/undo-orphan-notice) | Pure functions: orphan sets after an undo, the message for one versus several references, names with prefixes. |
| **Orphan rules** are two standalone rules now, each a graph pass independent of reindex; a definition with no reference is deleted or alerted, a reference with no definition likewise. Lazy labels feed `lazyDefinitionLabelNames`. | rules/remove-orphaned-definitions, rules/remove-orphaned-references | A reference whose only definition is lazy or commented; a definition whose only reference sits in a `%%` comment (live) or a fence (dead); case variants. |
| **Rule catalogue and memo.** The pipeline calls each rule through `footnoteRules` in catalogue order (pinned), and `rewriteDocument` keeps a one-entry memo while an outer call runs. | rules/index, rule, rewrite-document (`DocumentView`) | Order dependence: run rules in every pair order and compare; a rule that reads a stale view after another rule wrote. |

## Module map

Pure modules (unit-probeable, the hunt's home turf):

| Module | Key exports | What it owns |
| --- | --- | --- |
| `src/parsing/markdown-scan.ts` | `scanDocument` (`DocumentScan`: `isProtected`, `inCommentBlock`, `commentBlockCloseAt`, `endsProtected`, `endsProtectedAt`, `startsIn*`), `maskLineRegions`, `maskInlineRegions`, `maskProtectedLines`, `maskedLineAt`, `maskLineWithScan`, `protectedLines`, `removeLineRanges`, `definitionStartLines`, `lazyDefinitionLabelLines`, `findDefinitionBlocks`, `definitionLabelIn`, `definitionLabelWithName`, `findLineRunEnd`, `referenceLandingAfter`, `ClosingMarkChars`, `TrailingPunctuationChars`, `normalizeEol`, `restoreEol` | ONE CommonMark-ordered scanner: which lines and spans are protected (fences with container depth, inline code, HTML comments including short forms, `$…$` and `$$…$$` math with the digit-after-closer rule, indented code with a list content-indent stack, frontmatter, `%%` block comments), which labels start definitions, where definition blocks end, and where a reference lands after a word. |
| `src/parsing/footnote-grammar.ts` (leaf) | `AllReferences`, `footnoteReferenceMatches(line, labelIsDefinition)`, `referenceOccurrences(line, masked, labelIsDefinition)` (the ONE masked-match, raw-name iterator), `occurrenceAtCursor`, `referenceAtCursor`, `emptyReferenceStart`, `escapedAt`, `isValidFootnoteName`, `footnoteNameProblem`, `InvalidNameCharacters`, `computeNextFootnoteNumber`, `idListIncludes`, `quotedReference`, `quotedDefinitionLabel` | The reference grammar and autonumber scan; imports only markdown-scan. |
| `src/parsing/footnote-prefix.ts` | `footnotePrefix`, `footnotePrefixFromEditor`, `footnotePrefixProblem`, `activeFootnotePrefix` | Hand-rolled YAML-subset prefix reader (the value is read literally; a YAML comment after it makes the value invalid), validity (no digit ending, no invalid name characters), settings-aware resolver. |
| `src/editor/doc-context.ts` | `docContext` (`DocContext`: `lines`, `scan`, `maskedLine`, `maskedLines`, `definitionStarts`, `blocks`), `docLines`, `listExistingFootnoteDefinitions`, `referenceOccurrenceAtCursor` | One per-press lazily masked document view; the raw-gate, masked-confirm caret lookup. |
| `src/editor/cursor-motion.ts` | `endOfWordOffset`, `startOfWordOffset`, `adjustFootnotePosition`, `moveCursorAndSetJumpPoint`, `comparePositions` | Caret placement, insertion-point adjustment through the landing convention, vim jump points. |
| `src/editor/insertion-liveness.ts` | `safeInsertionCh`, `simulatedMaskedLine`, `simulateChanges`, `simulatedAnchor(s)`, `caretInsideMaskedSpan`, `verifyLiveFootnoteInsertion`, `ProtectedCreationNotice` | The born-dead safety kit: will inserted text still mean what it says? `simulateChanges` is refereed by a real @codemirror/state ChangeSet in tests. |
| `src/editor/document-diff.ts` | `lineDiffChanges`, `mapFoldLines`, `OffsetChange`, `FoldRange` | The minimal lint write-back and fold restoration. |
| `src/editor/table-cursor.ts` | `activeTableCellEditor`, `tableRowCellSpans`, `resolveTableCellCursor`, `cellCaret`, `cellSelection`, `tableRowLines`, `resolvedCaret`, `runOutsideTableCell`, `nestedSubEditorOwnsFocus` | Escape-aware table cell spans; the cell's caret and selection clamped to its text. |
| `src/editor/undo-orphan-notice.ts` | `orphanedByUndo`, `stillOrphanedNames`, `noteSplitCreation`, `undoOrphanMessage`, `undoOrphanNoticeExtension` | The partial-undo notice and the split-creation registry. |
| `src/editor/notice.ts` | `showNotice`, `noticeSegments`, the message constants | Every toast's wording (quoted names never wrap). |
| `src/commands/press-guards.ts` | `caretGuardsHandled`, `warnProtectedCaretIfInside`, `warnDefinitionCaretIfInside`, `warnPrefilledReferenceIfInside` | A press was made: does something other than creation own it? Protected-caret refusal, definition-interior refusal, placeholder warnings. |
| `src/commands/definition-append.ts` | `buildDefinitionAppend`, `seedDefinitionBody` | Where a new definition lands: after the last definition block, under the section heading, never inside an unclosed fence or comment; the cell path rebuilds its context after the cell edit. |
| `src/commands/inline-footnotes.ts` | `sanitizeInlineFootnoteContent`, `inlineFootnoteSpanAt`, `inlineFootnoteExitCh`, `insertionLandsIntact`, `inlineWrapLandsIntact`, `warnEmptyInlineFootnoteIfInside`, `exitInlineFootnoteIfInside`, `readInlineFootnoteFromClipboard` | Inline `^[…]` grammar, caret guards, clipboard flattening and escaping. |
| `src/commands/navigation.ts` | `shouldJumpFromDefinitionToReference`, `shouldJumpFromReferenceToDefinition`, `jumpToFootnoteDefinition`, `popupRouteFor`, `definedMoreThanOnce` | The jump half of the cascade and the popup-or-jump decision. |
| `src/commands/create-footnote.ts` | `createAutonumFootnote`, `createMatchingFootnoteDefinition`, `createFootnoteReference`, `insertInTableCell`, `replaceInTableCell`, `landDefinitionBackedInsertion`, `landCellDefinitionAppend`, `autonumFootnoteId`, `referenceOrdinalAtCursor`, `positionAfterReference` | The creation steps, each simulate-verified before any edit; the only command module importing the linter. |
| `src/commands/multi-caret.ts` | `multiCaretPressHandled`, `multiCaretPastePressHandled` | The multi-caret claim: same reference everywhere with one definition, skeletons for named and inline, one caret after the first reference; any caret in protected text refuses the whole press. |
| `src/commands/selection-footnote.ts` | `selectionPressHandled`, `convertSelectionToNamed`, `convertCellSelectionToNamed`, `absorbLeadingSpace`, `ConvertedSelection`, `CellSelection`, the notices | The selection claim: numbered moves the text into a seeded definition, inline wraps in place, named asks for a name; protected spans, partial tables, and selections containing a footnote refuse up front. |
| `src/commands/rename-footnote.ts` | `renameTargetAtCursor`, `renameTargetInSelection`, `planFootnoteRename` (`RenamePlan`: renamed, noop, invalid, collision, dead), `renameFootnote`, `registerRenameFootnoteMenu` | Rename-symbol for footnotes: every masked-live occurrence rewritten in one planned, simulate-verified transaction; collisions and invalid names refuse; the prefix is added when apply-prefix is on. |
| `src/commands/popup-retry.ts` | `retryUntilShown`, `popupCanBind`, `PopupRetryTiming`, `PopupRetryHooks` | The popup's cache-event-driven binding retry with the waiting notice. |
| `src/linting/linter.ts` | `lintFootnotes`, `LintOptions`, `lintOptionsFromSettings`, `lintRulesAllDisabled`, `lintBlockedByPrefix`, `installLintOnSave`, `installVimWriteHook`, `lintAfterFootnoteCreation`, `runFootnoteTransformCommand` | The composed pipeline, the minimal write-back with fold restore, and the three triggers (command, save and vim `:w`, footnote creation). |
| `src/linting/rules/*.ts` and `rules/index.ts` | `footnoteRules` (catalogue order): `fixLazyDefinitionsRule`, `footnoteAfterPunctuationRule`, `moveFootnotesToTheBottomRule`, `applyFootnotePrefixRule`, `removeOrphanedReferencesRule`, `removeOrphanedDefinitionsRule`, `mergeDuplicateDefinitionsRule`, `reIndexFootnotesRule`; each with its pure function | The rules. Reindex is a fixpoint loop with a 30-iteration cap and cycle canonicalization; merge keeps every body as indented continuations (Obsidian renders only the last definition otherwise). |
| `src/linting/rewrite-document.ts`, `rewrite-footnote-names.ts` | `rewriteDocument` (`DocumentView`), `rewriteFootnoteNames(line, masked, resolve, labelIsDefinition)` | The per-rule document view with its memo; the one name rewriter rename and reindex share. |
| `src/linting/lint-alerts.ts` | `noticeLintAlerts`, `countEmptyFootnoteReferences`, `invalidFootnoteNames`, `nestedFootnoteDefinitionNames`, `orphanSafePrefixFor` | The never-silent alert tail: placeholders, orphans, lazy labels, duplicates, invalid names, nesting. |
| `src/editor/obsidian-internals.ts` | types for Obsidian's private surfaces plus `viewEditor`, `readingViewActive`, `propertiesWidgetOwnsFocus`, `ensureTextPropertyType`, `commandHotkeys` | Cast targets and view-reality guards. |

Editor-bound (needs the live app; report hypotheses under "Needs a
live-editor probe"): `src/commands/footnote-popup.ts` (the embedded-editor
popup, its label metrics, the reading-view watchers), `src/main.ts`,
`src/settings.ts` (declarative settings and migrations),
`src/commands/set-footnote-prefix.ts` and `validated-text-modal.ts` (the
form-sheet dialogs), and the `Editor`-taking parts of table-cursor and
create-footnote.

## Key grammar facts to test against

- Reference: `AllReferences = /\[\^([^[\]]+)\]/g`; definition-prefix
  filtering lives in `footnoteReferenceMatches`, whose `labelIsDefinition`
  flag is what makes a lazy label's own `[^x]` count as a reference.
- Definition label: `[^name]:` at column 0 or indented one to three spaces
  (four is code), also behind a blockquote or callout marker (`> [^9]:`), and
  only where `definitionStartLines` says a definition may start.
- Names are case-insensitive. `isValidFootnoteName` rejects spaces, tabs,
  backticks, brackets, `#`, and `$`; the linter alerts on existing invalid
  names.
- Autonumber references are integers, optionally behind the note's prefix
  (`footnote-prefix` property, behind the per-note prefix setting). A prefix
  follows the name rules and cannot end in a digit.
- `computeNextFootnoteNumber` counts every live reference, including hidden
  ones inside `%%` comments and a lazy label's own.

## Historical bug taxonomy (mutate these, don't repeat them)

Every closed bug is a class; hunters probe the class's neighbours. The pin
files in `test/hunt/` are the full record; these are the classes.

| When | Class | What to mutate |
| --- | --- | --- |
| #50/#51 | name alphabet broke jumps | `.`, `-`, `_`, emoji, CJK, digits-only, leading or trailing `-`, a name equal to a prefix of another |
| #41 | references inside code miscounted | nested and indented fences, backticks inside inline code, tilde fences, an unclosed fence at the end, frontmatter, math, HTML and `%%` comments, callouts, blockquotes |
| #56 | duplicates | duplicate definitions, orphans of both kinds, a self-referencing definition |
| #39 | null deref | empty document, only references, only definitions, one character, trailing newline or none |
| #17 | insert next to an existing reference | caret inside or at the edge of a reference, two adjacent references, references at line start or end |
| #28 | tables broke insertion | cell edges, escaped pipes, the last cell of a table that ends the note, a reference split by formatting |
| aeb3391 | dangling backslashes in inline content | `\]`, `\\`, a trailing backslash, pre-escaped brackets, a pipe inside a cell |
| #55 | definitions appended at the end, not after the block | several definition blocks, definitions above their references, the section heading present, absent, duplicated, an unclosed fence or comment at the end |
| 6732fdb | prefix collisions | a numeric prefix, a prefix equal to an existing name, regex metacharacters (`.`, `+`, `(`), case variants |
| 2026-08-10 | masked-name identity | names with code or comment spans: every path that reads a name from a masked line re-slices the raw line |
| 2026-08-10 | HTML comment boundaries | text before `<!--` and after `-->` is live; short forms are complete comments; backticked or escaped openers are not openers |
| 2026-08-10 | container fences | a fence's closer must match its container; a quoted fence dies with its quote; list-item fences |
| 2026-08-10 | reindex fixpoints | deep orphan chains against the cap, cycles, composition order |
| 2026-08-10 | line-0 residue | cutting content at line 0 strands `---` (manufactured frontmatter) or `> ---` (quoted setext heading) |
| 2026-08-25 | code span in a name hides a real definition | masking before label carving; real parsers carve the label first |
| 2026-08-25 | simulateChanges ties | same-offset insertions concatenate in change order, like CM6 |
| 2026-08-25 | rename swept back by apply-prefix | rename to a bare name under an active prefix |
| 2026-09-09 | prose-label rule | a label under prose, a list item, a quote line, a table row, a comment-only line; a label after an HTML-comment line (definition) |
| 2026-09-09 | `%%` comments | see the changed-since table |
| 2026-09-11 | landing past closing marks | see the changed-since table |
| 2026-09-11 | write-back and folds | see the changed-since table |
| 2026-09-11 | math closer before a digit | `$5 or $6` is not math; the memo keeps masking linear |
| 2026-09-12 | commented label offered for rename | a label inside a `%%` block is a dead label, not lazy |
| 2026-09-13 | commented label counted as a reference | every reader that passes the bare `definitionStarts[i]` into `referenceOccurrences` reads a `%%`-commented label's own `[^x]` as a live reference (orphan deletion cuts the brackets, reindex and apply-prefix rename it and spend a number, rename's planner and collision check, the undo notice, the definition-to-reference jump); only the rename target resolvers use `labelCountsAsLabel`. Pin: `bug-commented-label-counted-as-reference`; open halves in `spec-commented-label-open-questions` |
| 2026-09-13 | definition block owns a region opener | an indented `%%`, `<!--`, or fence opener inside a definition continuation is absorbed but its closer is not, so move-to-bottom, reindex's block swap, and orphan-definition deletion tear the region apart (the HTML deletion twin eats the commented-out definition); `buildDefinitionAppend`'s blocks-present branch never consults `endsProtected`; a `%%`-commented section heading anchors the append and the move. Pins: `bug-definition-block-owns-region-opener`, `bug-append-after-last-block-ignores-unclosed-region`, `bug-commented-section-heading-anchors-append` |
| 2026-09-13 | invalid names rewritten by rules | a whitespace name (`[^my note]:`) is prose to Obsidian and to the reference-orphan rule, yet orphan-definition deletion eats the line and reindex, apply-prefix and the punctuation rule rewrite it. Pin: `bug-invalid-name-rewritten-by-rules`; the escaped `]` label in `spec-escaped-bracket-in-label` |
| 2026-09-13 | scanner fence state | a lazy label sets `inDefinition` from the raw regex, so a four-space fence under it opens an unclosed fence; a document-level fence opened at one to three spaces accepts a closer at four to six; `definitionStartLines` reads raw CRLF lines (latent). Pins: `bug-lazy-label-opens-wide-fence`, `bug-fence-closer-indent-follows-opener`, `bug-definition-starts-crlf` |
| 2026-09-13 | paragraph enders | a setext underline of one or two dashes, and a heading, rule, or setext underline indented one to three spaces, do not end the paragraph, so the label under them is lazy (fix-lazy inserts a blank, a press mints an empty duplicate definition); a column-0 `[!` line is taken for a callout title. Pins: `bug-definition-starts-misses-block-enders`, `bug-column-zero-callout-title`; the `$$` closer and the HTML closer with a tail are spec questions |
| 2026-09-13 | label after a closer on the same line | `<!-- c --> [^1]: def`, `--> [^1]: def`, `%% [^1]: def`, `> %% [^1]: def`: no reader shields the label, so the punctuation rule swaps its colon on default settings (permanent) and orphan deletion cuts its brackets. Pin: `bug-label-after-comment-closer-mangled`; the `%%` classification in `spec-label-after-percent-closer-same-line` |
| 2026-09-13 | column-0 lazy label press | the caret lookup's raw gate drops a column-0 label's own `[^1]`, so a press inside it falls through to creation and writes `[^1[^2]]`; the quoted spelling navigates. Pin: `bug-press-inside-column-zero-lazy-label-nests`; whether the press should navigate is `spec-lazy-label-press-navigates` |
| 2026-09-13 | quoted definition continuation | a quoted label forms no block, so the definition-interior guard misses its continuation line and a press there nests a footnote. Pin: `bug-quoted-continuation-press-nests`; landing and jump-back in `spec-quoted-definition-continuation-landing` |
| 2026-09-13 | fix-lazy under a setext underline | fixing a label above `===` reclassifies the underline, the next label turns lazy, and the loop cap stops early: not idempotent, three lint runs to settle. Pin: `bug-fix-lazy-setext-chain-not-idempotent`; the dissolved heading and the mid-table label are spec questions |
| 2026-09-13 | fold mapping on in-line rewrites | a multi-line replacement hunk shrinks or drops a fold whose line lies inside it, and the removed-line predicate counts a surviving interior line as deleted. Pin: `bug-fold-mapping-inline-rewrite` |
| 2026-09-13 | landing walk | the link tail stops at the first `)` (balanced parentheses in a URL get the reference written inside); the walk hops an apostrophe or a dot into the next word (`don'[^1]t`, `U.[^1]S.`); the selection expansion reuses the walk and swallows a closing quote or `**`. Pins: `bug-landing-link-balanced-parens`, `bug-landing-walk-enters-next-word`, `bug-selection-expansion-swallows-closing-mark`; class membership in `spec-landing-convention-members` |
| 2026-09-13 | selection guards | `spanTouchesFootnote` never receives `labelIsDefinition`, so a lazy label line or a `[^x]: y` cell converts and nests; the whole-table test compares trimmed edges to the raw line, so trailing spaces or a one-space indent refuse; a cut `%%` delimiter refuses with the caret message. Pins: `bug-selection-lazy-label-nests-live-reference`, `bug-whole-table-trimmed-edges-refuse`, `bug-cut-comment-delimiter-wrong-toast` |
| 2026-09-13 | orphan deletion side effects | deleting a quoted orphan cuts only the label line, its body flips to quoted code, and the next lint deletes an unrelated definition; a deletion the guard refuses is reported nowhere; an orphaned numbered definition inside a quote never adopts the prefix. Pins: `bug-quoted-orphan-deletion-strands-body`, `bug-refused-orphan-deletion-unreported`, `bug-apply-prefix-skips-quoted-numbered-orphan` |
| 2026-09-13 | smaller ones | rename to the bare prefix accepted; a mistyped `settingsVersion` re-runs the migrations; the split-creation registry is never evicted; a double quote in a name loses the no-wrap span; cell offset 0 after an escaped pipe and a stale cell caret in `resolveTableCellCursor`. Pins: `bug-rename-to-bare-prefix-accepted`, `bug-mistyped-settings-version-reruns-migration`, `bug-split-creation-registry-never-evicted`, `bug-quoted-name-with-quote-loses-nowrap`, `bug-resolve-cell-cursor-escaped-start` |
| 2026-09-13 | refuted, do not re-report | hidden references inside `%%` comments are live and the rules edit them (deletion, punctuation, reindex): ruled correct by the `%%` spec; fix-lazy then orphan-definition deletion in one pass is pinned as intended in `test/fix-lazy-definitions.test.ts`; a selection inside an inline `%%` comment converts (a caret press there is allowed too); the undo notice reports the definition's casing on purpose; the CRLF write-back probe modelled the editor wrongly (CodeMirror strips the carriage return on load); the `...` frontmatter closer is pinned in `test/mutation-hardening-scan.test.ts` |

## Lens checklists

### grammar
Always cover three blind spots caught only out of band: **case folding**
(probe `[^Note]` against `[^note]` through every scan, jump, rename, and
reindex path, including orphan deletion, where the worst case is silent
data loss); the **empty `[^]` placeholder** (never a reference; a second
press explains itself instead of nesting); **unicode word boundaries**
(`endOfWordOffset` and `startOfWordOffset` with combining marks, precomposed
accents, CJK, astral characters).

Targets: `footnoteReferenceMatches`, `referenceOccurrences`,
`definitionLabelIn`, `definitionLabelWithName`, `isValidFootnoteName`,
`footnoteNameProblem`, `listExistingFootnoteDefinitions`,
`computeNextFootnoteNumber`.
Probe: the name alphabets in the taxonomy; `[^1]:` against `[^1] :`;
continuation lines; a definition whose body contains another reference;
references straddling bold or italic; very long names; names with regex
metacharacters fed into dynamic regexes (search for `new RegExp`).

### contexts
Targets: `scanDocument` and every field of `DocumentScan`,
`maskLineRegions`, `maskInlineRegions`, `maskProtectedLines`,
`removeLineRanges`, `definitionStartLines`, `lazyDefinitionLabelLines`,
and every caller that respects them.
Probe: the #41 class row; fence info strings; four-space-indented code
under a list versus under prose; double-backtick inline code; a protected
region at the very start or end; CRLF; a reference on the same line as a
fence delimiter; the prose-label shapes; every `%%` shape in the
changed-since table.

### offsets
Targets: `endOfWordOffset`, `startOfWordOffset`, `referenceLandingAfter`,
`adjustFootnotePosition`, `inlineFootnoteExitCh`, `referenceAtCursor`,
`occurrenceAtCursor`, `tableRowCellSpans`, `resolveTableCellCursor`,
`cellCaret`, `cellSelection`, `lineDiffChanges`, `mapFoldLines`.
Probe: offset 0, offset equal to length, offset past the end; surrogate
pairs and combining characters around the caret; empty string; word at the
end of a line; punctuation-only words; tabs; cells with escaped pipes at a
span boundary; the landing convention's stacked closers.

### properties
Targets: `lintFootnotes` with every option combination, each rule's pure
function, `rewriteDocument`, `lineDiffChanges`.
Probe these invariants on adversarial documents (build about twenty mixing
the taxonomy rows and hand-check the interesting ones):
- idempotence: `f(f(doc)) === f(doc)` for each rule and for the pipeline
- conservation: rules may reorder and renumber but never drop or duplicate
  text outside footnotes (compare the multiset of non-footnote lines) or a
  definition body
- pairing: every reference still resolves to the same body text after
  reindex, merge, and move
- write-back: applying `lineDiffChanges(before, after)` to `before` yields
  `after` exactly, including CRLF documents
- rule order: run each pair of rules in both orders; a difference is a
  finding or a spec question

### interactions
Probe pairs the other lenses treat separately: prefix x reindex; reindex x
protected contexts; move-to-bottom x section heading x indented code;
fix-lazy x move x orphans; `%%` comments x every rule; selections x prefix
x creation lint; rename x prefix x commented or lazy labels; settings
combinations through `lintOptionsFromSettings` (each flag off and on).

### regressions
Re-read the pins in `test/hunt/` and the closed-bug tests in `test/`, and
write harder variants of each: the original fix often handles the reported
case and nothing else. The taxonomy's "what to mutate" column is the
worklist.
