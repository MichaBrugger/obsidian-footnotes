// The names for the kinds of region a rule can ignore. They come from the
// obsidian-linter plugin.
//
// That plugin does the work with them: before any rule runs, it swaps every
// protected region (code, math, frontmatter and so on) for a unique
// placeholder string, then puts them all back afterwards, in reverse
// (its src/utils/ignore-types.ts).
//
// This plugin does not. Its rules protect those regions themselves, using
// the shared markdown-scan code, and that is correct and covered by tests.
// So there is no mask-and-restore helper here; a rule only DECLARES which
// ignoreTypes it respects, to match obsidian-linter's shape and to document
// itself.
//
// A placeholder-based applyIgnored helper did live in this file until
// 2026-08-10. Nothing used it, so it was removed. It is still in the git
// history if a future rule ever wants to work the way obsidian-linter does.

/**
 * The kinds of region a rule can declare that it ignores. The names match
 * obsidian-linter's own keys.
 *
 * `Code`, `InlineCode`, `Yaml` and `HtmlComment` are the ones markdown-scan
 * can blank out of the masked twin (the copy of the note with protected text
 * removed). `Math` is blanked by the line-by-line scanner instead
 * (maskLineRegions), not by a parser.
 *
 * Obsidian's "%%" comments are deliberately NOT one of these kinds.
 * Obsidian still reads what is inside them: a reference in a "%%" comment
 * binds to its definition and takes a number. So the rules treat that text
 * as live. Only the code that looks for definitions skips the block form of
 * a "%%" comment, through DocumentScan.inCommentBlock.
 */
export enum IgnoreType {
    Code = "code",
    InlineCode = "inlineCode",
    Math = "math",
    Yaml = "yaml",
    HtmlComment = "htmlComment",
}
