import { 
  addIcon,
  Editor, 
  EditorPosition, 
  EditorSuggest, 
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  MarkdownView, 
  Plugin
} from "obsidian";

import { FootnotePluginSettingTab, FootnotePluginSettings, DEFAULT_SETTINGS } from "./settings";
import { Autocomplete } from "./autosuggest"
import { insertAutonumFootnote,insertNamedFootnote } from "./insert-or-navigate-footnotes";

//Add chevron-up-square icon from lucide for mobile toolbar (temporary until Obsidian updates to Lucide v0.130.0)
addIcon("chevron-up-square", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-square"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><polyline points="8,14 12,10 16,14"></polyline></svg>`);

export default class FootnotePlugin extends Plugin {
  public settings: FootnotePluginSettings;

  async onload() {
    await this.loadSettings();

    this.registerEditorSuggest(new Autocomplete(this));

    this.addCommand({
      id: "insert-autonumbered-footnote",
      name: "Insert / Navigate Auto-Numbered Footnote",
      icon: "plus-square",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        insertAutonumFootnote(this);
      },
    });
    this.addCommand({
      id: "insert-named-footnote",
      name: "Insert / Navigate Named Footnote",
      icon: "chevron-up-square",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        insertNamedFootnote(this);
      }
    });
  
    this.addSettingTab(new FootnotePluginSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // migrate pre-1.0.4 section heading values: the old text input implied
    // an H1, the textarea takes literal markdown, so convert once and save
    const heading = this.settings.FootnoteSectionHeading;
    if (heading && !/^(#{1,6} |---|\*\*\*|___)/.test(heading)) {
      this.settings.FootnoteSectionHeading = `# ${heading}`;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}