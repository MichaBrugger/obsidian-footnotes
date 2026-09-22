// The settings: their shape, their defaults, and the settings tab itself.
// Obsidian 1.13+ is required, because the tab is built from
// getSettingDefinitions(): you describe the controls and Obsidian renders
// them and saves them for you.
import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type FootnotePlugin from "./main";
import { AppWithPlugins } from "./editor/obsidian-internals";
import type { FootnotePlacement } from "./parsing/markdown-scan";

export interface FootnotePluginSettings {
    /** Records which one-time migrations this saved data has already been
     * through (see loadSettings). Never shown in the settings tab. */
    settingsVersion: number;
    insertAtEndOfWord: boolean;
    /** Where a reference goes relative to the punctuation after a word:
     * after it (English and most of East Asia outside the mainland and
     * Japan), before it (mainland Chinese, Japanese, French, Italian,
     * Portuguese, Polish, the EU style guide), or left at the end of the
     * word and never moved by the lint. One global choice, no per-language
     * table (Jason's ruling 2026-09-20). Read by the end-of-word hop, the
     * selection grab and the punctuation lint rule. */
    footnotePlacement: FootnotePlacement;
    /** Copying or cutting text carries the definitions its references
     * need, and pasting lands them in the destination, merged and renamed
     * to fit (issue #59; Jason, 2026-09-21: one toggle, default on, no
     * prompt). */
    carryFootnotesOnCopy: boolean;
    /** Copy also appends the carried definitions to the clipboard text
     * itself, so they reach other vaults, windows and apps, at the cost of
     * every other app receiving them as extra lines (off by default;
     * Jason's ruling 2026-09-21). */
    includeDefinitionsInClipboard: boolean;
    /** When a selection is turned into a footnote, a word the selection cut
     * in half is taken whole, and the end is moved to the end of the word
     * plus one trailing punctuation mark. The selection twin of the
     * end-of-word insertion (2026-08-29). */
    expandSelectionToWholeWords: boolean;
    enablePopupEditor: boolean;
    enableFootnotePrefix: boolean;

    enableFootnoteSectionHeading: boolean;
    footnoteSectionHeading: string;

    enableRemoveBlankLastLines: boolean;

    renumberNamedFootnotes: boolean;
    /** Linting deletes references that have no definition. While this is
     * off, it raises a lint alert about them instead: an orphan is never
     * silent either way (Jason, 2026-08-10). */
    lintDeleteOrphanedReferences: boolean;
    /** Linting deletes definitions that no reference points at. This does
     * not depend on reindexing. While it is off, they are kept and a lint
     * alert names them. The mirror image of lintDeleteOrphanedReferences. */
    lintDeleteOrphanedDefinitions: boolean;
    /** Linting folds any later duplicate definitions of one footnote into
     * the first, as continuation lines. Without that, Obsidian renders only
     * the last definition. While this is off, the duplicates are kept and a
     * lint alert names them, the same never-silent promise the orphan
     * toggles make (Jason, 2026-08-12). */
    lintMergeDuplicateDefinitions: boolean;
    lintFixPunctuation: boolean;
    /** Linting inserts the blank line a definition needs when its label
     * sits directly under a line of prose. Without that blank line Obsidian
     * reads the label as plain text. While this is off, the
     * lazy-definition alert speaks instead (Jason, 2026-09-09). */
    lintFixLazyDefinitions: boolean;
    lintMoveToBottom: boolean;
    lintReindex: boolean;
    lintApplyPrefix: boolean;
    lintOnSave: boolean;
    lintOnFootnoteCreation: boolean;
}

export const DEFAULT_SETTINGS: FootnotePluginSettings = {
    // Zero on purpose. Settings saved before this key existed have no
    // version at all, and those must run the one-time migrations (on a
    // fresh install the migrations find nothing to do). The migration code
    // in main.ts then stamps the current version and saves once.
    settingsVersion: 0,
    insertAtEndOfWord: true,
    // "after" is the behaviour every note had before the setting existed,
    // so nothing moves on upgrade; users of a before-punctuation convention
    // pick "before" themselves
    footnotePlacement: "after",
    carryFootnotesOnCopy: true,
    includeDefinitionsInClipboard: false,
    expandSelectionToWholeWords: true,
    enablePopupEditor: true,
    enableFootnotePrefix: false,

    enableFootnoteSectionHeading: false,
    footnoteSectionHeading: "# Footnotes",

    enableRemoveBlankLastLines: true,

    renumberNamedFootnotes: false,
    lintDeleteOrphanedReferences: false,
    lintDeleteOrphanedDefinitions: false,
    lintMergeDuplicateDefinitions: false,
    lintFixPunctuation: true,
    lintFixLazyDefinitions: true,
    lintMoveToBottom: true,
    lintReindex: true,
    lintApplyPrefix: true,
    lintOnSave: false,
    lintOnFootnoteCreation: false,
};

