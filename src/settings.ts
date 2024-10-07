import { App, PluginSettingTab, Setting } from "obsidian";
import FootnotePlugin from "./main";

export interface FootnotePluginSettings {
    enableAutoSuggest: boolean;
    
    enableFootnoteSectionHeading: boolean;
    FootnoteSectionHeading: string;
}

export const DEFAULT_SETTINGS: FootnotePluginSettings = {
    enableAutoSuggest: true,
	
    enableFootnoteSectionHeading: false,
    FootnoteSectionHeading: "# Footnotes",
};

export class FootnotePluginSettingTab extends PluginSettingTab {
    plugin: FootnotePlugin;

    constructor(app: App, plugin: FootnotePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl("h2", {
        text: "Footnote Shortcut",
        });

        const mainDesc = containerEl.createEl('p');

            mainDesc.appendText('Need help? Check the ');
            mainDesc.appendChild(
                createEl('a', {
                text: "README",
                href: "https://github.com/MichaBrugger/obsidian-footnotes",
                })
            );
            mainDesc.appendText('!');
        containerEl.createEl('br');
        
        new Setting(containerEl)
        .setName("Enable Footnote Autosuggest")
        .setDesc("Suggests existing footnotes when entering named footnotes.")
        .addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.enableAutoSuggest)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoSuggest = value;
                    await this.plugin.saveSettings();
                })
        );

        containerEl.createEl("h3", {
            text: "Footnotes Section Behavior",
        });

        new Setting(containerEl)
        .setName("Enable Footnote Section Heading")
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
        .setName("Footnote Section Heading")
        .setDesc("Heading to place above footnotes section. Accepts standard Markdown formatting.")
        .addTextArea((text) =>
            text
                .setPlaceholder("Ex: '# Footnotes'")
                .setValue(this.plugin.settings.FootnoteSectionHeading)
                .onChange(async (value) => {
					this.plugin.settings.FootnoteSectionHeading = value;
					// console.log(`obsidian-footnotes: ${value ? "enabling" : "disabling"} automatic footnote section heading creation`);
                    await this.plugin.saveSettings();
				})
				.then((text) => {
					// text.inputEl.style.justifyContent = 'flex-start';
					text.inputEl.style.width = '100%';
					text.inputEl.rows = 6;
					text.inputEl.style.resize = 'none';
					text.inputEl.style.fontFamily = 'monospace';
				})
		).then((setting) => {
			// setting.settingEl.style.display = 'block';
		})
    }
}