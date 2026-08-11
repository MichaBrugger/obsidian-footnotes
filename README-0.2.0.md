<!-- Temporary README for the 0.2.0 release. Replaces README.md when 0.2.0
     ships. All GIF slots are marked with "GIF:" comments; every recording
     from 0.1.3 needs replacing. -->

# Footnote Shortcut

![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%27obsidian-footnotes%27%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json) [![Active Development](https://img.shields.io/badge/Maintenance%20Level-Actively%20Developed-brightgreen.svg)](https://gist.github.com/cheerfulstoic/d107229326a01ff0f333a1d3476e068d) ![Release Version](https://img.shields.io/github/v/release/MichaBrugger/obsidian-footnotes)

Footnotes in Obsidian normally mean a lot of jumping around: scroll to the bottom to check your numbering, type the reference, scroll down again to write the note, scroll back to where you were. This plugin turns all of that into a single hotkey. Press it to create a footnote, press it to jump between a footnote and its text, and edit the note right where your cursor is in a small popup. It can also tidy up your footnotes for you: renumbering them in reading order, gathering them at the bottom, and moving references to the right side of punctuation.

<!-- GIF: hero. Press hotkey mid-sentence, popup opens at cursor, type the note, hotkey again to close -->

## First things first: set up your hotkeys

The plugin adds its commands **without hotkeys**, so assign your own right after installing. This is quick:

`Settings → Hotkeys → search for "Footnote" → click the ⊕ next to a command → press your preferred keys`

Recommended (what the maintainer uses):

- <kbd>Alt</kbd>+<kbd>0</kbd> for Insert / navigate auto-numbered footnote
- <kbd>Alt</kbd>+<kbd>-</kbd> for Insert / navigate named footnote

<!-- GIF or screenshot: assigning a hotkey in the Hotkeys settings tab -->

Everything below also works from the command palette (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>P</kbd>) and, on mobile, from the toolbar.

## Creating footnotes

### Auto-numbered footnotes

Put your cursor where the footnote belongs and press the hotkey. The plugin finds the next free number, inserts the reference (say `[^3]`), creates the matching `[^3]: ` line at the bottom of the note, and lets you type the note text immediately, either in a popup at your cursor or at the bottom of the note if you've turned the popup off.

<!-- GIF: auto-numbered insert, popup opens, note typed, popup closed -->

### Named footnotes

Named footnotes (like `[^Smith2019]`) take two quick presses:

1. **First press** inserts an empty reference `[^]` with your cursor between the brackets. Type the name.
2. **Second press** (with your cursor still on the reference) creates the matching `[^Smith2019]: ` line and lets you write the note.

<!-- GIF: named footnote two-step -->

### Inline footnotes

Two commands cover Obsidian's inline `^[...]` style:

- **Insert inline footnote** places `^[]` with your cursor inside, ready to type. Press the hotkey again when you're done and the cursor hops out past the closing bracket, so you never need the arrow keys.
- **Insert inline footnote from clipboard** wraps whatever you've copied into `^[...]` in one press. Multi-line clipboard text is flattened to one line, and anything that would break the footnote (stray brackets) is escaped automatically.

<!-- GIF: inline footnote typed, then a clipboard paste -->

## Navigating footnotes

The insert hotkeys double as navigation. What they do depends on where your cursor is:

- **On a reference** (inside `[^3]` in your text): jump to its note at the bottom. With the popup enabled, the note opens right there instead, and your cursor never moves.
- **On a footnote's text at the bottom** (a `[^3]: …` line): jump back to where the reference is used in your text.
- **Anywhere else**: insert a new footnote, as described above.

So one hotkey bounces you back and forth: reference to note, note to reference.

<!-- GIF: cursor on reference, hotkey, popup edit; then cursor on definition, hotkey, jump back -->

### The popup editor

Creating or visiting a footnote opens its text in a small editor right at your cursor, so you never lose your place in the note. Close it with the same hotkey, <kbd>Escape</kbd>, or by clicking anywhere outside. Prefer the classic jump-to-the-bottom behavior? Turn off **Edit footnotes in a popup** in the settings.

While the popup is open, your edits flow into the note after a short pause, and undo works the same way as in Obsidian's own footnote hover editor.

## Keeping footnotes tidy: the linter

Writing and revising leaves footnotes messy: numbers out of order, notes scattered mid-document, references on the wrong side of periods. The **Lint footnotes** command cleans up the whole note in one go:

- **Reindex**: renumbers footnotes `1, 2, 3…` in the order they appear and reorders their definitions to match. Named footnotes keep their names (or get numbers too, if you prefer; see settings).
- **Gather definitions**: moves every footnote definition under your footnote section heading, or to the bottom of the note.
- **Fix punctuation**: moves references that sit before punctuation to sit after it (`word[^1].` becomes `word.[^1]`).

<!-- GIF: messy note, run Lint footnotes, everything snaps into place -->

Each rule can be toggled individually in **Settings → Footnote Shortcut → Linting**, along with two automatic triggers (both off by default):

- **Lint on save**: cleans the note whenever you press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd> (vim users: `:w` works too).
- **Lint on footnote creation**: cleans the note right after you create a new footnote.

The automatic triggers are quiet: they only show a message when they actually changed something.

The linter also watches for problems it can't fix by itself, such as an empty `[^]` reference you never named, and tells you so you can sort them out.

## For chapter notes: per-note footnote prefix

Writing chapters that will be combined into one document? Plain numbering collides, because every chapter has its own `[^1]`. Turn on **Per-note footnote prefix** and give each chapter its own prefix, and footnotes stay unique across the whole book:

1. Run the **Set footnote prefix** command and enter a prefix, e.g. `2.` for chapter 2 (this saves a `footnote-prefix` property in the note).
2. From then on, the auto-numbered command inserts `[^2.1]`, `[^2.2]`, … and the named command starts new references with the prefix filled in.
3. The linter understands prefixes too: it renumbers `[^2.x]` footnotes within their own namespace, and can even convert a note's existing plain footnotes to carry the prefix.

Notes without the property keep plain `[^1]`, `[^2]`, … numbering.

## Other settings

- **Insert footnote at end of word** *(on by default)*: pressing the hotkey mid-word places the reference at the end of the word, past any trailing punctuation, so you don't have to aim.
- **Enable section heading** *(off by default)*: automatically adds a heading (e.g. `# Footnotes`) above your footnotes. The heading text is fully customizable, can span multiple lines, and if it already exists in the note it's reused instead of duplicated.
- **Trim blank lines** *(on by default)*: removes stray blank lines from the end of the note when the first footnote is added.

Footnotes inside tables, code blocks, and frontmatter are all handled sensibly: the commands work inside table cells without breaking the table, and anything that merely *looks* like a footnote inside code is left alone.

## More info

- New to footnotes? [+1creator's video tutorial](https://www.youtube.com/watch?v=HapgV7Y52dY) covers footnotes in Obsidian and includes a full walkthrough of this plugin. <!-- recorded on 0.1.x; popup/linting not shown -->
- [Plugin wiki](https://github.com/MichaBrugger/obsidian-footnotes/wiki)
  - [How footnotes work in Obsidian](https://github.com/MichaBrugger/obsidian-footnotes/wiki/Footnote-Functionality)
  - [Debug guide](https://github.com/MichaBrugger/obsidian-footnotes/wiki/Debug-Guide)

## Background

This plugin is based on the great idea by [jacob.4ristotle](https://forum.obsidian.md/u/jacob.4ristotle/summary) posted in the ["Footnote Shortcut"](https://forum.obsidian.md/t/footnote-shortcut/8872) thread:

> **Use case or problem:**
>
> I use Obsidian to take school notes, write essays and so on, and I find myself needing to add frequent footnotes. Currently, to add a new footnote, I need to:
>
> - scroll to the bottom to check how many footnotes I already have
> - type [^n] in the body of the note, where n is the next number
> - move to the end of the note, type [^n] again, and then add my citation.

Created by Alexis Rondeau, maintained and expanded by Micha Brugger and Jason Qin.

## For developers

- **Build**: `npm install`, then `npm run build` (type-checks with `tsc` and bundles with esbuild). `npm run dev` watches for changes.
- **Tests**: `npm test` runs the [Vitest](https://vitest.dev/) unit suite in `test/`; behavioral policies (reindexing rules, reference parsing, edge cases) are pinned there, and `test/properties.test.ts` adds [fast-check](https://fast-check.dev/) property-based tests over randomly generated documents — including a differential oracle that re-parses every document with [micromark](https://github.com/micromark/micromark) before and after linting. `manual-tests/` contains scripted in-app scenarios, and `scripts/smoke-test.mjs` drives a live Obsidian instance.
- **Static checks**: `npm run lint` (ESLint with the Obsidian plugin guidelines plus typescript-eslint's `strict-type-checked`) and `npm run knip` (dead exports, unused files/dependencies — kept at zero findings).
- **Mutation testing**: `npm run mutation` runs [Stryker](https://stryker-mutator.io/) locally as a pre-release audit (incremental cache makes re-runs fast). Not wired into CI on purpose.
- **Architecture**: `src/main.ts` registers commands and settings; the insert/navigate cascade lives in `src/insert-or-navigate-footnotes.ts`; the popup editor in `src/footnote-popup.ts`; the linter and its pure rules in `src/linting/`; the shared markdown scanner (protection, masking, definition blocks) in `src/markdown-scan.ts`.
- Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and [TESTING.md](TESTING.md).
