# C1: Better Footnote popup and sidebar coexistence

Setup: install and enable the Better Footnote community plugin
(record its version here when testing: ______), open its sidebar via
the `Open Better Footnote` command, and leave its Tidy Footnotes
integration OFF (their setting; auto-Tidy interplay is C2's job). Our
settings: `Edit footnotes in a popup` ON, lint triggers OFF except
where a check says otherwise.

Purpose: this sheet backs the compatibility claim in the planned
outreach to their dev (2026-08-28). Where a check says "record", the
outcome is unknown and the answer decides what our coexistence doc
says; a surprising-but-safe behavior is a note, not a failure. Only
note corruption or data loss is a failure.

Undo warning: Better Footnote sidebar saves ride the main editor's
history only while an editor holds the note; some of their saves go
straight to disk and are NOT undoable (their 1.5.5 release notes).
After any check involving a sidebar edit, restore the fixture by
re-pasting it rather than trusting Ctrl+Z.

Fixture (paste as the note body):

Alpha alpha.[^1] Beta beta.[^note]

[^1]: first definition
[^note]: named definition

- [ ] Insert a new footnote with our hotkey mid-paragraph: our popup opens at the caret, their sidebar grows a card for the new footnote, and nothing closes our popup (their README only claims to close Obsidian's BUILT-IN floating editor, and only via the Tidy integration, which is off here)
- [ ] Type a definition in our popup and pause ~2s with it open (live propagation writes the definition line): their sidebar card catches up and shows the typed text
- [ ] Open our popup on `[^1]` (hotkey on the reference), then edit the SAME definition in their sidebar card and click back into the note: the note ends with exactly ONE `[^1]:` definition line, no merged or duplicated garbage; record which edit won, or whether their stale-content guard refused the card save with their keep-your-text notice
- [ ] With our popup open on `[^1]`, click that footnote's card in their sidebar (their jump-to-marker): the caret lands on the in-text reference and flashes; our popup closes via its click-outside path or stays anchored (record which); no console errors; note text unchanged
- [ ] With our popup open on `[^note]`, right-click its sidebar card and use their `Delete this footnote`: after confirming, BOTH the reference and definition are gone and our popup does not write the deleted definition back (no resurrection on popup close, no orphan reappearing after ~2s)
- [ ] Run our `Rename footnote` command on `[^1]` and rename it to `renamed`: their sidebar card updates to the new id and its click-to-marker jump still lands on the renamed reference
- [ ] Start typing in a sidebar card WITHOUT clicking away, then run our `Lint footnotes` command from the palette (with `Reindex` on, so ids change under them): their guard should refuse the stale card save and keep the text in their notice (their 1.5.5 data-safety pass); the note itself stays consistent, with no doubled definitions and no card text spliced into the wrong footnote
