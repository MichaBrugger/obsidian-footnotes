import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import FootnotePlugin from "./main";

export interface FootnotePluginSettings {
    insertAtEndOfWord: boolean;
    enablePopupEditor: boolean;

    enableFootnoteSectionHeading: boolean;
    FootnoteSectionHeading: string;

    enableRemoveBlankLastLines: boolean;
}

export const DEFAULT_SETTINGS: FootnotePluginSettings = {
    insertAtEndOfWord: true,
    enablePopupEditor: true,

    enableFootnoteSectionHeading: false,
    FootnoteSectionHeading: "# Footnotes",

    enableRemoveBlankLastLines: true,
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
                desc: "Open the footnote detail in a small editor at your cursor instead of jumping to the bottom of the note. Close with the footnote hotkey, Escape, or by clicking outside.",
                control: { type: "toggle", key: "enablePopupEditor" },
            },
            {
                type: "group",
                heading: "Footnotes Section",
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
                        desc: "Heading to place above the footnotes section. Accepts standard markdown, including multiple lines and dividers.",
                        control: {
                            type: "textarea",
                            key: "FootnoteSectionHeading",
                            rows: 6,
                            placeholder: "Ex: '# Footnotes'",
                            disabled: () => !this.plugin.settings.enableFootnoteSectionHeading,
                        },
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
        .setDesc("Open the footnote detail in a small editor at your cursor instead of jumping to the bottom of the note. Close with the footnote hotkey, Escape, or by clicking outside.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.enablePopupEditor)
                .onChange(async (value) => {
                    this.plugin.settings.enablePopupEditor = value;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
        .setName("Footnotes Section")
        .setHeading();

        new Setting(containerEl)
        .setName("Trim blank lines")
        .setDesc("Remove blank lines from the end of the note when inserting a new footnote section.")
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
        .setDesc("Heading to place above the footnotes section. Accepts standard markdown, including multiple lines and dividers.")
        .addTextArea((text) =>
            text
                .setPlaceholder("Ex: '# Footnotes'")
                .setValue(this.plugin.settings.FootnoteSectionHeading)
                .onChange(async (value) => {
                    this.plugin.settings.FootnoteSectionHeading = value;
                    await this.plugin.saveSettings();
                })
                .then((text) => {
                    text.inputEl.style.width = '100%';
                    text.inputEl.rows = 6;
                    text.inputEl.style.resize = 'none';
                    text.inputEl.style.fontFamily = 'monospace';
                })
        );
    }
}
