# A12: rapid popup entry (crash fixed 2026-08-13)

Settings: `Edit footnotes in a popup` ON. Optional: open the dev console (Ctrl+Shift+I) to watch for errors.

Starting from the end of this sentence, do three fast rounds of: press the numbered hotkey, type a few characters into the popup, press the hotkey again to close, and immediately press it again for the next footnote.

- [ ] Every definition below ends up with exactly the text typed for it — nothing swapped into a neighbor, nothing appended to the sentence itself
- [ ] The console shows no `Cannot read properties of undefined (reading 'split')` errors
- [ ] Closing feels immediate; the next popup opens without a long stall
- [ ] Repeat once in mobile emulation: same results (the bug hit both modes; desktop mangled text worse)
