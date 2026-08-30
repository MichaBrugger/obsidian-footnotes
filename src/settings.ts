// Settings shape, defaults, and the settings tab. Requires Obsidian 1.13+:
// the tab renders from getSettingDefinitions() (declarative, auto-saving).
import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type FootnotePlugin from "./main";
import { AppWithPlugins } from "./editor/obsidian-internals";

export interface FootnotePluginSettings {
    /** Marks saved data whose one-time migrations have run (see loadSettings). Not shown in the settings tab. */
    settingsVersion: number;
    insertAtEndOfWord: boolean;
    /** Selection-to-footnote conversions include cut-off words whole, the end normalized to word end + one trailing punctuation mark - the end-of-word insert's selection twin (2026-08-29). */
    expandSelectionToWholeWords: boolean;
    enablePopupEditor: boolean;
    enableFootnotePrefix: boolean;

    enableFootnoteSectionHeading: boolean;
    footnoteSectionHeading: string;

    enableRemoveBlankLastLines: boolean;

    renumberNamedFootnotes: boolean;
    /** Linting deletes references that have no definition; while off, it alerts about them instead. Orphans are never silent either way (Jason, 2026-08-10). */
    lintDeleteOrphanedReferences: boolean;
    /** Linting deletes definitions that have no references (independent of reindexing); while off, they are kept and alerted about. Mirrors lintDeleteOrphanedReferences. */
    lintDeleteOrphanedDefinitions: boolean;
    /** Linting merges later duplicate definitions of a footnote into the first one as continuation lines (Obsidian renders only the last definition otherwise); while off, duplicates are kept and alerted about. Same never-silent contract as the orphan toggles (Jason, 2026-08-12). */
    lintMergeDuplicateDefinitions: boolean;
    lintFixPunctuation: boolean;
    lintMoveToBottom: boolean;
    lintReindex: boolean;
    lintApplyPrefix: boolean;
    lintOnSave: boolean;
    lintOnFootnoteCreation: boolean;
}

export const DEFAULT_SETTINGS: FootnotePluginSettings = {
    // 0 on purpose: saved data WITHOUT the key predates the flag and must
    // run the one-time migrations (they no-op on a fresh install); the
    // migration block stamps the current version and saves once
    settingsVersion: 0,
    insertAtEndOfWord: true,
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

    // controls bind to this.plugin.settings[key] and auto-save
    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: "Insert footnote reference at end of word",
                desc: "A new footnote reference is only inserted at the end of the word and after any punctuation.",
                control: { type: "toggle", key: "insertAtEndOfWord" },
            },
            {
                name: "Expand selections to whole words",
                desc: "When a selection is turned into a footnote, cut-off words at either end are included whole, and the end takes any trailing punctuation, like inserting at the end of word.",
                control: { type: "toggle", key: "expandSelectionToWholeWords" },
            },
            {
                name: "Edit footnotes in a popup",
                desc: "Open the footnote definition in a small editor where you're typing, instead of jumping to the bottom of the note. Close with the footnote hotkey, the escape key, or by clicking outside.",
                control: { type: "toggle", key: "enablePopupEditor" },
            },
            {
                name: "Per-note footnote prefix",
                desc: "Footnotes respect a footnote-prefix property in the note's frontmatter: with \"footnote-prefix: 2.\" the numbered command inserts [^2.1], then [^2.2], and the named command starts its new reference with the prefix filled in ([^2.]). Useful when chapter notes are combined into one document. The \"Set footnote prefix\" command edits the property for you.",
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
                        // control-less row: renders as plain information text.
                        // Shown only while the Linter plugin is enabled -
                        // Jason verified (2026-08-08) that the two plugins
                        // coexist fine EXCEPT when Linter's own footnote
                        // rules also rewrite the same footnotes.
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
                                name: "Move footnote references after punctuation",
                                desc: "The lint command moves footnote references that sit before punctuation to sit after it.",
                                control: { type: "toggle", key: "lintFixPunctuation" },
                            },
                            {
                                name: "Move definitions to existing footnote section heading, or to bottom",
                                desc: "The lint command gathers all footnote definitions under the note's existing section heading, or at the end of the note when there is none.",
                                control: { type: "toggle", key: "lintMoveToBottom" },
                            },
                            {
                                name: "Apply the note's footnote prefix",
                                desc: "When the per-note footnote prefix feature is on and the note has a footnote-prefix property, linting renames plain numbered and named footnotes to carry the prefix, and renumbers prefixed footnotes within their namespace. While off, footnotes carrying the prefix are treated as named footnotes and keep their ids.",
                                control: {
                                    type: "toggle",
                                    key: "lintApplyPrefix",
                                    disabled: () => !this.plugin.settings.enableFootnotePrefix,
                                },
                            },
                        ],
                    },
                    {
                        // orphans and duplicates get their own section
                        // (Jason, 2026-08-10 + 2026-08-12): the toggles
                        // mirror each other, and while one is off linting
                        // ALERTS about that problem kind instead - they are
                        // never silent
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
                                desc: "Linting deletes footnote definitions that have no references  (a \"[^6]:\" line with no \"[^6]\", which Obsidian doesn't render). While off, linting alerts you about them instead and reindexing numbers them after everything else.",
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
