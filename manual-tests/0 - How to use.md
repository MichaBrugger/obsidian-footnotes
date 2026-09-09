# Manual footnote tests

One sheet = one theme (2026-09-08 restructure: the 43 scenario sheets
were too many and split single features across several files). Every
sheet states the settings it needs, carries EVERY fixture it uses (no
typing or pasting to set a check up), and expects an undo (Ctrl+Z)
between checks. Default settings unless a sheet says otherwise.

| Sheet | Theme |
| --- | --- |
| 01 | Numbered footnotes: insertion basics, end-of-word on and off |
| 02 | Named footnotes: the two-step flow, the empty-reference guard |
| 03 | Inline footnotes: typing, the clipboard, hotkeys inside them |
| 04 | The popup editor: basics, persistence, rapid entry |
| 05 | Navigation: jumps both ways, tricky names, orphans, duplicates |
| 06 | Selection to footnote: conversions and their refusals |
| 07 | Selection block zoo: every block type travels whole |
| 08 | Tables: inserting in cells, converting in cells, cut refusals |
| 09 | Multiple cursors: the same footnote at every caret |
| 10 | Rename footnote: the command and the right-click menu |
| 11 | Section heading: single-line and divider, insert and lint |
| 12 | A `# Footnotes` heading already mid-note |
| 13 | A divider + heading pair already mid-note |
| 14 | Footnote prefix: inserting under it, the Set footnote prefix command |
| 15 | Footnote prefix and the linter (apply-prefix rule) |
| 16 | A note whose footnote-prefix property is invalid |
| 17 | Tricky footnote names: backticks, dollars, case, `#`, CJK |
| 18 | Protected text and read-only views: creation guards, Reading view, lint |
| 19 | Refusals catalog: every toast and inline reason, quoted exactly |
| 20 | Lint rules alone and together: one fixture, seven fences |
| 21 | Lint stability: the definition-on-line-one shape |
| 22 | Lint triggers (on save, on creation) and the settings page |
| 23 | Lint alerts: orphans, strays, empties, invalid names, nesting, duplicates |
| 24 | Phone and mobile emulation (needs a beta on the phone) |
| 25 | Definition labels directly after a prose line are prose (Obsidian's rule, matched 2026-09-09) |

Inter-plugin compatibility sheets live separately in the repo's
`compat-tests/` folder (vault mirror: "Footnote Compat Tests"); they
need other plugins installed and follow different pass/fail rules.

The repo's `manual-tests/` folder is the source of truth; the vault
folder "Footnote Tests" is a synced copy. Move finished sheets to
"Footnote Tests USED" rather than leaving ticked boxes here.

Troubleshooting: if EVERY footnote hotkey is dead, check the plugin is
actually enabled; a killed smoke-test run once left it session-enabled
only, so an Obsidian restart brought the vault up with the plugin off
(smoke script fixed 2026-08-21).

## Where the old sheets went

Code comments, tests, and commit messages cite the old ids (for
example "Jason's A19 pass, 2026-09-04"). This map keeps those
citations readable.

| Old | New | | Old | New |
| --- | --- | --- | --- | --- |
| A1, A2, A15 | 01 | | L1 to L6 | 20 |
| A16 | 02 | | L7, L8 | 11 |
| A17 | 03 | | L9, L10, L15 | 22 |
| A3, A12, A20 | 04 | | L11 | 15 |
| A22 | 05 | | L12 | 18 |
| A8, A9 | 06 (tables to 08) | | L13, L14 | 23 |
| A13 | 07 | | L16 | 01 and 20 |
| A21 | 08 | | L17 | 21 |
| A14 | 09 | | P1 | 24 |
| A10, A11 | 10 | | | |
| A4, A5 | 11, 12, 13 | | | |
| A6, A7 | 14 (invalid property to 16) | | | |
| A18, A19 | 18 | | | |
| A23 | 17 (prefix items to 14 and 16) | | | |
| A24 | 19 | | | |
