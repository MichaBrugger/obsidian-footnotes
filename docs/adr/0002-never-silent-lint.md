# Lint is never silent about problems it won't fix

A linter could either auto-fix everything it recognizes or quietly skip
what it can't. We chose a third posture (2026-08-10): every
content-destroying fix is OFF by default and surfaced as a lint alert
instead — orphaned references/definitions alert rather than delete,
duplicate definitions alert rather than merge, nesting and unnamed
placeholders alert and are never editable at all. The trade-off is
noisier notices in exchange for a hard guarantee: lint never eats user
text the user didn't explicitly opt into losing. Deletion/merge become
available only by flipping the matching setting.

## Consequences

- Every alert names the footnotes involved and the reason, so the user
  can fix by hand or opt into the destructive rule.
- A clean-looking "Footnotes linted." can still be followed by alerts —
  that is the design, not an inconsistency.
