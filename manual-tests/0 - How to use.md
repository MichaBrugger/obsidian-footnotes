# Manual footnote tests

One file = one focused scenario (2026-08-23 restructure: the old five
combined sheets took too much undoing to track). Every sheet states the
settings it needs, carries its own fixture text, and expects an undo
(Ctrl+Z) between checks. Default settings unless a sheet says otherwise.

- `A1-A23`: feature combos (insertion, popup, selection, multi-caret,
  navigation, rename, tables, guards)
- `L1-L17`: linting combos (rules solo and together, triggers, alerts,
  protected text, stability)

The repo's `manual-tests/` folder is the source of truth; this vault
folder is a synced copy. Move finished sheets to "Footnote Tests used"
rather than leaving ticked boxes here.

Troubleshooting: if EVERY footnote hotkey is dead, check the plugin is
actually enabled — a killed smoke-test run once left it session-enabled
only, so an Obsidian restart brought the vault up with the plugin off
(smoke script fixed 2026-08-21).
