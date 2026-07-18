// Settings shape, defaults, and the settings tab. The tab is implemented
// TWICE on purpose: Obsidian 1.13+ renders from getSettingDefinitions()
// (declarative, auto-saving) and ignores display(); older versions call
// display() (imperative). Any settings change must be made in BOTH.
import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
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
    lintOnSave: boolean;
    lintOnFileChange: boolean;
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
    lintOnSave: false,
    lintOnFileChange: false,
};

export class FootnotePluginSettingTab extends PluginSettingTab {
    plugin: FootnotePlugin;

    constructor(app: App, plugin: FootnotePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // Obsidian 1.13.0+ renders the tab from these definitions and skips
    // display(); controls bind to this.plugin.settings[key] and auto-save
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
                desc: "Numbered footnotes respect a footnote-prefix property in the note's frontmatter: with \"footnote-prefix: 2.\" the command inserts [^2.1], then [^2.2], and so on. Useful when chapter notes are combined into one document.",
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
                        name: "Lint on focused file change",
                        desc: "Automatically lint a note when you switch from it to another note.",
                        control: { type: "toggle", key: "lintOnFileChange" },
                    },
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
                        name: "Reindex",
                        desc: "The lint command also renumbers footnotes and reorders their definitions, following the options in the reindexing section below.",
                        control: { type: "toggle", key: "lintReindex" },
                    },
                    {
                        type: "group",
                        heading: "Reindexing",
                        items: [
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

    // Obsidian < 1.13.0 falls back to this imperative implementation;
    // keep it in sync with getSettingDefinitions() above
    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
        .setName("Insert footnote at end of word")
        .setDesc("A new footnote is only inserted at the end of the word and after any punctuation.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.insertAtEndOfWord)
                .onChange(async (value) => {
                    this.plugin.settings.insertAtEndOfWord = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Edit footnotes in a popup")
        .setDesc("Open the footnote detail in a small editor where you're typing, instead of jumping to the bottom of the note. Close with the footnote hotkey, the escape key, or by clicking outside.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.enablePopupEditor)
                .onChange(async (value) => {
                    this.plugin.settings.enablePopupEditor = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Per-note footnote prefix")
        .setDesc("Numbered footnotes respect a footnote-prefix property in the note's frontmatter: with \"footnote-prefix: 2.\" the command inserts [^2.1], then [^2.2], and so on. Useful when chapter notes are combined into one document.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.enableFootnotePrefix)
                .onChange(async (value) => {
                    this.plugin.settings.enableFootnotePrefix = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Footnotes section")
        .setHeading();

        new Setting(containerEl)
        .setName("Trim blank lines")
        .setDesc("Remove blank lines from the end of the note when inserting a new footnotes section.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.enableRemoveBlankLastLines)
                .onChange(async (value) => {
                    this.plugin.settings.enableRemoveBlankLastLines = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Enable section heading")
        .setDesc("Automatically adds a heading separating footnotes at the bottom of the note from the rest of the text.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.enableFootnoteSectionHeading)
                .onChange(async (value) => {
                    this.plugin.settings.enableFootnoteSectionHeading = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Section heading")
        .setDesc("Heading to place above the footnotes section. Accepts standard Markdown, including multiple lines and dividers.")
        .addTextArea((text) =>
            text
                .setPlaceholder("Ex: '# Footnotes'")
                .setValue(this.plugin.settings.footnoteSectionHeading)
                .onChange(async (value) => {
                    this.plugin.settings.footnoteSectionHeading = value;
                    await this.plugin.saveSettings();
                })
                .then((text) => {
                    text.inputEl.addClass("footnote-shortcut-section-heading-input");
                    text.inputEl.rows = 6;
                })
        );

        // pre-1.13 Obsidian has no settings sub-pages, so the Linting page
        // renders flat here: a Linting heading, then a Reindexing heading
        // standing in for the page's Reindexing section
        new Setting(containerEl)
        .setName("Linting")
        .setHeading();

        new Setting(containerEl)
        .setName("Lint on save")
        .setDesc("Lint the file on manual save (when `ctrl + s` is pressed or when `:w` is executed while using vim keybindings)")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.lintOnSave)
                .onChange(async (value) => {
                    this.plugin.settings.lintOnSave = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Lint on focused file change")
        .setDesc("Automatically lint a note when you switch from it to another note.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.lintOnFileChange)
                .onChange(async (value) => {
                    this.plugin.settings.lintOnFileChange = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Move markers after punctuation")
        .setDesc("The lint command moves footnote markers that sit before punctuation to sit after it.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.lintFixPunctuation)
                .onChange(async (value) => {
                    this.plugin.settings.lintFixPunctuation = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Move definitions to the bottom")
        .setDesc("The lint command gathers all footnote definitions at the end of the note.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.lintMoveToBottom)
                .onChange(async (value) => {
                    this.plugin.settings.lintMoveToBottom = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Reindex")
        .setDesc("The lint command also renumbers footnotes and reorders their definitions, following the options in the reindexing section below.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.lintReindex)
                .onChange(async (value) => {
                    this.plugin.settings.lintReindex = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Reindexing")
        .setHeading();

        new Setting(containerEl)
        .setName("Keep orphaned definitions")
        .setDesc("Reindexing keeps definitions that no marker references, numbering them after everything else. Turn off to delete them instead.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.keepOrphanedDefinitions)
                .onChange(async (value) => {
                    this.plugin.settings.keepOrphanedDefinitions = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Renumber named footnotes")
        .setDesc("Reindexing gives named footnotes (like [^note]) numbers by order of appearance instead of preserving their names.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.renumberNamedFootnotes)
                .onChange(async (value) => {
                    this.plugin.settings.renumberNamedFootnotes = value;
                    await this.plugin.saveSettings();
                })
        );
    }
}
