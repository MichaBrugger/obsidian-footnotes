---
name: hunt-bugs
description: Adversarial bug hunt for the obsidian-footnotes plugin — fan out parallel hunter agents over the plugin's attack surface, prove every suspected bug with a failing vitest probe, and pin confirmed bugs as it.fails tests. Use whenever the user wants to find bugs, hunt bugs, stress-test, fuzz, break the plugin, probe edge cases, check robustness before a release, or asks "what bugs are lurking" — even if they don't say the word "bug". Also use after landing a risky feature to sweep it for regressions.
---

# Bug hunt: prove it or it didn't happen

The goal is to find bugs Jason's manual testing can't reach. The one hard rule
that makes this a *hunt* rather than a code review:

> **A bug does not exist until a vitest probe demonstrates it against the real
> code.** Reading the code and saying "this looks wrong" produces a hypothesis,
> never a finding. Every finding in the final report must point at a probe test
> that fails right now, with the failure output to show for it.

This rule exists because plausible-looking bugs found by reading regexes are
wrong more than half the time — the surrounding code compensates, or the
"expected" behavior was never the spec. Running the probe settles it.

## Ground rules for this repo

- Run tests with `npx vitest run <file>` — **never bare `npm test`**, which is
  watch mode and blocks forever.
- Unit tests import from `../src/...`; the `obsidian` package is aliased to the
  stub in `test/mocks/obsidian.ts` (see `vitest.config.ts`). If a probe's
  import chain breaks on a missing obsidian export, extend the stub with a
  no-op rather than abandoning the probe.
- Probes live in `test/hunt/probe-<lens>-<n>.test.ts`. That directory is part
  of the vitest include pattern, so keep probes tidy and **delete every probe
  that didn't confirm a bug** before finishing.
- Do not touch `scripts/smoke-test.mjs`, existing tests, or `src/` — this
  skill finds bugs, it does not fix them.

## The pipeline

### 1. Recon (orchestrator, cheap)

