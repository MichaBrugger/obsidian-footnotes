// The Linter-shaped "ignore types" vocabulary. obsidian-linter masks
// protected regions (code, math, frontmatter, …) behind unique placeholder
// strings before any rule regex runs, then restores them in reverse
// (src/utils/ignore-types.ts). Our footnote transforms self-protect
// internally over the shared markdown-scan primitives and are correct and
// tested, so this helper is NOT wired into them — rules only DECLARE their
// ignoreTypes for parity with, and documentation of, Linter's rules. The
// applyIgnored helper is a real, reversible mask/restore built on the same
// primitives, available to any future rule that wants the Linter model.

import {
    maskInlineCode,
    normalizeEol,
    protectedLines,
    restoreEol,
} from "../markdown-scan";

/**
 * Region kinds a rule can declare it ignores. Names mirror Linter's mdast
 * ignore keys. `Code`, `InlineCode`, `Yaml`, and `HtmlComment` are the ones
 * markdown-scan can actually mask; `Math` is present for Linter parity (its
 * rules declare it) but the plugin has no math parser, so applyIgnored leaves
 * math untouched — declaration-only.
 */
export enum IgnoreType {
    Code = "code",
    InlineCode = "inlineCode",
    Math = "math",
    Yaml = "yaml",
    HtmlComment = "htmlComment",
}

// Unique per masked region so two regions never collide, and so a rule that
// changes a placeholder's surroundings can't accidentally match another's
// (Linter's issue #201 habit). Time + counter + random makes a collision with
// real note text effectively impossible; only plain letters/digits/hyphens so
// restore-by-split needs no `$`-escaping.
let placeholderCounter = 0;
function newPlaceholder(): string {
    placeholderCounter += 1;
    const rand = Math.random().toString(36).slice(2);
    return `FOOTNOTE-IGNORE-PLACEHOLDER-${Date.now().toString(36)}-${placeholderCounter}-${rand}-END`;
}

interface Restore {
    placeholder: string;
    original: string;
}

// Replace every inline code span in one line with a placeholder, recording
// the originals. maskInlineCode gives the line with spans blotted to NULs at
// matching indices, so contiguous NUL runs mark exactly the spans to lift.
function maskInlineSpansInLine(line: string, restores: Restore[]): string {
    const nulled = maskInlineCode(line);
    let out = "";
    let i = 0;
    while (i < line.length) {
        if (nulled[i] === "\0") {
            let j = i;
            while (j < line.length && nulled[j] === "\0") j++;
            const placeholder = newPlaceholder();
            restores.push({ placeholder, original: line.slice(i, j) });
            out += placeholder;
            i = j;
        } else {
            out += line[i];
            i++;
        }
    }
    return out;
}

/**
 * Run `fn` over `text` with the requested region kinds masked behind unique
 * placeholders, then restore them in reverse order. Protected line runs
 * (fenced code, YAML frontmatter, multi-line HTML comments) are masked
 * line-by-line so line counts and indices stay stable for a line-based rule;
 * inline code spans are masked span-by-span. `Math` is declared-only (no
 * masking). EOL is normalized to LF for `fn` and restored on the way out.
 */
export function applyIgnored(
    text: string,
    types: IgnoreType[],
    fn: (masked: string) => string,
): string {
    const { text: normalized, eol } = normalizeEol(text);
    const lines = normalized.split("\n");
    const isProtected = protectedLines(lines);
    const restores: Restore[] = [];

    const maskProtected =
        types.includes(IgnoreType.Code) ||
        types.includes(IgnoreType.Yaml) ||
        types.includes(IgnoreType.HtmlComment);
    const maskInline = types.includes(IgnoreType.InlineCode);

    const masked = lines.map((line, i) => {
        if (maskProtected && isProtected[i]) {
            const placeholder = newPlaceholder();
            restores.push({ placeholder, original: line });
            return placeholder;
        }
        if (maskInline) {
            return maskInlineSpansInLine(line, restores);
        }
        return line;
    });

    let result = fn(masked.join("\n"));
    // restore in reverse; split/join (not replace) so a `$` in restored
    // content is never read as a regex backreference
    for (let i = restores.length - 1; i >= 0; i--) {
        result = result.split(restores[i].placeholder).join(restores[i].original);
    }
    return restoreEol(result, eol);
}
