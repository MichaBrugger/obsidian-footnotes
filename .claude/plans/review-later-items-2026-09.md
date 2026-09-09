# Claude: plan for the deferred review items (2026-09-09)

Claude: a starting point, not a finished plan. Written after the 2026-09-08 review pass shipped its NOW items in 0.2.0-beta.12. The items below are the ones Jason marked LATER (plus one open question the A2 ground truth surfaced). Each work package is sized to land as a handful of commits with the gates green in between; none changes user-visible behavior unless it says so.

Terminology: a **reference** is `[^1]` in the text, a **definition** is the `[^1]:` line. Gates = `npx tsc -noEmit`, `npm run lint`, `npm run knip`, `npx vitest run`, `npm run build`, and `npm run test:smoke` after `npm run build` for anything that touches a command.

## Suggested order

1. WP4 selection types (an hour, warms up the selection file)
2. WP1 one masked-line reader (the big one: performance plus the last duplicated label reader)
3. WP2 scanner facts for the unclosed tail
4. WP3 rewriting-rule contracts
5. WP5 test-suite hardening (D10 first, D9 overnight, then D4, D5, D6)
6. WP0 open question: labels after a paragraph line (needs a live ground truth before any code)

## WP0: DONE 2026-09-09, a label directly after a prose line is prose

Ground-truthed (column 0, indented, after list items, quote lines, table rows, callout body lines; definitions after blank lines, headings, closed fences, callout title lines, quote blank lines, other definitions) and shipped the same day on Jason's decision to match Obsidian: `definitionStartLines` in markdown-scan is the one rule, consulted by the block walker and every per-line label reader through `DocContext.definitionStarts()` / `DocumentView.definitionStarts`. Note for WP1: micromark's GFM footnotes DO let a definition interrupt a paragraph, so the differential oracle cannot referee this shape; the deterministic pins (test/hunt/bug-label-after-prose-line-is-prose) and manual sheet 25 do. The rule also exposed and fixed an append bug: a definition appended under prose when the note's only definitions were blockquoted got no blank separator.

## WP1: one masked-line reader (B4, C2, C10)

Why: `maskedLineAt` rescans the whole document on every call and duplicates `DocContext.maskedLine` byte for byte; verification rescans once per reference, rename once per edited line, the undo notice masks twice; `findDefinitionBlocks` takes an `isProtected` that all 11 callers pass as `scan.isProtected`; and `linter.ts` carries a fourth private spelling of "read a definition label".

Steps, one commit each:

1. `markdown-scan.ts`: export `maskLineWithScan(lines, scan, i)` (the body both copies share). `maskedLineAt` becomes "scan, then maskLineWithScan"; `docContext.maskedLine` calls it with the cached scan. Pin: `masked-line-at.test.ts` plus the existing "maskedLineAt agrees with the full masked twin" property.
2. `insertion-liveness.ts` `verifyLiveFootnoteInsertion`: mask once from `simulatedScan` (`maskProtectedLines(simulated, simulatedScan)`) and read anchors from it; add `simulatedAnchors(lines, changes, indices, simulated)` that resolves every landing in ONE `applyResolvedChanges` pass, keeping `simulatedAnchor` as a one-index wrapper (callers: selection-footnote.ts:783 area, multi-caret.ts:361 area). Pins: `verify-live-insertion.test.ts`, `multi-caret.test.ts`, command-press properties.
3. `rename-footnote.ts` `renameSurvives`: hoist `scanDocument(simulated)` and the masked twin above the per-line loop; reuse the scan for the block check after it. Pins: `rename-footnote.test.ts`, the rename describes in `mutation-hardening-creation.test.ts` (see D10).
4. `undo-orphan-notice.ts`: one masked twin shared by `definedNames` and `referencedNames`. Pins: `undo-orphan-notice.test.ts`.
5. C2 (a): `findDefinitionBlocks(lines, scan, maskedLines?)`; drop `isProtected`. Mechanical across 11 src call sites and the test files that call it (grep `findDefinitionBlocks(`). tsc is the safety net.
6. C2 (b): give `DocContext` a memoized `blocks()` like `DocumentView.blocks`, then switch the press-side callers (definition-append, navigation x2, press-guards, rename x2, selection-footnote) to `ctx.blocks()`. Optional stretch: one `documentView(lines)` factory that both `docContext` and `rewriteDocument` build on, so the two views cannot drift.
7. C10: `uniqueEmptyDefinitionName` reads the label through `definitionLabelWithName(lines[i], masked[i])` plus a "rest of the line is blank" check, so it agrees with `uniqueSeededDefinitionName` beside it and with the A2 indent rule. Pins: `popup-caret-reland.test.ts`, creation suites.

Size: medium-large, two to three hours of runs. No behavior change; if anything moves, the property suite and the smoke suite will say where.

## WP2: scanner facts for the unclosed tail (B2)

Why: `buildDefinitionAppend`, when the note ends inside an unclosed fence, comment, or math block, walks up one line at a time and re-slices and re-scans the prefix on every step: quadratic on a long note with an unclosed opener near the top, on a single press.

Steps:

