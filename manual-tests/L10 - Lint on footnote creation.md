# L10: lint on footnote creation

Settings: `Lint on footnote creation` ON, everything else default.

This replaced the old `Lint on focused file change` trigger (2026-08-05): the lint now happens in the note you are LOOKING AT, at the moment a new footnote definition is created.

The line below is out of order; insert a NEW auto-numbered footnote into the word "start" and watch everything renumber at once.

start messy[^20] references[^10] here

[^20]: twenty, used first
[^10]: ten, used second

- [ ] Inserting the footnote renumbers the whole note (`[^20]`/`[^10]` become sequential) and a "Footnotes linted." notice appears
- [ ] The caret still lands on the NEW footnote's empty definition, even though the lint renumbered it
- [ ] Undo, insert a footnote into an already-clean note: no notice at all (clean creations are silent)
- [ ] With `Edit footnotes in a popup` ON: the note is ALREADY linted the moment the popup appears (renumbering visible behind it, no wait for the popup to close), and the popup edits the NEW footnote under its renumbered id — its `[^n]:` label matches the renumbered definition (2026-08-27)
- [ ] Same popup press: the popup opens AT the new reference — the caret sits just past it, not on the FIRST footnote the renumbering touched — and closing the popup hands the caret back there too (2026-08-27)
- [ ] With the toggle OFF, creation leaves the mess alone
- [ ] Switching between notes never lints anything anymore (the old trigger is gone)
