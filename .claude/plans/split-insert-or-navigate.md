# Plan: split `insert-or-navigate-footnotes.ts` (Sol #6)

**Status: awaiting Jason's approval (2026-08-11); executes once approved and
the round-2 Stryker measurement has finished.** Written while the file sat at
~1,570 lines. One phase per commit, each phase gated on: `tsc` + `npm run lint` + `npm test` + `npm run knip`, and the
LIVE smoke suite for any phase that touches the command entries (the
microtask-ordering regression of 2026-08-11 was invisible to 800 unit tests
and caught only by smoke — treat that as law here).

## Why (beyond line count)

Today's import graph has two real cycles:

- `insert-or-navigate` ↔ `linting/linter` (`lintAfterFootnoteCreation` one
  way; `footnotePrefix`/`jumpToFootnoteDefinition`/`readingViewActive`/
  `runOutsideTableCell` the other)
- `linting/rules/*` → `insert-or-navigate` → `linter` → `rules/*`

These cycles are why `TrailingPunctuationChars` had to live in markdown-scan
(the e9c58c0 red commit: a module-scope read through the cycle evaluated to
undefined). The split's primary goal is an **acyclic graph**; the line count
is a side effect. `table-cursor` and `footnote-popup` are already leaves —
verified 2026-08-11 — so this is achievable without touching them (one small
exception below).

## Target modules and the one allowed import direction

```
markdown-scan            (existing leaf)
   ↑
footnote-grammar.ts      reference shapes: AllReferences, AllNumberedReferences,
                         escapedAt, footnoteReferenceMatches, referenceOccurrences
                         (+ type), isValidFootnoteName, idListIncludes,
                         referenceAtCursor, emptyReferenceStart,
                         computeNextFootnoteNumber
   ↑
footnote-prefix.ts       footnotePrefix, footnotePrefixFromEditor,
                         footnotePrefixProblem, activeFootnotePrefix
doc-context.ts           DocContext, docContext, docLines, readingViewActive
cursor-motion.ts         moveCursorAndSetJumpPoint (vim jumplist!),
                         adjustFootnotePosition, endOfWordOffset,
                         isTrailingPunctuation
   ↑
definition-append.ts     addFootnoteSectionHeader, buildDefinitionAppend
                         (+ the phantom-frontmatter prepend), needsSeparator,
                         listExistingFootnoteDefinitions
inline-footnotes.ts      sanitizeInlineFootnoteContent, inlineFootnoteSpanAt,
                         inlineFootnoteExitCh, the inline guards
navigation.ts            shouldJumpFromDefinitionToReference,
                         shouldJumpFromReferenceToDefinition,
                         jumpToFootnoteDefinition
                         (imports footnote-popup for the popup-edit path;
                         does NOT import linter)
   ↑
insert-or-navigate-footnotes.ts   what remains: the four command entries,
                         withEditableEditor, caretGuardsHandled, the three
                         create* steps, openPopupForNewDefinition,
                         scheduleCreationLintAfterPopup, insertInTableCell
                         glue. The ONLY module allowed to import
                         linting/linter.
```

- `linting/rules/*` end up importing ONLY `footnote-grammar` /
  `footnote-prefix` (+ markdown-scan) — their edge into the commands file
  disappears entirely.
- `linting/linter` imports `footnote-prefix`, `doc-context`
  (readingViewActive), `navigation`, `table-cursor` — no edge back into
  commands. **Acyclic.**
- `main.ts` type-import cycle (`FootnotePlugin`) is type-only and erased at
  runtime; leave it.

## Phases (each one commit, moves are VERBATIM — no simultaneous refactoring)

0. **Prep**: green baseline (suite, smoke, knip), everything pushed. Move
   `runOutsideTableCell` + `nestedSubEditorOwnsFocus` consumers' glue INTO
   `table-cursor.ts` (it is table logic on a leaf — removes one linter edge
   before the split proper). Smoke-gate this phase (table tests).
1. **footnote-grammar.ts** — update importers in the same commit (4 rule
   files, linter, tests like reference-regexes.test.ts). No temporary
   re-exports/barrels: knip must stay at zero and re-export shims are how
   stale edges survive.
2. **footnote-prefix.ts** — also re-point `set-footnote-prefix.ts` and main.
3. **doc-context.ts** + **cursor-motion.ts** (small, mechanical).
4. **definition-append.ts** + **inline-footnotes.ts**.
5. **navigation.ts** — after this phase run the FULL gate incl. smoke (jump
   behavior + popup-edit path).
6. Optional cosmetic LAST: rename the remainder to `footnote-commands.ts`.
   Costs: every import in main/tests, stryker mutate list, docs. Skippable.
7. **Post-split chores**: stryker.config.json mutate list gains the new file
   names (mutant paths change → the incremental cache misses; schedule ONE
   full `npm run mutation` re-baseline, ~50 min); rewrite the module map in
   `.claude/skills/hunt-bugs/references/attack-surface.md`; `npm run knip`
   zero; push.

## Hazards, with the scars that motivate them

- **Module-scope reads through cycles** (e9c58c0): during phases, any const
  read at module scope by another module must live at the dependency root.
  After each phase run `npx madge --circular --extensions ts src` (or
  equivalent) and require ZERO cycles among the new modules; the
  commands→linter edge is the single allowed back-edge until Phase 5 removes
  the rest.
- **Microtask ordering** (63bc025): `withEditableEditor`,
  `openPopupForNewDefinition`, and the popup toggle/settle sequence move
  as-is, never re-shaped "while we're here". Smoke's rapid-press tests are
  the gate.
- **vi.mock/isolate** landmine does not apply (no test uses vi.mock), but new
  tests written during the split must keep using the self-recording Notice
  stub.
- **Verbatim moves only.** If a phase tempts an improvement, note it in the
  commit message and do it AFTER the split lands.

## Definition of done

Suite + property soak (`FC_NUM_RUNS=5000`) + smoke green; knip zero; madge
reports an acyclic src graph; mutation re-baseline within ~1 point of the
pre-split covered score (91%+ markdown-scan, 97% table-cursor, ~90% rules);
attack-surface map current; pushed.
