// The shape a lint rule has to have. It is borrowed from the obsidian-linter
// plugin, which describes each of its cleanups as a Rule: an id, a name and
// description for people to read, a list of the region kinds it ignores,
// worked examples, and one pure apply(text, options) function.
//
// This plugin's own footnote cleanups are written as pure functions in
// ./rules/. The interface below wraps each of them, so the whole set reads
// as a small catalogue of rules. The ids match obsidian-linter's file names.

import { IgnoreType } from "./ignore-types";

/**
 * One worked example: a small piece of markdown before the rule ran, and the
 * same piece after. They are taken from the rule's own tests, and
 * test/rule-examples.test.ts actually runs them, so an example can never
 * quietly stop matching what the rule really does.
 */
interface RuleExample<O = void> {
    description: string;
    before: string;
    after: string;
    /**
     * The options `apply` needs to run this example. A rule whose apply
     * actually reads its options always fills this in.
     */
    options?: O;
}

/**
 * One footnote rule, working on a whole note.
 *
 * `apply` is the pure function at the heart of it: markdown in, markdown
 * out, nothing else touched. `O` is the type of the options it takes, and is
 * void for a rule that takes none.
 *
 * `ignoreTypes` says which regions the rule leaves alone. It is there to
 * match obsidian-linter's shape and to document the rule; nothing reads it
 * at runtime. Each rule protects those regions itself, using the shared
 * markdown-scan code.
 */
export interface FootnoteRule<O = void> {
    id: string;
    name: string;
    description: string;
    ignoreTypes: IgnoreType[];
    examples: RuleExample<O>[];
    apply(text: string, options: O): string;
}
