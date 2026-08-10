// Settings shape, defaults, and the settings tab. Requires Obsidian 1.13+:
// the tab renders from getSettingDefinitions() (declarative, auto-saving).
import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import FootnotePlugin from "./main";
import { AppWithPlugins } from "./obsidian-internals";

export interface FootnotePluginSettings {
    /** Marks saved data whose one-time migrations have run (see loadSettings). Not shown in the settings tab. */
    settingsVersion: number;
    insertAtEndOfWord: boolean;
    enablePopupEditor: boolean;
    enableFootnotePrefix: boolean;

    enableFootnoteSectionHeading: boolean;
    footnoteSectionHeading: string;

    enableRemoveBlankLastLines: boolean;

    keepOrphanedDefinitions: boolean;
    renumberNamedFootnotes: boolean;
    /** What linting does about markers with no definition: report them ("alert") or remove them from the text ("delete"). Always one or the other — orphans are never silent (Jason, 2026-08-10). */
    lintOrphanedMarkers: "alert" | "delete";
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
    enablePopupEditor: true,
    enableFootnotePrefix: false,

    enableFootnoteSectionHeading: false,
    footnoteSectionHeading: "# Footnotes",

    enableRemoveBlankLastLines: true,

    keepOrphanedDefinitions: true,
    renumberNamedFootnotes: false,
    lintOrphanedMarkers: "alert",
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
                name: "Insert footnote at end of word",
                desc: "A new footnote is only inserted at the end of the word and after any punctuation.",
                control: { type: "toggle", key: "insertAtEndOfWord" },
            },
            {
                name: "Edit footnotes in a popup",
                desc: "Open the footnote detail in a small editor where you're typing, instead of jumping to the bottom of the note. Close with the footnote hotkey, the escape key, or by clicking outside.",
                control: { type: "toggle", key: "enablePopupEditor" },
            },
            {
                name: "Per-note footnote prefix",
                desc: "Footnotes respect a footnote-prefix property in the note's frontmatter: with \"footnote-prefix: 2.\" the numbered command inserts [^2.1], then [^2.2], and the named command starts its new marker with the prefix filled in ([^2.]). Useful when chapter notes are combined into one document. The \"Set footnote prefix\" command edits the property for you.",
                control: { type: "toggle", key: "enableFootnotePrefix" },
            },
            {
                type: "group",
                heading: "Footnotes section",
                items: [
                    {
                        name: "Enable section heading",
                        desc: "Automatically adds a heading separating footnotes at the bottom of the note from the rest of the text. If the section heading is already present, it will be used instead of adding a new one.",
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
                        // Shown only while the Linter plugin is enabled —
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
                        desc: "Lint the note right after a new footnote detail is created in it.",
                        control: { type: "toggle", key: "lintOnFootnoteCreation" },
                    },
                    {
                        type: "group",
                        heading: "Rules",
                        items: [
                            {
                                name: "Move markers after punctuation",
                                desc: "The lint command moves footnote markers that sit before punctuation to sit after it.",
                                control: { type: "toggle", key: "lintFixPunctuation" },
                            },
                            {
                                name: "Move definitions to existing footnote section heading, or to bottom",
                                desc: "The lint command gathers all footnote definitions under the note's existing section heading, or at the end of the note when there is none.",
                                control: { type: "toggle", key: "lintMoveToBottom" },
                            },
                            {
                                name: "Orphaned markers",
                                desc: "What linting does about footnote markers that have no definition (a [^5] with no \"[^5]:\" line, which Obsidian renders as plain text): alert you, or delete the markers from the text.",
                                control: {
                                    type: "dropdown",
                                    key: "lintOrphanedMarkers",
                                    defaultValue: "alert",
                                    options: {
                                        alert: "Alert",
                                        delete: "Delete",
                                    },
                                },
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
                        type: "group",
                        heading: "Reindexing",
                        items: [
                            {
                                name: "Reindex",
                                desc: "The lint command also renumbers footnotes and reorders their definitions, following the options in this reindexing section below.",
                                control: { type: "toggle", key: "lintReindex" },
                            },
                            {
                                name: "Keep orphaned definitions",
                                desc: "Reindexing keeps definitions that no marker references, numbering them after everything else; linting alerts you about the ones it keeps. Turn off to delete them instead.",
                                control: {
                                    type: "toggle",
                                    key: "keepOrphanedDefinitions",
                                    disabled: () => !this.plugin.settings.lintReindex,
                                },
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
