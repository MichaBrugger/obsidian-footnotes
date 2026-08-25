# Nested footnotes are prevented plugin-wide

Obsidian (via micromark/GFM) parses and renders a footnote inside
another footnote's definition perfectly well, so the obvious path was to
allow it. We refuse to create nesting anywhere (selection conversions
that touch a live footnote artifact refuse; hand-typed nesting gets a
lint alert, never a deletion) because nesting dies on the way out of
Obsidian: Pandoc/LaTeX export drops or breaks it, most other Markdown
tools can't read it, no modern academic style uses it, and the Obsidian
Academia community unanimously called it a bad idea (decided 2026-08-24).
"Keeping footnotes clean" wins over "the renderer happens to support it."

## Consequences

- A selection that contains or cuts through any live reference,
  placeholder, or inline footnote refuses to convert, with a toast.
- Lint alerts on existing nesting but never edits it — deleting nested
  content would eat user text (see ADR-0002).
- Dead reference-shaped text inside code spans is not a footnote and
  travels freely.