export class FootnotePluginSettingTab extends PluginSettingTab {
    plugin: FootnotePlugin;

    constructor(app: App, plugin: FootnotePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // Each control below is tied to one key in this.plugin.settings by name.
    // Obsidian reads and writes that key itself and saves automatically.
    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: "Edit footnotes in a popup",
                desc: "Open the footnote definition in a small editor where you're typing, instead of jumping to the bottom of the note. Close with the footnote hotkey, the escape key, or by clicking outside.",
                control: { type: "toggle", key: "enablePopupEditor" },
            },
            {
                name: "Insert footnote reference at end of word",
                desc: "A new footnote reference is only inserted at the end of the word, and past the punctuation after it or in front of it as the placement setting below says.",
                control: { type: "toggle", key: "insertAtEndOfWord" },
            },
            {
                name: "Footnote reference placement",
                // Jason's pick A of three, 2026-09-21: no language list, people
                // know what they want; the README keeps the conventions
                desc: "Where a footnote reference goes relative to the punctuation after a word: after it (word.[^1]), before it (word[^1].), or left at the end of the word. Applies to new footnotes and to the lint rule. Closing quotation marks and brackets are always stepped over.",
                control: {
                    type: "dropdown",
                    key: "footnotePlacement",
                    options: { after: "After punctuation", before: "Before punctuation", none: "Don't move" },
                },
            },
            {
                name: "Expand selections to whole words",
                desc: "When a selection is turned into a footnote, cut-off words at either end are included whole, along with the punctuation right after the last word when the placement is after punctuation.",
                control: { type: "toggle", key: "expandSelectionToWholeWords" },
            },
            {
                type: "group",
                heading: "Copying and pasting",
                items: [
                    {
                        name: "Carry footnote definitions on copy, cut and paste",
                        desc: "Copying or cutting text takes the definitions its footnotes need along, and pasting puts them in the destination note: a definition the note already has is reused, a name it already uses for something else is renamed so every footnote stays unique, and a cut removes the definitions it leaves unused. Works within this Obsidian window; the clipboard text itself stays clean.",
                        control: { type: "toggle", key: "carryFootnotesOnCopy" },
                    },
                    {
                        name: "Include the definitions in the copied text",
                        desc: "Copy appends the definitions to the clipboard text, so they follow into other vaults, windows and apps. The cost: every other app you paste into receives them as extra lines, and a paste from another window is tidied after Obsidian pastes it rather than in one step. Off is the mode that just works inside one window.",
                        control: {
                            type: "toggle",
                            key: "includeDefinitionsInClipboard",
                            disabled: () => !this.plugin.settings.carryFootnotesOnCopy,
                        },
                    },
                ],
            },
            {
                name: "Per-note footnote prefix",
                desc: "Footnotes use the note's footnote-prefix property: with \"footnote-prefix: 2-\", the numbered command inserts [^2-1], [^2-2], and so on, and the named command prefills [^2-]. Useful when chapter notes merge into one document. Set it with the \"Set footnote prefix\" command.",
                control: { type: "toggle", key: "enableFootnotePrefix" },
            },
            {
                type: "group",
                heading: "Footnotes section",
                items: [
                    {
                        name: "Enable section heading",
                        desc: "Automatically adds a heading separating footnote definitions at the bottom of the note from the rest of the text. If the section heading is already present, it will be used instead of adding a new one.",
                        control: { type: "toggle", key: "enableFootnoteSectionHeading" },
                    },
                    {
                        name: "Section heading",
                        desc: "Heading to place above the footnotes section. Accepts standard Markdown, including multiple lines and dividers.",
                        control: {
                            type: "textarea",
                            key: "footnoteSectionHeading",
                            rows: 6,
                            placeholder: "Ex: '# Footnotes'",
                            disabled: () => !this.plugin.settings.enableFootnoteSectionHeading,
                        },
                    },
                    {
                        name: "Trim blank lines",
                        desc: "Remove blank lines from the end of the note when the first footnote (and its section heading, if enabled) is added at the bottom.",
                        control: { type: "toggle", key: "enableRemoveBlankLastLines" },
                    },
                ],
            },
            {
                type: "page",
                name: "Linting",
                desc: "Cleanup rules, automatic lint triggers, and reindexing behavior.",
                items: [
                    {
                        // A row with no control: it shows as plain information
                        // text. It only appears while the Linter community
                        // plugin is enabled. Jason verified on 2026-08-08 that
                        // the two plugins get along, except when Linter's own
                        // footnote rules rewrite the same footnotes this plugin
                        // does.
                        name: "Using the Linter plugin?",
                        desc: "Turn off Linter's own footnote rules (footnote after punctuation, move footnotes to the bottom, re-index footnotes) so the two plugins don't fight over the same footnotes.",
                        visible: () =>
                            !!(this.app as AppWithPlugins).plugins?.plugins?.[
                                "obsidian-linter"
                            ],
                    },
                    {
                        name: "Lint on save",
                        desc: "Lint the file on manual save (when ctrl+s is pressed or when :w is executed while using vim keybindings)",
                        control: { type: "toggle", key: "lintOnSave" },
                    },
                    {
                        name: "Lint on footnote creation",
                        desc: "Lint the note right after a new footnote is created in it.",
                        control: { type: "toggle", key: "lintOnFootnoteCreation" },
                    },
                    {
                        type: "group",
                        heading: "Rules",
                        items: [
                            {
                                name: "Fix footnote reference placement",
                                desc: "The lint command moves footnote references to the side of punctuation the Footnote reference placement setting says: after it by default, or before it. Greyed out under Don't move, where the rule has nothing to do.",
                                control: {
                                    type: "toggle",
                                    key: "lintFixPunctuation",
                                    // under Don't move the rule is idle, so the
                                    // toggle is greyed rather than left looking
                                    // live (Jason, 2026-09-21)
                                    disabled: () => this.plugin.settings.footnotePlacement === "none",
                                },
                            },
                            {
                                name: "Move definitions to existing footnote section heading, or to bottom",
                                desc: "The lint command gathers all footnote definitions under the note's existing section heading, or at the end of the note when there is none.",
                                control: { type: "toggle", key: "lintMoveToBottom" },
                            },
                            {
                                name: "Fix definitions hidden by a missing blank line",
                                desc: "Linting inserts the blank line a footnote definition needs when its \"[^7]:\" line sits directly under a paragraph, list item, or quote line (Obsidian reads such a line as plain text and shows no footnote). While off, linting alerts you about them instead.",
                                control: { type: "toggle", key: "lintFixLazyDefinitions" },
                            },
                            {
                                name: "Apply the note's footnote prefix",
                                desc: "Linting adds the note's footnote-prefix to plain footnotes and renumbers the prefixed ones within their namespace. The Rename footnote command adds the prefix the same way. While off, prefixed footnotes are treated as named and keep their ids.",
                                control: {
                                    type: "toggle",
                                    key: "lintApplyPrefix",
                                    disabled: () => !this.plugin.settings.enableFootnotePrefix,
                                },
                            },
                        ],
                    },
                    {
                        // Orphans and duplicates get a section of their own
                        // (Jason, 2026-08-10 and 2026-08-12). The three toggles
                        // work the same way: while one is off, linting does not
                        // ignore that kind of problem, it alerts you about it
                        // instead. Lint is never silent.
                        type: "group",
                        heading: "Orphans and duplicates",
                        items: [
                            {
                                name: "Delete orphaned references",
                                desc: "Linting deletes footnote references that have no definition (a \"[^5]\" with no \"[^5]:\" line, which Obsidian renders as plain text). While off, linting alerts you about them instead.",
                                control: {
                                    type: "toggle",
                                    key: "lintDeleteOrphanedReferences",
                                },
                            },
                            {
                                name: "Delete orphaned definitions",
                                desc: "Linting deletes footnote definitions that have no references (a \"[^6]:\" line with no \"[^6]\", which Obsidian doesn't render). While off, linting alerts you about them instead and reindexing numbers them after everything else.",
                                control: {
                                    type: "toggle",
                                    key: "lintDeleteOrphanedDefinitions",
                                },
                            },
                            {
                                name: "Merge duplicate definitions",
                                desc: "Linting merges later duplicate definitions of the same footnote into the first one, keeping every body (Obsidian only renders the last definition otherwise). While off, linting alerts you about duplicates instead.",
                                control: {
                                    type: "toggle",
                                    key: "lintMergeDuplicateDefinitions",
                                },
                            },
                        ],
                    },
                    {
                        type: "group",
                        heading: "Reindexing",
                        items: [
                            {
                                name: "Reindex",
                                desc: "The lint command also renumbers footnotes and reorders their definitions by order of appearance, following the options in this reindexing section below.",
                                control: { type: "toggle", key: "lintReindex" },
                            },
                            {
                                name: "Renumber named footnotes",
                                desc: "Reindexing gives named footnotes (like [^note]) numbers by order of appearance instead of preserving their names.",
                                control: {
                                    type: "toggle",
                                    key: "renumberNamedFootnotes",
                                    disabled: () => !this.plugin.settings.lintReindex,
                                },
                            },
                        ],
                    },
                ],
            },
        ];
    }
}