Read [references/attack-surface.md](references/attack-surface.md) — the module
map, the historical bug taxonomy, and the edge-case checklists. Then check
whether it's stale: `git log --oneline -15` and a quick
`grep -n "^export" src/*.ts` diffed mentally against the reference. If new
modules or exports appeared since the reference was written, fold them into
the hunt (and update the reference file at the end — it's part of the repo).

Scope the hunt to what the user asked: a full sweep uses every lens below; a
targeted request ("hunt the reindexer") uses only the relevant lenses but
always includes the **interaction** lens, because single-module bugs are
mostly fished out already — the survivors live between modules.

### 2. Fan out hunters (parallel, one message)

Spawn one subagent per lens with the Agent tool, all in a single message,
with **`run_in_background: false`** on every call — parallel tool calls in one
message still run concurrently, and blocking on them matters: if the
orchestrator idles waiting for background children it can miss their results
(when this skill itself runs inside a subagent, background-child notifications
bubble past it) and, in a worktree, the idle orchestrator's still-clean tree
gets auto-cleaned out from under the hunters.

Set **`model: "opus"`** (or `"sonnet"`) on every hunter and skeptic — hunting
is breadth work that doesn't need the top-tier model, and per-lens agents burn
tokens fast (Jason's standing rule: bug-testing subagents run on Opus or
Sonnet, never Fable).

Lenses, from `references/attack-surface.md`:

1. **grammar** — marker/definition parsing vs. what Obsidian actually accepts
2. **contexts** — protected regions: code, math, frontmatter, callouts, tables
3. **offsets** — cursor/index arithmetic: boundaries, unicode, empty inputs
4. **properties** — idempotence and invariants of the pure transforms
5. **interactions** — feature × feature: prefix × reindex × tidy × contexts
6. **regressions** — mutations of every historical bug in the taxonomy

Each hunter gets this prompt skeleton (fill the bracketed parts):

```
You are a bug hunter for the obsidian-footnotes Obsidian plugin at
[absolute repo path]. Your lens: [lens name].

Read .claude/skills/hunt-bugs/references/attack-surface.md first — your
lens's section lists the target functions and the edge-case checklist.
Read the source of your target modules. Then write vitest probe tests at
test/hunt/probe-[lens]-<n>.test.ts exercising the checklist plus any
suspicion of your own. Base expectations on documented Markdown/Obsidian
footnote behavior and on what a user would obviously want — when you are
not sure what the right behavior is, still write the probe and flag it as
a spec question instead of a bug.

Run each probe with: npx vitest run test/hunt/<file>  (never bare npm test
— it watches). The obsidian package is stubbed via test/mocks/obsidian.ts;
extend the stub with no-ops if an import fails.

Iterate: most probes will pass — that is expected and fine. Delete probe
files whose every test passes. Keep only files containing at least one
failing test.

Return raw data, not prose: a JSON list of findings, each with
{file, testName, oneLineScenario, expected, actual, bugOrSpecQuestion,
confidence}. Return [] if nothing failed. Do not fix anything in src/.
```

Add a lens-specific paragraph steering each hunter at its section of the
reference. Six hunters is the full-sweep default; scale down for targeted
hunts, up (split a lens in two) when the user asks for a *thorough* audit.

### 3. Verify (orchestrator + skeptics)

For every finding:

1. **Re-run the probe yourself.** If it passes now, the hunter fooled itself —
   discard.
2. **Spawn a skeptic agent** per surviving finding (parallel, one message)
   whose job is to *refute* it: "Is the probe's `expected` actually correct
   per Markdown/Obsidian semantics, this repo's README/TESTING.md, and the
   intent visible in the code's comments and existing tests? Argue the
   implementation is right and the probe is wrong." Verdicts:
   - **CONFIRMED** — expected behavior is defensible, code misbehaves → a bug
   - **SPEC QUESTION** — code is self-consistent but the behavior is
     surprising/undocumented → Jason decides
   - **PROBE ERROR** — the probe misreads the spec → delete it

Findings that survive with low confidence stay in the report, marked as such —
better a flagged maybe than a silent miss.

### 4. Pin and clean up

- Rewrite each CONFIRMED bug's probe as a pinning test at
  `test/hunt/bug-<short-slug>.test.ts` using vitest's **`it.fails`** modifier,
  with a header comment: one-line scenario, hunt date, and lens. `it.fails`
  keeps `npm test` green while the bug exists and flips red the moment the
  bug gets fixed — so the pin can never silently rot.
- SPEC QUESTIONs get the same treatment but with a `// spec question:` header
  and the question spelled out.
- Delete all remaining `probe-*.test.ts` files, then run the **full** suite
  (`npx vitest run`) and confirm it is green before reporting. A red suite
  here means cleanup is incomplete — fix that, don't report around it.

### 5. Report

End with exactly this shape (prose, not raw JSON):

```
## Bug hunt results — <date>

Hunted: <lenses run> | Probes written: N | Findings: X confirmed, Y spec questions

### Confirmed bugs
1. <one-line scenario> — pinned at test/hunt/bug-<slug>.test.ts
   expected <...>, got <...). Severity: <data-loss / wrong-output / annoyance>.

### Spec questions (Jason decides: bug or intended?)
1. <behavior> — currently does <X>; a user might expect <Y>.

### Came up clean
<lenses/areas probed with no findings — one line each, so "no news" is
distinguishable from "not looked at">
```

Severity guide: anything that **loses or corrupts user text** (a transform
eating a line, an edit landing at the wrong offset) outranks wrong numbering,
which outranks cosmetic issues.

Per this repo's conventions, each confirmed bug already has its failing test
(the `it.fails` pin) — so the report is fix-ready. Do not start fixing unless
Jason says to; when he picks bugs to fix, the workflow is: remove `.fails`,
watch it go red, fix, watch it go green.

## What this skill does NOT do

- No smoke-layer hunting by default: parallel agents can't share the single
  live Obsidian instance. If a hypothesis is untestable in vitest (popup
  behavior, table cell sub-editors, vim mode), list it in the report under
  "needs a live-editor probe" instead of guessing — Jason can run
  `npm run test:smoke` territory manually or ask for a serial follow-up.
- No fixing, no refactoring, no committing of anything except the
  `test/hunt/` pins and an updated attack-surface reference.
