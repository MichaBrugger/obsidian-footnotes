import {
  addIcon,
  MarkdownView,
  Plugin
} from "obsidian";

import { FootnotePluginSettingTab, FootnotePluginSettings, DEFAULT_SETTINGS } from "./settings";
import { dismissFootnotePopup } from "./footnote-popup";
import { insertAutonumFootnote,insertNamedFootnote } from "./insert-or-navigate-footnotes";

export default class FootnotePlugin extends Plugin {
  // `declare`: refine the base Plugin.settings type (Obsidian 1.13+)
  // without emitting a class field that would shadow it
  declare settings: FootnotePluginSettings;

  async onload() {
    //Add chevron-up-square icon from lucide for mobile toolbar (temporary until Obsidian updates to Lucide v0.130.0)
    addIcon("chevron-up-square", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-square"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><polyline points="8,14 12,10 16,14"></polyline></svg>`);

    await this.loadSettings();

    this.addCommand({
      id: "insert-autonumbered-footnote",
      name: "Insert / navigate auto-numbered footnote",
      icon: "plus-square",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        insertAutonumFootnote(this);
      },
    });
    this.addCommand({
      id: "insert-named-footnote",
      name: "Insert / navigate named footnote",
      icon: "chevron-up-square",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        insertNamedFootnote(this);
      }
    });
  
    this.addSettingTab(new FootnotePluginSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => dismissFootnotePopup())
    );
  }

  onunload() {
    dismissFootnotePopup();
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<FootnotePluginSettings> | null,
    );

    // saved data from 0.1.x used a PascalCase key for the section heading
    const legacySettings = this.settings as FootnotePluginSettings & {
      FootnoteSectionHeading?: string;
      enableAutoSuggest?: boolean;
    };
    if (typeof legacySettings.FootnoteSectionHeading === "string") {
      this.settings.footnoteSectionHeading = legacySettings.FootnoteSectionHeading;
      delete legacySettings.FootnoteSectionHeading;
      await this.saveSettings();
    }

    // migrate pre-0.2.0 section heading values: the old text input implied
    // an H1, the textarea takes literal markdown, so convert once and save
    const heading = this.settings.footnoteSectionHeading;
    if (heading && !/^(#{1,6} |---|\*\*\*|___)/.test(heading)) {
      this.settings.footnoteSectionHeading = `# ${heading}`;
      await this.saveSettings();
    }

    // drop the setting for the removed autosuggest feature (Obsidian now
    // suggests footnotes natively)
    if ("enableAutoSuggest" in this.settings) {
      delete legacySettings.enableAutoSuggest;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}