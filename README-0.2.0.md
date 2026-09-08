<!-- Temporary README for the 0.2.0 release. Replaces README.md when 0.2.0 ships. All GIF slots are marked with "GIF:" comments; every recording from 0.1.3 needs replacing. -->

# Footnote Shortcut

![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%27obsidian-footnotes%27%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json) [![Active Development](https://img.shields.io/badge/Maintenance%20Level-Actively%20Developed-brightgreen.svg)](https://gist.github.com/cheerfulstoic/d107229326a01ff0f333a1d3476e068d) ![Release Version](https://img.shields.io/github/v/release/MichaBrugger/obsidian-footnotes)

Create, navigate, and edit Obsidian footnotes with a single hotkey:

- **One hotkey for footnote creation/editing**: insert a new footnote, and jump between the footnote reference and its definition
- **Popup editor**: edit the footnote right at your cursor, no scrolling to the bottom
- **Numbered, named, and inline** footnote styles
- **Selection to footnote**: turn text you already wrote into a footnote in one press
- **Rename a footnote** everywhere at once, like renaming a variable in a code editor
- **Footnote linter** to keep footnote formatting tidy
- **Per-note footnote prefixes** keep footnotes unique even when multiple chapters are merged into a larger document, such as with the [Longform](https://github.com/kevboh/longform) or [Easy Bake](https://github.com/community-archive/obsidian-easy-bake) plugins
- Works on Obsidian Mobile

![Press the hotkey, the popup opens at the cursor, type the note, the same hotkey closes it](README/hero.gif)

## FIRST: set up your hotkeys

The plugin adds its commands **without hotkeys**, so assign your own right after installing. This is quick:

`Settings → Hotkeys → search for "Footnote Shortcut" → click the ⨁ next to a command → press your preferred keys`

Of the plugin's seven commands, the ones you'll press constantly deserve hotkeys. I personally use:

| Command                                  | Recommended hotkey                           |
| ---------------------------------------- | -------------------------------------------- |
| Insert / navigate numbered footnote | <kbd>Alt</kbd>+<kbd>0</kbd>                  |
| Insert / navigate named footnote         | <kbd>Alt</kbd>+<kbd>-</kbd>                  |
| Insert inline footnote                   | <kbd>Alt</kbd>+<kbd>=</kbd>                  |
| Insert inline footnote from clipboard    | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>=</kbd> |

<!-- GIF or screenshot: assigning a hotkey in the Hotkeys settings tab -->

The other three (**Lint footnotes**, **Rename footnote**, and **Set footnote prefix**) come up less often, so running them from the command palette works fine. Give them hotkeys too if they become part of your routine.

Everything also works on mobile from the toolbar.

<!-- GIF or screenshot: mobile toolbar with footnote shortcut commands -->

## Creating footnotes

### Numbered footnotes

Put your cursor where the footnote belongs and press the hotkey. The plugin finds the next free number, inserts the reference (say `[^3]`), creates the matching `[^3]: ` definition at the bottom of the note, and lets you type the definition text immediately.

Footnotes are never created inside code, math, comments, frontmatter, or another footnote's definition: a press there tells you why instead of leaving dead text behind.

<!-- GIF: numbered insert, popup opens, note typed, popup closed -->

### Named footnotes

Named footnotes (like `[^Smith2019]`) take two quick presses:

1. **First press** inserts an empty reference `[^]` with your cursor between the brackets. Type the name.
2. **Second press** (with your cursor still on the reference) creates the matching `[^Smith2019]: ` line and lets you write the definition text.

Names can hold almost anything (`[^Smith2019]`, `[^arXiv:1234.5678]`, `[^注]`). The exceptions are spaces, backticks, brackets, and `#`, which Obsidian can't render or find; the plugin refuses those up front rather than creating a footnote that won't work.

<!-- GIF: named footnote two-step -->

### Inline footnotes

Two commands cover Obsidian's inline `^[...]` style:

- **Insert inline footnote** places `^[]` with your cursor inside, ready to type. Press the hotkey again when you're done and the cursor hops out past the closing bracket, so you never need the arrow keys.
- **Insert inline footnote from clipboard** wraps whatever you've copied into `^[...]` in one press. Multi-line clipboard text is flattened to one line, and anything that would break the footnote (e.g. stray brackets) is escaped automatically.

<!-- GIF: inline footnote typed, then a clipboard paste -->

### Inside tables

Footnotes work in table cells too: the reference goes into the cell and the definition lands below the table. Undoing such a creation takes two undos, because the cell and the note are separate editors; a notice tells you when the first undo has only removed the definition.

### Turn selected text into a footnote

Sometimes you write something mid-sentence and realize it should be a footnote. Select it and press a footnote hotkey:

- The **numbered** hotkey replaces the selection with the next numbered footnote reference and moves the selected text into that footnote's definition. Multi-paragraph selections work too: the whole block becomes one multi-paragraph footnote, code blocks and all.
- The **named** hotkey asks you for a name first, then does the same under `[^yourname]`. Confirm with Enter, the Create button, or just press any footnote hotkey again.
- The **inline** hotkey wraps the selection as `^[...]` right where it is (single-line selections only; for a multi-line selection it points you to the other two).
- A selection that starts or ends mid-word grows to whole words first, plus one trailing punctuation mark, so a sloppy drag still produces a clean footnote. Turn **Expand selections to whole words** off in the settings if you want the exact selection.
- The reference attaches to the text before the selection: converting the second of two sentences leaves `first sentence.[^2]`, never a stray space before the reference.
- A selection that contains (or cuts through) an existing footnote refuses to convert: footnotes can't be nested inside other footnotes. Nesting is prevented throughout the plugin (it doesn't survive export to Pandoc/LaTeX and most markdown tools can't read it), and linting alerts you if a note already has hand-typed nesting.
- Tables: text inside one cell converts; a selection that cuts through a table (a cell with its pipes, a row, part of the table) refuses. To move a whole table into a footnote, select it together with the text around it.

<!-- GIF: select a clause, press hotkey, clause becomes a footnote. Repeat for all 3 types. -->

**Multiple cursors** (Alt+click) get the same footnote at every one of them, handy when one source is cited in several places. The numbered hotkey puts the same `[^N]` at every cursor, sharing a single definition. The named and inline hotkeys drop their brackets at every cursor and leave a cursor inside each pair, so you type the name (or the footnote text) once and it lands everywhere; press the hotkey again with the cursors still inside and the named footnote gets its shared definition. Pasting as an inline footnote wraps the same clipboard text at every cursor. If any cursor sits where a footnote can't go, nothing is inserted anywhere, and one undo reverts the whole press. Every multi-cursor insertion ends with a single cursor after the first reference.

## Navigating footnotes

The insert hotkeys double as navigation. What they do depends on where your cursor is:

- **On a footnote reference** (inside `[^3]` in your text): open its definition at the bottom (or right at your cursor, with the popup on).
- **On a footnote definition at the bottom** (a `[^3]: …` line): jump back to where its reference is used in your text.
- **Anywhere else**: insert a new footnote, as described above.

One hotkey takes you back and forth between a reference and its note.

<!-- GIF: cursor on reference, hotkey, popup edit; then cursor on definition, hotkey, jump back -->

### Renaming a footnote

Put your cursor on any reference or definition and run **Rename footnote**. It works like renaming a variable in a code editor: every reference and the definition get the new name in one step. It's also in the right-click menu when you click on a footnote, just like Obsidian's own rename for headings. Names are case-insensitive, so `[^Note]` and `[^note]` count as the same footnote. The command refuses names that are already taken and names a footnote can't have, and under a per-note prefix the new name gets the prefix added for you.

<!-- GIF: caret on reference, rename modal, every occurrence updates -->

### The popup editor

Creating or visiting a footnote opens its definition text in a small editor right at your cursor, so you never lose your place in the note. Close it with the same hotkey, <kbd>Escape</kbd> (from the popup or from the note), or by clicking anywhere outside; switching to Reading view closes it too. If you prefer the classic jump-to-the-bottom behavior, turn off **Edit footnotes in a popup** in the settings.

## Keeping footnotes tidy: the linter

Writing and revising can leave footnotes messy. The **Lint footnotes** command cleans up the whole note in one pass:

- **Move footnote references after punctuation**: Moves references that sit before punctuation to sit after it (`word[^1].` becomes `word.[^1]`).
- **Gather definitions**: Moves every footnote definition under your specified footnote section heading, or to the bottom of the note.
- **Alert/delete orphans**: Orphans are footnote references without a definition or definitions without a reference. You choose whether the plugin alerts you or deletes orphans.
- **Merge duplicate definitions**: if you accidentally have multiple definitions for the same footnote name, the plugin can alert you or merge them into one.
- **Reindex**: renumbers footnotes `1, 2, 3…` in the order they appear and reorders their definitions to match. Named footnotes keep their names (or get numbers too, if you prefer; see settings).


<!-- GIF: messy note, run Lint footnotes, everything snaps into place -->

Each rule can be toggled individually in **Settings → Footnote Shortcut → Linting**, along with two automatic triggers (both off by default):

- **Lint on save**: lints the note whenever you press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd> (vim users: `:w` works too).
- **Lint on footnote creation**: lints the note right after you create a new footnote.

The linter also watches for problems it can't fix by itself and tells you about them, naming every footnote involved: an empty `[^]` reference you never named, references with no definition or definitions nothing uses (while the delete toggles are off), duplicate definitions (while merging is off), names a footnote can't have (spaces, backticks, brackets, `#`), and footnotes nested inside another footnote's definition (nesting doesn't survive export, and the linter won't delete your content to fix it).

## For chapter notes: per-note footnote prefix

If you're writing a book via chapter notes (e.g. when using the [Longform](https://github.com/kevboh/longform) or [Easy Bake](https://github.com/community-archive/obsidian-easy-bake) plugins), plain numbering collides when you merge the chapters back together: every chapter has its own `[^1]`, so Obsidian confuses footnotes from chapter 1 with those from every other chapter. 

To fix this, turn on **Per-note footnote prefix** and give each chapter its own unique prefix, so footnotes stay unique across the whole book:

1. Run the **Set footnote prefix** command and enter a prefix, e.g. `2-` for chapter 2 (this saves a `footnote-prefix` property in the note).
2. From then on, the numbered command inserts `[^2-1]`, `[^2-2]`, … and the named command starts new references with the prefix (`[^2-]`) filled in.
3. The linter understands prefixes too: it renumbers `[^2-x]` footnotes within their own namespace, and can also convert a note's existing plain footnotes to carry the prefix (**Apply footnote prefix**, off by default).

Notes without the property keep normal `[^1]`, `[^2]`, … numbering. A prefix follows the same rules as a footnote name and can't end in a digit, or `[^2-1]` and `[^21]` would be indistinguishable.

<!-- GIF: add footnote prefix, add prefixed numbered and named footnotes -->
## Other settings

- **Insert footnote reference at end of word** *(on by default)*: pressing the hotkey mid-word places the reference at the end of the word, past any trailing punctuation, so you don't have to aim.
- **Expand selections to whole words** *(on by default)*: the selection twin of the above; a selection converted into a footnote grows to whole words first.
- **Enable section heading** *(off by default)*: automatically adds a heading (e.g. `# Footnotes`) above your footnote definitions. The heading text is fully customizable, can span multiple lines, and if it already exists in the note it's reused instead of duplicated.
- **Trim blank lines** *(on by default)*: removes stray blank lines from the end of the note when the first footnote is added.

## More info

- If you're new to footnotes, [+1creator's video tutorial](https://www.youtube.com/watch?v=HapgV7Y52dY) covers footnotes in Obsidian and includes a full walkthrough of this plugin. <!-- recorded on 0.1.x; popup/linting not shown -->
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

Created by Alexis Rondeau and Micha Brugger, maintained and expanded by Jason Qin.

## For developers

- **Build**: `npm install`, then `npm run build` (type-checks with `tsc` and bundles with esbuild). `npm run dev` watches for changes.
- **Tests**: `npm test` runs the [Vitest](https://vitest.dev/) unit suite in `test/`; behavioral policies (reindexing rules, reference parsing, edge cases) are pinned there, and the [fast-check](https://fast-check.dev/) property tests fuzz both the linter and the insert commands over randomly generated documents, including a differential oracle that re-parses every document with [micromark](https://github.com/micromark/micromark) before and after linting. `manual-tests/` contains scripted in-app scenarios, and `scripts/smoke-test.mjs` drives a live Obsidian instance.
- **Static checks**: `npm run lint` (ESLint with the Obsidian plugin guidelines plus typescript-eslint's `strict-type-checked`) and `npm run knip` (dead exports and unused files/dependencies, kept at zero findings).
- **Mutation testing**: `npm run mutation` runs [Stryker](https://stryker-mutator.io/) locally as a pre-release audit (incremental cache makes re-runs fast). Not wired into CI on purpose.
- **Architecture**: `src/main.ts` registers commands and settings; the command cascade and creation steps live in `src/commands/`, the shared markdown scanner and footnote grammar in `src/parsing/`, editor and caret utilities in `src/editor/`, and the linter with its pure rules in `src/linting/`.
- Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and [TESTING.md](TESTING.md).
