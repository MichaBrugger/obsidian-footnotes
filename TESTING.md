# Testing

Two layers, run with two commands:

| Layer | Command | What it covers | Needs Obsidian running? |
| --- | --- | --- | --- |
| Unit (vitest) | `npm test` | Pure logic, TDD-style | No |
| Smoke (integration) | `npm run test:smoke` | The real plugin inside the real app | Yes |

## Unit tests — `npm test`

Vitest, watching `test/**/*.test.ts`. The `obsidian` npm package is type
definitions only, so `vitest.config.ts` aliases it to the runtime stub in
`test/mocks/obsidian.ts` — extend the stub (empty classes / no-ops) if a
new import breaks test startup.

Suite map (one file per unit under test):

- `next-footnote-number.test.ts` — autonumbering policy (gaps not reused,
  named markers ignored)
- `list-footnotes.test.ts` — document scans for details and markers
- `section-header.test.ts` — heading/divider blank-line rules
- `marker-regexes.test.ts` — the exported marker regexes
- `invalid-footnote-name.test.ts` — spaced-name guard (warns via Notice)
- `end-of-word-offset.test.ts` — cell-local end-of-word insertion point
- `table-cell-insert.test.ts` — the edit dispatched into a table cell editor
- `table-cursor.test.ts` — escape-aware table-row cell spans
- `inline-footnote-content.test.ts` — clipboard sanitizing for ^[...] bodies
- `inline-footnote-exit.test.ts` — second-press exit past the closing bracket
- `marker-at-cursor.test.ts` — the strict "inside a marker" rule (issue #49)

Standing rules:

- **Every reported bug gets a failing test before the fix** (unit if the
  logic is pure, smoke if it needs the live editor).
- Tests marked *characterization* pin current behavior that hasn't been
  blessed as intended — flip the expectation to change the spec.
- **Unit tests defend against our changes; smoke tests defend against
  Obsidian's.** Anything that touches undocumented internals (table cell
  sub-editors, embedRegistry) must keep a smoke test — a mocked unit test
  would just encode our assumptions and stay green when Obsidian changes.

## Smoke tests — `npm run test:smoke`

`scripts/smoke-test.mjs` drives the **actual plugin in a running Obsidian
instance** through the Obsidian CLI: it deploys the current build, creates a
scratch note, moves the cursor, executes the plugin's commands, and asserts
on the real editor contents — the same loop used to verify the v0.2 features
(end-of-word insertion, numbering, section headings, blank-line trimming,
popup open/toggle-close).

Requirements:

- Obsidian is open with the **Obsidian-Plugin-Sandbox** vault focused
  (the script refuses to run against any vault without "Sandbox" in its name)
- the `obsidian` CLI on PATH (ships with Obsidian; `Obsidian.com` on Windows,
  override with the `OBSIDIAN_CLI` env var if needed)
- the **hot-reload** community plugin enabled, so the deployed build is
  picked up automatically

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
- Before committing anything that touches editor behavior: `npm run
  test:smoke`.
- Before a release: both.
