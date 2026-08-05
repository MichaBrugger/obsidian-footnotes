// Settings shape, defaults, and the settings tab. Requires Obsidian 1.13+:
// the tab renders from getSettingDefinitions() (declarative, auto-saving).
import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import FootnotePlugin from "./main";

export interface FootnotePluginSettings {
    insertAtEndOfWord: boolean;
    enablePopupEditor: boolean;
    enableFootnotePrefix: boolean;

    enableFootnoteSectionHeading: boolean;
    footnoteSectionHeading: string;

    enableRemoveBlankLastLines: boolean;

    keepOrphanedDefinitions: boolean;
    renumberNamedFootnotes: boolean;
    lintFixPunctuation: boolean;
    lintMoveToBottom: boolean;
    lintReindex: boolean;
    lintApplyPrefix: boolean;
    lintOnSave: boolean;
    lintOnFootnoteCreation: boolean;
}

export const DEFAULT_SETTINGS: FootnotePluginSettings = {
    insertAtEndOfWord: true,
    enablePopupEditor: true,
    enableFootnotePrefix: false,

    enableFootnoteSectionHeading: false,
    footnoteSectionHeading: "# Footnotes",

    enableRemoveBlankLastLines: true,

    keepOrphanedDefinitions: true,
    renumberNamedFootnotes: false,
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
                desc: "Footnotes respect a footnote-prefix property in the note's frontmatter: with \"footnote-prefix: 2.\" the numbered command inserts [^2.1], then [^2.2], and the named command starts its new marker with the prefix filled in ([^2.]). Useful when chapter notes are combined into one document.",
                control: { type: "toggle", key: "enableFootnotePrefix" },
            },
            {
                type: "group",
                heading: "Footnotes section",
                items: [
                    {
                        name: "Trim blank lines",
                        desc: "Remove blank lines from the end of the note when inserting a new footnotes section.",
                        control: { type: "toggle", key: "enableRemoveBlankLastLines" },
                    },
                    {
                        name: "Enable section heading",
                        desc: "Automatically adds a heading separating footnotes at the bottom of the note from the rest of the text.",
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
                ],
            },
            {
                type: "page",
                name: "Linting",
                desc: "Cleanup rules, automatic lint triggers, and reindexing behavior.",
                items: [
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
                                name: "Move definitions to the bottom",
                                desc: "The lint command gathers all footnote definitions at the end of the note.",
                                control: { type: "toggle", key: "lintMoveToBottom" },
                            },
                            {
                                name: "Apply the note's footnote prefix",
                                desc: "When the per-note footnote prefix feature is on and the note has a footnote-prefix property, linting renames plain numbered and named footnotes to carry the prefix.",
                                control: { type: "toggle", key: "lintApplyPrefix" },
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
                                desc: "Reindexing keeps definitions that no marker references, numbering them after everything else. Turn off to delete them instead.",
                                control: { type: "toggle", key: "keepOrphanedDefinitions" },
                            },
                            {
                                name: "Renumber named footnotes",
                                desc: "Reindexing gives named footnotes (like [^note]) numbers by order of appearance instead of preserving their names.",
                                control: { type: "toggle", key: "renumberNamedFootnotes" },
                            },
                        ],
                    },
                ],
            },
        ];
    }
}
