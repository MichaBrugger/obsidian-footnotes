// The catalogue of footnote rules.
//
// The order here is the order the lint really runs them in: fix hidden
// definitions, merge duplicates, delete orphaned definitions, fix
// punctuation, gather definitions at the bottom, delete orphaned references
// now the layout has settled, apply the note prefix, then renumber and
// reorder. The lint does not read this list to decide that: lintFootnotes
// in ../linter.ts calls each rule's apply in its own hand-written order,
// with a reason at every step. test/lint-pipeline-order.test.ts watches
// those calls and fails if the two orders ever differ, so this list can be
// trusted as a description of the pipeline.
//
// What this list is for is describing the rule set: each entry carries its
// id, its name, and worked examples, which test/rule-examples.test.ts
// actually runs.

import { FootnoteRule } from "../rule";
import { applyFootnotePrefixRule } from "./apply-footnote-prefix";
import { fixLazyDefinitionsRule } from "./fix-lazy-definitions";
import { footnoteAfterPunctuationRule } from "./footnote-after-punctuation";
import { mergeDuplicateDefinitionsRule } from "./merge-duplicate-definitions";
import { moveFootnotesToTheBottomRule } from "./move-footnotes-to-the-bottom";
import { reIndexFootnotesRule } from "./re-index-footnotes";
import { removeOrphanedDefinitionsRule } from "./remove-orphaned-definitions";
import { removeOrphanedReferencesRule } from "./remove-orphaned-references";

// Every rule takes a different kind of options, so `unknown` is used to
// forget those types and let them all sit in one list. Nothing is lost:
// each example carries the options it needs to run, so nobody reading this
// list ever has to know what type was forgotten.
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
