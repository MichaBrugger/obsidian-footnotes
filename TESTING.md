# Testing

Four layers, four commands:

| Layer | Command | What it covers | Needs Obsidian running? |
| --- | --- | --- | --- |
| Unit + property (vitest) | `npm test` | Pure logic: pinned behavior + random-document invariants | No |
| Static analysis | `npm run lint`, `npm run knip` | Type-aware lint rules; dead exports/files/dependencies | No |
| Mutation (Stryker) | `npm run mutation` | Whether the suite actually notices logic changes | No |
| Smoke (integration) | `npm run test:smoke` | The real plugin inside the real app | Yes |

## Unit tests — `npm test`

Vitest, watching `test/**/*.test.ts`. The `obsidian` npm package is type
definitions only, so `vitest.config.ts` aliases it to the runtime stub in
`test/mocks/obsidian.ts` — extend the stub (empty classes / no-ops) if a
new import breaks test startup.

The suite has three kinds of files:

- **Feature specs** (`test/*.test.ts`) — one file per unit under test:
  autonumbering, reference regexes, the insert cascade guards, table-cell
  editing, the linter and each of its rules, prefixes, the popup guards.
  `test/rule-examples.test.ts` executes every lint rule's worked examples
  from the rule registry, so the examples can never drift from the code.
- **Bug pins** (`test/hunt/bug-*.test.ts`) — every bug ever found gets a
  failing test before its fix and keeps it as a regression pin. Spec
  rulings live next to them as `test/hunt/spec-*.test.ts`.
- **Properties** (`test/properties.test.ts`) — fast-check invariants over
  randomly generated documents and option combos: lint idempotence, no
  mask (NUL) leakage, protected-region preservation, reference/definition
  conservation, scanner self-agreement, plus a **differential oracle**
  that parses each document with micromark (GFM footnotes + math) before
  and after linting and requires identical footnote structure. Failures
  shrink to a minimal counterexample automatically. The document generator
  lives in `test/arbitraries.ts`, shared with the sample-corpus script.
- **Command-press properties** (`test/command-properties.test.ts`) — the
  same generator drives the four real creation commands (autonum, named,
  inline, paste) against a transaction-applying fake editor at random
  caret positions and settings: a press never throws, never edits
  protected text, never loses a protected line, adds only the raw
  reference shapes its contract allows, and never mints a dead reference
  or orphaned definition of its own making. The TYPED flows are fuzzed
  too: the full named cycle (plant `[^]`, type a generated name —
  colliding, fresh, or invalid — re-press for the definition, type its
  body), the inline cycle (plant `^[]`, type a body, re-press hops out or
  warns while empty), and paste with arbitrary `fc.string` clipboard
  content through the whole command. SELECTION conversions (issue #35) are
  fuzzed with random single-line spans (reversed, whitespace-edged, empty):
  a conversion moves EXACTLY the trimmed selected text into the footnote
  and keeps the line's prefix/suffix, named/paste redirect without
  editing, multi-line selections warn and edit nothing, and protected
  lines survive conversion presses untouched. Popup, table cells, and
  Reading view stay smoke-suite territory (the cell conversion writer has
  deterministic pins in `test/selection-to-footnote.test.ts`).

Properties run 200 cases each by default. Before a release, soak them:

```powershell
$env:FC_NUM_RUNS = "5000"; npx vitest run test/properties.test.ts test/command-properties.test.ts
```

Standing rules:

- **Every reported bug gets a failing test before the fix** (unit if the
  logic is pure, smoke if it needs the live editor). When a property or
  the oracle finds one, the shrunk counterexample becomes a deterministic
  pin in `test/hunt/` — properties discover, pins remember.
- New *generic* invariants ("lint never does X to any document") belong in
  `test/properties.test.ts`; new *specific* behavior gets a normal spec.
- Tests marked *characterization* pin current behavior that hasn't been
  blessed as intended — flip the expectation to change the spec.
- **Unit tests defend against our changes; smoke tests defend against
  Obsidian's.** Anything that touches undocumented internals (table cell
  sub-editors, embedRegistry) must keep a smoke test — a mocked unit test
  would just encode our assumptions and stay green when Obsidian changes.
