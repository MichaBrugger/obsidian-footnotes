---
name: hunt-bugs
description: Bug hunt for the obsidian-footnotes plugin - parallel hunter agents over the attack surface, every finding proved by a failing vitest probe, confirmed bugs pinned as it.fails tests. Use when the user wants bugs found, wants the plugin stress-tested or fuzzed, is checking robustness before a release, or has just landed a risky feature.
---

# Bug hunt: prove it or it didn't happen

The goal is bugs Jason's manual sheets can't reach. The one hard rule that
makes this a *hunt* rather than a code review:

> **A bug exists when a vitest probe goes red against the real code.**
> Reading the code and saying "this looks wrong" is a hypothesis. Every
> finding in the report points at a probe that is red right now, with its
> failure output.

Plausible bugs found by reading regexes are wrong more than half the time:
the surrounding code compensates, or the "expected" behaviour was never the
spec. Running the probe settles it.

## Ground rules for this repo

- Vocabulary is enforced: read `CONTEXT.md` before writing a probe name or an
  expectation. *Reference* is the `[^1]` in the text, *definition* the
  `[^1]:` entry, *label* its head, *lazy label* a label Obsidian reads as
  paragraph text. The ADRs in `docs/adr/` are rulings, not bugs: nested
  footnotes are prevented plugin-wide, and lint is never silent about what it
  won't fix.
- Expected values come from an **independent source of truth**: Obsidian's
  own rendering (the manual sheets in `manual-tests/` record ground truth),
  CommonMark and GFM footnote syntax, the README, or an existing ruling.
  An expectation derived by re-reading the implementation is a tautology and
  proves nothing.
- Run tests with `npx vitest run <file>` (bare `npm test` is watch mode and
  blocks). Unit tests import from `../src/...`; the `obsidian` package is
  aliased to `test/mocks/obsidian.ts`. If a probe's import chain breaks on a
  missing obsidian export, extend the stub with a no-op and keep the probe.
- Probes live in `test/hunt/probe-<lens>-<n>.test.ts`. The directory is in
  the vitest include pattern, so every probe that confirmed nothing is
  deleted before the hunt ends.
- The hunt writes only under `test/hunt/` and to the attack-surface
  reference. `src/`, `scripts/`, and existing tests stay as they are: the
  hunt finds bugs; fixing is Jason's call afterwards.
- Two pins are expected-fail on purpose and already ruled on:
  `bug-moved-definition-adopts-indented-code` and `spec-questions`. Leave
  them alone.
- This vault is Syncthing-synced, and sync has deleted `test/hunt/` mid-hunt
  before (2026-07-17). Hunters keep each finding's scenario, expected, and
  actual in their returned JSON, so a vanished probe can be rebuilt.

## The pipeline

### 1. Recon (orchestrator, cheap)

1. Read `CONTEXT.md`, the two ADRs, and
   [references/attack-surface.md](references/attack-surface.md): the module
   map, the bug taxonomy, the lens checklists, and the open pins.
2. Measure the **blast radius** of what changed since the reference was
   last verified: `git log --since=<date in the reference header> --format=%s`
   and `git diff --stat <that date>..HEAD -- src`. Modules that changed, and
   the modules that import them, are prime ground. Weight the hunt toward
   them: a changed module gets its own hunter even if its lens would
   otherwise be shared.
3. Scope to the ask. A full sweep runs every lens; a targeted request
   ("hunt the reindexer") runs the relevant lenses plus the **interactions**
   lens always, because single-module bugs are mostly fished out and the
   survivors live between modules.

Recon is done when you can name, per lens, the target modules and the
changed code each hunter must cover.

### 2. Fan out hunters (parallel, one message)

Spawn one subagent per lens with the Agent tool, all in a single message,
with `run_in_background: false` on every call: parallel tool calls in one
message still run concurrently, and blocking on them matters (an idle
orchestrator can miss background children's results, and in a worktree its
still-clean tree gets auto-cleaned out from under the hunters).

Set `model: "opus"` (or `"sonnet"`) on every hunter and skeptic: hunting is
breadth work, per-lens agents burn tokens fast, and Jason's standing rule is
that bug-testing subagents never run on the top model.

Lenses, from the reference:

1. **grammar**: reference and definition parsing against what Obsidian accepts
2. **contexts**: protected regions (code, math, comments, frontmatter,
   callouts, tables) and the prose-label rule
3. **offsets**: caret and index arithmetic (boundaries, unicode, empty input,
   table cells, the landing convention)
4. **properties**: idempotence, conservation, and pairing invariants of the
   lint pipeline and the write-back
5. **interactions**: feature x feature (prefix x reindex x move x contexts x
   comments x selections)
