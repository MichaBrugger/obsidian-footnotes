// The footnote rule registry. Order mirrors the lint pipeline's actual
// sequence (see lintFootnotes in ../linter.ts, which composes the pure
// transforms directly): fix hidden definitions, merge duplicates, delete
// orphaned definitions, fix punctuation,
// gather definitions at the bottom, delete orphaned references against the
// settled layout, apply the note prefix, then renumber and reorder.
// The registry itself is the Linter-shaped, self-describing view of the rule
// set - ids, names, ignoreTypes, and worked examples (executed by
// test/rule-examples.test.ts).

import { FootnoteRule } from "../rule";
import { applyFootnotePrefixRule } from "./apply-footnote-prefix";
import { fixLazyDefinitionsRule } from "./fix-lazy-definitions";
import { footnoteAfterPunctuationRule } from "./footnote-after-punctuation";
import { mergeDuplicateDefinitionsRule } from "./merge-duplicate-definitions";
import { moveFootnotesToTheBottomRule } from "./move-footnotes-to-the-bottom";
import { reIndexFootnotesRule } from "./re-index-footnotes";
import { removeOrphanedDefinitionsRule } from "./remove-orphaned-definitions";
import { removeOrphanedReferencesRule } from "./remove-orphaned-references";

// `unknown` erases each rule's own options type so they share one list; the
// examples carry their own options, so consumers never need the erased type
export const footnoteRules: FootnoteRule<unknown>[] = [
    fixLazyDefinitionsRule,
    mergeDuplicateDefinitionsRule,
    removeOrphanedDefinitionsRule,
    footnoteAfterPunctuationRule,
    moveFootnotesToTheBottomRule,
    removeOrphanedReferencesRule,
    applyFootnotePrefixRule,
    reIndexFootnotesRule,
];