1. `scanDocument` records `endsProtectedAt: boolean[]` during the walk it already makes (it tracks `inComment`, `inMath`, the fence, and `regionDepth` at every line boundary). Do NOT derive it from `startsInFence[i + 1]`: `startsInFence` includes blockquoted fences that `endsProtected` excludes by design (see the `DocumentScan` docs). Pin with a unit: for a few documents, `endsProtectedAt[i]` equals `scanDocument(lines.slice(0, i + 1)).endsProtected` for every i (that IS the old probe, so it doubles as the equivalence proof).
2. `definition-append.ts`: `while (fromLine >= 0 && ctx.scan.endsProtectedAt[fromLine]) fromLine--;`. Pins: the 2026-08-11 review bug #10 tests (grep "unclosed" in test/), a timing spec like `spec-long-line-masking-is-linear` for a 3000-line note with `<!--` on line 2.

Size: small-medium. Additive change to the scan's return shape; every existing reader is unaffected.

## WP3: rewriting-rule contracts (C6, C7, C9)

- C7 `rewrite-document.ts` / `move-footnotes-to-the-bottom.ts`: `readonly lines` is mutated with `pop()` before the lazy scan runs; it works by ordering luck. Give `DocumentView` an explicit `trimTrailingBlankLines()` that asserts (in dev) that nothing has been computed yet and returns the count, or have move-to-bottom build `documentView(trimmed)` itself. Then type `lines` as `ReadonlyArray<string>` so the compiler enforces it. Pins: `move-footnotes-to-bottom.test.ts`, the idempotence property, `spec-mixed-eol-noop-rewrite`.
- C6 `linter.ts` `reindexDeletesOrphans`: dead on every UI path (`reindexOptionsFromSettings` never sets `keepOrphanedDefinitions`), yet the properties' `optionsArb` does generate `keepOrphanedDefinitions: false`, so direct callers rely on it. Recommendation: keep the behavior and rewrite the comment to say it exists for programmatic callers of `lintFootnotes` (the properties among them). Deleting it means also removing `keepOrphanedDefinitions` from `ReindexOptions` and from the generators; not worth the churn.
- C9 `re-index-footnotes.ts`: `orderIndex.get(name) ?? 0` sorts an unknown block FIRST. Use `?? order.length` with a comment stating the invariant (every block name is in `order`), or throw in dev. Pin: `reindex-footnotes.test.ts` stays green; add one unit that a block whose name is missing from the order (constructed directly) sorts last.

Size: small.

## WP4: selection types (C3)

`selection-footnote.ts` spells `{ from: number; to: number; text: string; lead?: string }` inline at lines 674, 846, 885 while the main-editor twin has `ConvertedSelection`. Name it `CellSelection` with `lead: string` required, make `ConvertedSelection.lead` required too (every producer sets it), and delete the `?? ""` defensiveness. Type-only; tsc is the test. While in the file: the review's item 6 (the two branches of `selectionPressHandled` are parallel implementations, 180 lines) is the natural follow-up, but it is a real refactor with the widest blast radius in the plugin (four commands, two editors); do it only with the selection suites, command-press properties, and sheet 06 as the net, and after WP1.

## WP5: test-suite hardening (D4, D5, D6, D9, D10)

- D10 (first, ten minutes): move the three rename describes (`renameTargetAtCursor`, `planFootnoteRename's refusals`, `planFootnoteRename's change set`) out of `mutation-hardening-creation.test.ts` into `mutation-hardening-rename.test.ts`, keeping their mutant citations. Pure move.
- D9: add `src/commands/multi-caret.ts`, `src/commands/popup-retry.ts`, `src/editor/notice.ts` to `stryker.config.json`'s mutate list, run `npm run mutation` overnight (92 minutes last time), and triage survivors the way the mutation-hardening files document: name the mutant and the source line per new test; list the ones deliberately not chased.
- D4: `set-footnote-prefix.test.ts` now exists (A7). Add the three remaining branches: the `view.save()` flush when the active view is this file (a recording view double), an empty value deleting the property, and the feature-off warning toast.
- D5: a differential spec for `simulateChanges` against a real `ChangeSet` from `@codemirror/state` (add it as an explicit devDependency; it is already installed transitively under `@codemirror/view`). Generate random documents and random non-overlapping change sets with fast-check (`ChangeSet.of` refuses overlaps, so generate sorted, non-overlapping spans plus same-position inserts), apply both ways, compare the text; also compare `simulatedAnchor` with `changes.mapPos(offset, 1)` for each insert. This is the seam the 2026-08-25 tie bug got through; it is worth the hour.
- D6: `command-properties.test.ts` derives its expected trimmed span from `trimSelectionEdges`, `absorbLeadingSpace`, and `indentDefinitionBody` themselves. Re-derive the span in the test from the rules as written in the README and sheet 06 (whitespace edges trimmed; with the whole-word setting, grow to word boundaries plus one trailing punctuation mark; the leading space joins the reference unless the text before it is a list marker, heading marker, quote marker, or table pipe), written without looking at the production functions. Expect a few honest disagreements to surface; each is either a test bug or a plugin bug, and both are wins.

## Not planned

- D11 (one guard pinned three times): harmless, skipped by decision.
- B1's 256-character cap alternative: unnecessary now that the index is O(1) per query.
