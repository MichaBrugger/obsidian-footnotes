// The footnote rule registry. Order mirrors the lint pipeline's dependency
// order: fix punctuation, gather definitions at the bottom, then renumber and
// reorder (see ../linter.ts, which composes the pure transforms directly).
// The registry itself is the Linter-shaped, self-describing view of the rule
// set — ids, names, ignoreTypes, and worked examples.

import { FootnoteRule } from "../rule";
import { applyFootnotePrefixRule } from "./apply-footnote-prefix";
import { footnoteAfterPunctuationRule } from "./footnote-after-punctuation";
import { moveFootnotesToTheBottomRule } from "./move-footnotes-to-the-bottom";
import { reIndexFootnotesRule } from "./re-index-footnotes";
import { removeOrphanedDefinitionsRule } from "./remove-orphaned-definitions";
import { removeOrphanedReferencesRule } from "./remove-orphaned-references";

export const footnoteRules: FootnoteRule<never>[] = [
    removeOrphanedReferencesRule,
    removeOrphanedDefinitionsRule,
    footnoteAfterPunctuationRule,
    moveFootnotesToTheBottomRule,
    reIndexFootnotesRule,
    applyFootnotePrefixRule,
];
