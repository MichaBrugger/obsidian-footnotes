// The Linter-shaped rule contract. obsidian-linter models each cleanup as a
// Rule with an id, human name/description, a declared set of ignore types,
// worked examples, and a pure apply(text, options). Our footnote transforms
// are rebuilt as pure functions in ./rules/*; this interface wraps each one
// so the set reads as a small rule registry (ids match Linter's filenames).

import { IgnoreType } from "./ignore-types";

/** A worked before/after pair, lifted from the rule's pinned tests. */
export interface RuleExample {
    description: string;
    before: string;
    after: string;
}

/**
 * A single whole-document footnote rule. `apply` is the pure
 * markdown → markdown transform; `O` is its options type (void when the rule
 * takes none). `ignoreTypes` is declared for parity with Linter and to
 * document which regions the transform leaves alone — the transforms
 * self-protect internally over markdown-scan, so this is documentation, not
 * wiring.
 */
export interface FootnoteRule<O = void> {
    id: string;
    name: string;
    description: string;
    ignoreTypes: IgnoreType[];
    examples: RuleExample[];
    apply(text: string, options: O): string;
}