6. **regressions**: harder variants of every pinned bug and taxonomy row

Each hunter gets this prompt, bracketed parts filled in, plus a paragraph
steering it at its section of the reference and at the changed code recon
assigned to it:

```
You are a bug hunter for the obsidian-footnotes Obsidian plugin at
[absolute repo path]. Your lens: [lens name].

Read CONTEXT.md (the vocabulary), then
.claude/skills/hunt-bugs/references/attack-surface.md: your lens's section
lists target functions and an edge-case checklist. Read the source of your
targets. Write vitest probes at test/hunt/probe-[lens]-<n>.test.ts covering
the checklist, the changed code named below, and your own suspicions.

Every expected value comes from an independent source of truth: Obsidian's
rendering as recorded in manual-tests/, CommonMark/GFM footnote syntax, the
README, or a ruling in docs/adr/. When the right behaviour is unclear, still
write the probe and label it a spec question rather than a bug.

Run each probe with: npx vitest run test/hunt/<file>. The obsidian package
is stubbed via test/mocks/obsidian.ts; extend the stub with no-ops if an
import fails.

Most probes will pass; that is the expected shape of a hunt. Delete probe
files whose every test passes. Keep only files with at least one red test.

Return raw data: a JSON list of findings, each with {file, testName,
oneLineScenario, expected, sourceOfTruth, actual, bugOrSpecQuestion,
confidence}. Return [] if nothing went red. src/ stays untouched.
```

Six hunters is the full-sweep default; scale down for targeted hunts, up
(split a lens, or give a changed module its own hunter) for a thorough audit.

### 3. Verify (orchestrator + skeptics)

For every finding:

1. **Re-run the probe yourself.** Green now means the hunter fooled itself:
   discard.
2. **Spawn a skeptic agent** per surviving finding (parallel, one message)
   whose job is to *refute* it: "Is the probe's `expected` actually correct
   per Obsidian's rendering, CommonMark, this repo's README, CONTEXT.md, the
   ADRs, and the intent visible in the code's comments and existing tests?
   Argue the implementation is right and the probe is wrong." Verdicts:
   - **CONFIRMED**: the expectation stands on its source of truth and the
     code misbehaves
   - **SPEC QUESTION**: the code is self-consistent but the behaviour is
     surprising or unruled; Jason decides
   - **PROBE ERROR**: the probe misreads the spec; delete it

Findings that survive with low confidence stay in the report, marked as
such: a flagged maybe beats a silent miss.

### 4. Pin and clean up

- Rewrite each CONFIRMED bug's probe as a pin at
  `test/hunt/bug-<short-slug>.test.ts` using vitest's `it.fails`, with a
  header comment: one-line scenario, what the user would see, hunt date,
  lens, source of truth. `it.fails` keeps the suite green while the bug
  exists and flips red the moment the bug is fixed, so a pin can never rot.
- SPEC QUESTIONs get the same treatment with a `// spec question:` header
  and the question spelled out.
- Delete every remaining `probe-*.test.ts`, then run the full suite
  (`npx vitest run`) and confirm it is green. Red here means cleanup is
  incomplete: finish it before reporting.
- Update the reference: bump its "last verified" date, add the new pins to
  the taxonomy, fold in any module the map lacks.

### 5. Report

End with exactly this shape, in plain language a non-programmer can follow,
no em dashes:

```
## Bug hunt results, <date>

Hunted: <lenses run> | Probes written: N | Findings: X confirmed, Y spec questions

### Confirmed bugs
1. <what the user sees, one sentence>. Pinned at test/hunt/bug-<slug>.test.ts.
   Expected <...> (source: <...>), got <...>. Severity: <data loss / wrong output / annoyance>.

### Spec questions (Jason decides: bug or intended?)
1. <behaviour>: currently does <X>; a user might expect <Y> because <source>.

### Needs a live-editor probe
<hypotheses only the running app can settle: popup, table cell sub-editors, vim, folds>

### Came up clean
<lenses and areas probed with no findings, one line each, so "no news" is
distinguishable from "not looked at">
```

Severity guide: anything that loses or corrupts user text outranks wrong
numbering, which outranks cosmetic issues.

Each confirmed bug already has its failing test, so the report is
fix-ready. Fixing starts only when Jason picks the bugs; the workflow then
is: remove `.fails`, watch it go red, fix, watch it go green.

## What this skill does not do

- Smoke-layer hunting: parallel agents cannot share the single live Obsidian
  instance, so hypotheses that need it go under "Needs a live-editor probe"
  for Jason or a serial follow-up.
- Fixing, refactoring, or committing anything beyond the `test/hunt/` pins
  and the updated reference.
