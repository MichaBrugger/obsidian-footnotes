// Plugin entry point: registers the four hotkey commands (auto-numbered and
// named footnotes — each one "insert OR navigate", see
// insert-or-navigate-footnotes.ts for the decision cascade — plus the two
// inline-footnote inserts), the settings tab, and the popup-dismissal hook.
// Also owns settings load/save plus one-time migrations of legacy values.
import {
  addIcon,
  MarkdownView,
  Plugin
} from "obsidian";

import { FootnotePluginSettingTab, FootnotePluginSettings, DEFAULT_SETTINGS } from "./settings";
import { dismissFootnotePopup } from "./footnote-popup";
import {
  insertAutonumFootnote,
  insertInlineFootnote,
  insertNamedFootnote,
  pasteInlineFootnote,
} from "./insert-or-navigate-footnotes";

export default class FootnotePlugin extends Plugin {
  // `declare`: refine the base Plugin.settings type (Obsidian 1.13+)
  // without emitting a class field that would shadow it
  declare settings: FootnotePluginSettings;

  async onload() {
    // Jason's hand-drawn "marker style" icon family (icons/marker style/):
    // a shared footnote-badge container with the action as the inner glyph
    // — plus (add numbered), I-beam text cursor (name it), arrow (paste).
    // Named vs inline is the container's top: notched vs flat. Source SVGs
    // are exported from Inkscape with stroke swapped to currentColor so
    // the icons follow the theme.
    addIcon("footnote-numbered", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(0,-118)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(16,116)"><path d="m-4 12v6"/><path d="m-1 15h-6"/></g><path d="m4 120 4 3e-5 4 3 4-3 4-3e-5c1.1046 0 2 0.89542 2 2v12.005c0 0.75383-0.4259 1.443-1.1001 1.7801l-7.7997 3.8998c-0.69256 0.34628-1.5077 0.34628-2.2003 0l-7.7997-3.8998c-0.67424-0.33712-1.1001-1.0262-1.1001-1.7801v-12.005c0-1.1046 0.89543-2 2-2z"/></g></svg>`);
    addIcon("footnote-named", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(0 -141.97)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m4 144 4 3e-5 4 3 4-3 4-3e-5c1.1046 0 2 0.89543 2 2v12.005c0 0.75382-0.4259 1.443-1.1001 1.7801l-7.7997 3.8998c-0.69256 0.34628-1.5077 0.34628-2.2003 0l-7.7997-3.8998c-0.67424-0.33712-1.1001-1.0262-1.1001-1.7801v-12.005c0-1.1046 0.89543-2 2-2z"/><g transform="translate(-24 141.07)"><path d="m39 16.937h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2h-1"/><path d="m33 8.9367h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1"/><path d="m36 10.93v4.1476"/></g></g></svg>`);
    addIcon("footnote-inline-cursor", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(24,-142)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m-20 145h16a2 2 0 0 1 2 2v11.005a1.9902 1.9902 0 0 1-1.1001 1.7801l-7.7997 3.8998a2.46 2.46 0 0 1-2.2003 0l-7.7997-3.8998a1.9902 1.9902 0 0 1-1.1001-1.7801v-11.005a2 2 0 0 1 2-2z"/><g transform="translate(-48 141.07)"><path d="m39 16.937h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2h-1"/><path d="m33 8.9367h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1"/><path d="m36 10.93v4.1476"/></g></g></svg>`);
    addIcon("footnote-inline-paste", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(24.1 -118.32)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m-20.1 121.32h16a2 2 0 0 1 2 2v11.005a1.9902 1.9902 0 0 1-1.1001 1.7801l-7.7997 3.8999a2.46 2.46 0 0 1-2.2003 0l-7.7997-3.8999a1.9902 1.9902 0 0 1-1.1001-1.7801v-11.005a2 2 0 0 1 2-2z"/><path d="m-12 127v8"/><path d="m-16 131 4 4 4-4"/></g></svg>`);

    await this.loadSettings();

    this.addCommand({
      id: "insert-autonumbered-footnote",
      name: "Insert / navigate auto-numbered footnote",
      icon: "footnote-numbered",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        void insertAutonumFootnote(this);
      },
    });
    this.addCommand({
      id: "insert-named-footnote",
      name: "Insert / navigate named footnote",
      icon: "footnote-named",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        void insertNamedFootnote(this);
      }
    });
    this.addCommand({
      id: "insert-inline-footnote",
      name: "Insert inline footnote",
      icon: "footnote-inline-cursor",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        void insertInlineFootnote(this);
      }
    });
    this.addCommand({
      id: "paste-inline-footnote",
      name: "Insert inline footnote from clipboard",
      icon: "footnote-inline-paste",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        void pasteInlineFootnote(this);
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