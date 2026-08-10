// The Linter-shaped "ignore types" vocabulary. obsidian-linter masks
// protected regions (code, math, frontmatter, …) behind unique placeholder
// strings before any rule regex runs, then restores them in reverse
// (src/utils/ignore-types.ts). Our footnote transforms self-protect
// internally over the shared markdown-scan primitives and are correct and
// tested, so no mask/restore helper is wired in — rules only DECLARE their
// ignoreTypes for parity with, and documentation of, Linter's rules. (A
// placeholder-based applyIgnored helper lived here until 2026-08-10;
// nothing used it, so it was removed — it's in git history if a future
// rule ever wants the Linter model.)

/**
 * Region kinds a rule can declare it ignores. Names mirror Linter's mdast
 * ignore keys. `Code`, `InlineCode`, `Yaml`, and `HtmlComment` are the ones
 * markdown-scan can actually mask; `Math` is masked by the inline scanner
 * (maskLineRegions) rather than a parser.
 */
export enum IgnoreType {
    Code = "code",
    InlineCode = "inlineCode",
    Math = "math",
    Yaml = "yaml",
    HtmlComment = "htmlComment",
}
