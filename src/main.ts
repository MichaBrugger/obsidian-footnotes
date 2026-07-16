// Plugin entry point: registers the hotkey commands (auto-numbered and
// named footnotes — each one "insert OR navigate", see
// insert-or-navigate-footnotes.ts for the decision cascade — the two
// inline-footnote inserts, and the whole-document cleanups from
// tidy-footnotes.ts), the settings tab, and the popup-dismissal hook.
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
import { footnoteAfterPunctuation } from "./footnote-after-punctuation";
import { moveFootnoteDefinitionsToBottom } from "./move-footnotes-to-bottom";
import { reindexFootnotes } from "./reindex-footnotes";
import { runFootnoteTransformCommand, tidyFootnotes } from "./tidy-footnotes";

export default class FootnotePlugin extends Plugin {
  // `declare`: refine the base Plugin.settings type (Obsidian 1.13+)
  // without emitting a class field that would shadow it
  declare settings: FootnotePluginSettings;

  async onload() {
    // Jason's hand-drawn "action style" icon family (icons/action style/):
    // the action is the main glyph — hash (numbered), I-beam text cursor
    // (named / inline write), clipboard (paste) — and the small mark gives
    // the footnote type: down ARROW (jump to the note bottom) for regular
    // footnotes, up chevron (the ^ of ^[...]) for inline ones. Source SVGs
    // exported from Inkscape with strokes as currentColor for theming.
    addIcon("footnote-numbered", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(0,1)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(-2,-1)" stroke="currentColor"><path d="m4 9h14"/><path d="m4 15h11"/><line x1="10" x2="8" y1="3" y2="21"/><path d="m16 3-2 18"/></g><path d="m22 16-3 3-3-3" stroke="currentColor"/><path d="m19 18v-7" stroke="currentColor"/></g></svg>`);
    addIcon("footnote-named", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(24,-62)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(-24,27)" stroke="currentColor"><path d="m12 53v-12c0-2.2091 1.7909-4 4-4h1"/><path d="m7 57h1a4 4 0 0 0 4-4"/><path d="m7 37h1a4 4 0 0 1 4 4"/></g><path d="m-2 78-3 3-3-3" stroke="currentColor"/><path d="m-5 80v-7" stroke="currentColor"/></g></svg>`);
    addIcon("footnote-inline-cursor", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(0,-62)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(0,62)"><path d="m12 18v-12c0-2.2091 1.7909-4 4-4h1"/><path d="m7 22h1a4 4 0 0 0 4-4"/><path d="m7 2h1a4 4 0 0 1 4 4"/></g><path d="m22 81-3-3-3 3"/></g></svg>`);
    addIcon("footnote-inline-paste", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(0,-27)"><rect x="8" y="29" width="8" height="4" rx="1" ry="1"/><path d="m16 31h2c1.1046 0 2 0.89543 2 2v6m-7 10h-7c-1.1046 0-2-0.89543-2-2v-14c0-1.1046 0.89543-2 2-2h2"/></g><path d="m22 19-3-3-3 3"/></g></svg>`);

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
  
    // Whole-document cleanup commands (Linter's footnote rules, rebuilt —
    // see tidy-footnotes.ts). Icons are stock Lucide until the hand-drawn
    // set grows matching ones.
    this.addCommand({
      id: "reindex-footnotes",
      name: "Reindex footnotes",
      icon: "list-ordered",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        void runFootnoteTransformCommand(this, reindexFootnotes, {
          done: "Footnotes reindexed.",
          noop: "Footnotes are already in order.",
        });
      },
    });
    this.addCommand({
      id: "move-footnotes-to-bottom",
      name: "Move all footnote definitions to the bottom",
      icon: "arrow-down-to-line",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        void runFootnoteTransformCommand(
          this,
          moveFootnoteDefinitionsToBottom,
          {
            done: "Footnote definitions moved to the bottom.",
            noop: "Footnote definitions are already at the bottom.",
          },
        );
      },
    });
    this.addCommand({
      id: "footnotes-after-punctuation",
      name: "Move footnote markers after punctuation",
      icon: "arrow-right-to-line",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        void runFootnoteTransformCommand(this, footnoteAfterPunctuation, {
          done: "Footnote markers moved after punctuation.",
          noop: "All footnote markers already follow punctuation.",
        });
      },
    });
    this.addCommand({
      id: "tidy-footnotes",
      name: "Tidy footnotes (punctuation, move to bottom, reindex)",
      icon: "sparkles",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        void runFootnoteTransformCommand(this, tidyFootnotes, {
          done: "Footnotes tidied.",
          noop: "Footnotes are already tidy.",
        });
      },
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