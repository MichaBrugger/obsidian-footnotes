# Testing

Two layers, run with two commands:

| Layer | Command | What it covers | Needs Obsidian running? |
|---|---|---|---|
| Unit (vitest) | `npm test` | Pure logic, TDD-style | No |
| Smoke (integration) | `npm run test:smoke` | The real plugin inside the real app | Yes |

## Unit tests — `npm test`

Vitest, watching `test/**/*.test.ts`. These are written **TDD-style by the
maintainer** — red, green, refactor. AI does not write unit tests or make
them pass; it may review them after they are green and suggest missed edge
cases on request. (The specification step is the point of the exercise.)

Good first targets (they require extracting pure functions from
`src/insert-or-navigate-footnotes.ts`, which is part of the exercise):

- next-footnote-number logic (`shouldCreateAutonumFootnote`, ~lines 250–270):
  empty doc, `[^1] [^2]`, gaps like `[^1] [^3]`, named/numbered mixes
- `listExistingFootnoteDetails` / `listExistingFootnoteMarkersAndLocations`
  against a fake `Editor` (an object with `getLine`/`lineCount` over an array)
- `addFootnoteSectionHeader` divider/heading prefix rules

`test/harness.test.ts` is only a setup check proving the harness runs.

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
