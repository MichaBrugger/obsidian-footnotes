# L15: the Linting settings page's states

Settings: open the plugin's Linting settings page.

- [ ] The **Orphans and duplicates** section sits between Rules and Reindexing, holding `Delete orphaned references`, `Delete orphaned definitions`, `Merge duplicate definitions` (all OFF by default; off = the lint ALERTS about that kind)
- [ ] `Renumber named footnotes` is greyed out while `Reindex` is off
- [ ] `Apply the note's footnote prefix` is greyed out while the prefix feature is off (main tab); the Orphans toggles are never greyed
- [ ] Turn OFF all three rules AND Reindex AND both Orphans toggles, run **Lint footnotes**: it says all lint rules are turned off (not the misleading "No linting needed."); Ctrl+S with lint-on-save says the same (2026-08-10)
- [ ] With the community Linter plugin ENABLED, the page shows a "Using the Linter plugin?" note about turning off Linter's own footnote rules; with Linter disabled, the note is hidden (2026-08-08)
