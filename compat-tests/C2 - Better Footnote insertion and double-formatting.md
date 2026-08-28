# C2: Better Footnote insertion reaction and double-formatting

Setup: Better Footnote installed and enabled with its sidebar open
(version: ______), PLUS the Tidy Footnotes plugin installed and
enabled (their auto-Tidy integration needs it; version: ______).
Their Tidy integration setting ON except where a check says
otherwise. Our settings per check. See C1 for the sidebar-only
interactions and the undo warning about their disk-path saves.

Purpose: find out what happens when two formatters react to one
insertion, and pick the combo our coexistence doc recommends. The
expected recommendation this sheet should confirm or overturn:
"their auto-Tidy OFF when our lint-on-creation is ON".

Fixture (paste as the note body; out of order on purpose so both
formatters have work to do):

Zeta zeta.[^2] Alpha alpha.[^1]

[^2]: zeta definition
[^1]: alpha definition

- [ ] Our popup ON, our lint triggers OFF, their auto-Tidy ON: insert a footnote with our hotkey after "Alpha alpha." and record what happens to our popup when Tidy rewrites the note under it (their README says the integration closes Obsidian's built-in floating editor; ours is not the built-in one, but Tidy's rewrite may still strand or close it); a closed or relocated popup is a note for the coexistence doc, any note corruption is a failure
- [ ] Double-format convergence: our lint-on-creation ON (with `Reindex` and `Move definitions` rules on), their auto-Tidy ON: insert one footnote; after both formatters settle, the note has each definition exactly once, ids `[^1]`/`[^2]`/`[^3]` in order of appearance, and definitions in one block at the bottom (our lint moves them to the bottom first, and the bottom is then where Tidy's "first definition" sits, so they should agree); then run our `Lint footnotes` manually: expect NO further changes; any ping-pong between the two formatters is the finding to record
- [ ] Undo cost: after the previous check, count how many Ctrl+Z presses fully revert the single insertion (our insert + our lint + their Tidy are separate history steps) and record the number for the coexistence doc
- [ ] Prefix mangling (predicted incompatibility, from reading Tidy's source: its numeric check treats `2.1` as a number): prefix feature ON, note frontmatter `footnote-prefix: 2.`, fixture reference `[^2.1]` with its definition; insert a new footnote (ours numbers it `[^2.2]`) with their auto-Tidy ON: expect Tidy to renumber the prefixed ids into plain `1`, `2`, destroying the prefix scheme; confirm and record as the headline reason for the OFF recommendation
- [ ] Prefix separator variant (separators must vary, per the prefix test rule): same as above with `footnote-prefix: 2-` and `[^2-1]`: Tidy's numeric check should NOT match `2-1`, so the prefixed ids survive and only plain-numbered footnotes are renumbered around them; record the asymmetry
- [ ] Recommended combo: our lint-on-creation ON, their auto-Tidy OFF: insert into the out-of-order fixture; our lint alone renumbers and moves definitions, their sidebar re-renders with the new ids and no notices; this is the config the mutual READMEs would describe
- [ ] Palette lint under their sidebar: with a clean fixture and their auto-Tidy ON, run our `Lint footnotes` from the palette (no insertion, so their "only tidy after an edit in the note's own editor" guard applies): their sidebar re-renders the renumbered cards, does NOT trigger a Tidy cascade, and shows no refused-save notices