- When a classification is contested (is this line code? frontmatter? a
  definition continuation?), get ground truth from the real app:
  `Obsidian.com eval` + `metadataCache.getFileCache(file).sections` shows
  exactly how Obsidian reads the markdown.

## Static analysis — `npm run lint` and `npm run knip`

- `npm run lint`: ESLint over `src/` with the official Obsidian plugin
  guidelines plus typescript-eslint's `strict-type-checked` preset
  (type-aware). Fix findings with typed code, not disable comments.
- `npm run knip`: dead exports, unused files, unused/unlisted
  dependencies. The repo is kept at **zero findings** — if knip flags new
  code, either wire it in (see rule-examples.test.ts for the pattern) or
  delete it.

## Mutation testing — `npm run mutation`

Stryker mutates the pure-logic modules (`src/markdown-scan.ts`,
`src/linting/`, `src/insert-or-navigate-footnotes.ts`,
`src/table-cursor.ts`) and reruns the covering tests per mutant
(`coverageAnalysis: perTest`). A surviving mutant is a logic change no
test noticed — either add a test or accept it knowingly.

- **Local only, by design** — it is a pre-release audit, not CI.
- Results cache in `reports/stryker-incremental.json` (gitignored), so
  re-runs after small changes take seconds to minutes; the first full run
  takes much longer.
- The HTML report lands at `reports/mutation.html`.
- The npm script pins `FC_NUM_RUNS=25` so the property suite stays cheap
  per mutant.

## Smoke tests — `npm run test:smoke`

`scripts/smoke-test.mjs` drives the **actual plugin in a running Obsidian
instance** through the Obsidian CLI: it deploys the current build, creates a
scratch note, moves the cursor, executes the plugin's commands, and asserts
on the real editor contents — the same loop used to verify the v0.2 features
(end-of-word insertion, numbering, section headings, blank-line trimming,
popup open/toggle-close, orphan handling, fences/callouts/math protection).

The script is fully repeatable: it backs up your plugin settings to a
sidecar file, forces the note into live preview, restores everything on
every exit path (finish, failure, Ctrl+C), and heals from a leftover
backup if a previous run was killed.

Requirements:

- Obsidian is open with the **Obsidian-Plugin-Sandbox** vault focused
  (the script refuses to run against any vault without "Sandbox" in its name)
- the `obsidian` CLI on PATH (ships with Obsidian; `Obsidian.com` on Windows,
  override with the `OBSIDIAN_CLI` env var if needed)
- the **hot-reload** community plugin enabled, so the deployed build is
  picked up automatically
- the Obsidian window visible (the render loop stalls while hidden or
  minimized; the script nudges the window awake but can't fight a
  deliberate minimize)

Flags: `npm run test:smoke -- --no-deploy` tests whatever build is already
loaded instead of deploying first.

Notes for writing new smoke tests:

- The CLI sometimes swallows eval output. Treat evals as fire-and-forget
  *actions* and verify by *polling* idempotent reads (`pollUntil`).
- Set note content through `editor.setValue`, never by overwriting the file
  on disk — an open editor with unsaved changes merges disastrously.
- Reset plugin settings to the baseline at the start of every test
  (`resetSettings`); never rely on a previous test's cleanup running.
- Settings changes are in-memory only and restored at the end, so the
  vault's `data.json` is untouched.

## When to run what

- While developing pure logic: `npm test` (watch mode).
- Before committing: `npm run lint` — and `npm run knip` if you added or
  removed exports.
- Before committing anything that touches editor behavior: `npm run
  test:smoke`.
- Before a release: all of the above, a property soak (`FC_NUM_RUNS`),
  and `npm run mutation`.
