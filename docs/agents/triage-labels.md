# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps
those roles to the actual label strings used in this repo's GitHub
issues. The mapping reuses the repo's stock GitHub labels where one
already carries the meaning (Jason's call, 2026-08-25), so the label
list outside contributors see stays familiar; `needs-triage` is the only
label created for this system.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `question`           | Waiting on reporter for more information |
| `ready-for-agent`          | _(not used)_         | This repo doesn't queue issues for AFK agents — when a skill wants this role, apply `help wanted` instead and note it in a comment |
| `ready-for-human`          | `help wanted`        | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"),
use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.
