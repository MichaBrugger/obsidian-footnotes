# Inter-plugin compatibility tests

Separate from `manual-tests/` because these are a different beast:
they need OTHER community plugins installed in the sandbox vault,
they characterize those plugins' behavior as much as ours, and their
pass/fail rules differ. Exploratory "record" checks are expected to
produce notes for the coexistence doc, not ticks; only note
corruption or data loss counts as a failure. Re-run when either side
ships a release that touches the shared surface, and update each
sheet's recorded plugin versions.

- `C1-C2`: Better Footnote (C2 also needs Tidy Footnotes). Written
  2026-08-28 to gate the outreach to their dev; run after our 0.2.0
  stable, before sending it.

Same conventions as manual-tests otherwise: one file per scenario,
settings stated up top, fixtures embedded, restore fixtures between
checks (re-paste rather than Ctrl+Z where a sheet warns that the
other plugin's saves bypass undo history).

The repo's `compat-tests/` folder is the source of truth; the vault
folder "Footnote Compat Tests" is a synced copy. Move finished
sheets to "Footnote Tests used" rather than leaving ticked boxes
here.
