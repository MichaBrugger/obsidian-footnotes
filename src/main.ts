// Plugin entry point: registers the hotkey commands (auto-numbered and
// named footnotes — each one "insert OR navigate", see
// insert-or-navigate-footnotes.ts for the decision cascade — the two
// inline-footnote inserts, and the whole-document cleanups from
// src/linting/), the settings tab, and the popup-dismissal hook.
// Also owns settings load/save plus one-time migrations of legacy values.
import {
  addIcon,
  MarkdownView,
  Notice,
  Plugin
} from "obsidian";

import { VaultWithConfigEvents } from "./obsidian-internals";
import { FootnotePluginSettingTab, FootnotePluginSettings, DEFAULT_SETTINGS } from "./settings";
import { dismissFootnotePopup } from "./footnote-popup";
import {
  footnotePrefix,
  insertAutonumFootnote,
  insertInlineFootnote,
  insertNamedFootnote,
  pasteInlineFootnote,
  readingViewActive,
} from "./insert-or-navigate-footnotes";
import { SetFootnotePrefixModal } from "./set-footnote-prefix";
import {
  installLintOnSave,
  installVimWriteHook,
  lintRulesAllDisabled,
  runFootnoteTransformCommand,
  lintFootnotes,
  lintOptionsFromSettings,
} from "./linting/linter";

// bump when adding a new one-time settings migration in loadSettings
const CURRENT_SETTINGS_VERSION = 2;

export default class FootnotePlugin extends Plugin {
  // `declare`: refine the base Plugin.settings type (Obsidian 1.13+)
  // without emitting a class field that would shadow it
  declare settings: FootnotePluginSettings;

  // The active markdown view, but only when its text can actually be
  // edited on screen: the text-editing commands disappear from the palette
  // in Reading view, where the editor API would edit the HIDDEN buffer —
  // invisible insertions and toasts about references the user can't see
  // (reported 2026-08-08). "Set footnote prefix" deliberately stays
  // available there; a frontmatter edit is legitimate in Reading view.
  editableMarkdownView(): MarkdownView | null {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    return mdView && !readingViewActive(mdView) ? mdView : null;
  }

  async onload() {
    // Jason's hand-drawn "action style" icon family (icons/action style/):
    // the action is the main glyph — hash (numbered), I-beam text cursor
    // (named / inline write), clipboard (paste), alert triangle (lint),
    // left arrow into a dashed divider (prefix) — and the small mark gives
    // the footnote type: down ARROW (jump to the note bottom) for regular
    // footnotes, up chevron (the ^ of ^[...]) for inline ones. Source SVGs
    // exported from Inkscape with strokes as currentColor for theming
    // (fresh exports come out stroke="#000" and must be swapped by hand).
    addIcon("footnote-numbered", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(0,1)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(-2,-1)"><path d="m4 9h14"/><path d="m4 15h11"/><line x1="10" x2="8" y1="3" y2="21"/><path d="m16 3-2 18"/></g><path d="m22 16-3 3-3-3"/><path d="m19 18v-7"/></g></svg>`);
    addIcon("footnote-named", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(24,-62)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(-24,27)"><path d="m12 53v-12c0-2.2091 1.7909-4 4-4h1"/><path d="m7 57h1a4 4 0 0 0 4-4"/><path d="m7 37h1a4 4 0 0 1 4 4"/></g><path d="m-2 79-3 3-3-3"/><path d="m-5 81v-7"/></g></svg>`);
    addIcon("footnote-lint", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m22 17-3 3-3-3"/><path d="m19 19v-7"/><g transform="translate(.006 -.019)"><path d="m16.027 8.0195-2.2969-4.0195c-0.76614-1.3519-2.7139-1.3519-3.48 0l-8 14c-0.77389 1.3403 0.20241 3.0139 1.75 3l9.994 0.01867"/><path d="m12 9v4"/><path d="m12 17h0.01"/></g></g></svg>`);
    addIcon("footnote-prefix", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m19 19v-7"/><path d="m22 17-3 3-3-3"/><path d="m8 7-5 5 5 5v-10"/><path d="m12 20v2"/><path d="m12 14v2"/><path d="m12 8v2"/><path d="m12 2v2"/></g></svg>`);
    addIcon("footnote-inline-cursor", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(0,-62)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(0,62)"><path d="m12 18v-12c0-2.2091 1.7909-4 4-4h1"/><path d="m7 22h1a4 4 0 0 0 4-4"/><path d="m7 2h1a4 4 0 0 1 4 4"/></g><path d="m22 81-3-3-3 3"/></g></svg>`);
    addIcon("footnote-inline-paste", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(0,-27)"><rect x="8" y="29" width="8" height="4" rx="1" ry="1"/><path d="m16 31h2c1.1046 0 2 0.89543 2 2v6m-7 10h-7c-1.1046 0-2-0.89543-2-2v-14c0-1.1046 0.89543-2 2-2h2"/></g><path d="m22 19-3-3-3 3"/></g></svg>`);

    await this.loadSettings();

    // No default hotkeys, per Obsidian's plugin guidelines (considered and
    // reverted 2026-08-07): the README tells users to bind their own and
    // recommends Alt+0 / Alt+- for these two core commands.
    this.addCommand({
      id: "insert-autonumbered-footnote",
      name: "Insert / navigate auto-numbered footnote",
      icon: "footnote-numbered",
      checkCallback: (checking: boolean) => {
        if (checking) return !!this.editableMarkdownView();
        void insertAutonumFootnote(this);
      },
    });
    this.addCommand({
      id: "insert-named-footnote",
      name: "Insert / navigate named footnote",
      icon: "footnote-named",
      checkCallback: (checking: boolean) => {
        if (checking) return !!this.editableMarkdownView();
        void insertNamedFootnote(this);
      }
    });
    this.addCommand({
      id: "insert-inline-footnote",
      name: "Insert inline footnote",
      icon: "footnote-inline-cursor",
      checkCallback: (checking: boolean) => {
        if (checking) return !!this.editableMarkdownView();
        void insertInlineFootnote(this);
      }
    });
    this.addCommand({
      id: "paste-inline-footnote",
      name: "Insert inline footnote from clipboard",
      icon: "footnote-inline-paste",
      checkCallback: (checking: boolean) => {
        if (checking) return !!this.editableMarkdownView();
        void pasteInlineFootnote(this);
      }
    });
    this.addCommand({
      id: "set-footnote-prefix",
      name: "Set footnote prefix",
      icon: "footnote-prefix",
      checkCallback: (checking: boolean) => {
        const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (checking) return !!mdView?.file;
        if (!mdView?.file) return;
        // prefill with the note's current prefix so editing is one step
        new SetFootnotePrefixModal(
          this,
          mdView.file,
          footnotePrefix(mdView.editor?.getValue() ?? ""),
        ).open();
      },
    });
  
    // The ONE whole-document cleanup command, like Linter's (the individual
    // rules are settings toggles, not separate commands — palette stays
    // uncluttered).
    this.addCommand({
      id: "lint-footnotes",
      name: "Lint footnotes",
      icon: "footnote-lint",
      checkCallback: (checking: boolean) => {
        if (checking) return !!this.editableMarkdownView();
        // with every rule toggled off the pipeline is a no-op — say that,
        // instead of a misleading "No linting needed."
        if (lintRulesAllDisabled(this)) {
          new Notice(
            "All lint rules are turned off in the plugin settings, so there is nothing to lint.",
          );
          return;
        }
        void runFootnoteTransformCommand(
          this,
          (markdown, sectionHeading) =>
            lintFootnotes(markdown, lintOptionsFromSettings(this, sectionHeading, markdown)),
          {
            done: "Footnotes linted.",
            noop: "No linting needed.",
          },
        );
      },
    });

    this.addSettingTab(new FootnotePluginSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        dismissFootnotePopup();
        // vim mode can be switched on at any time, and its ":w" bypasses
        // the save command until hooked — re-check on every leaf change
        installVimWriteHook(this);
      })
    );
    // "Lint on save" wraps the core save command (restored on unload)
    installLintOnSave(this);
    this.app.workspace.onLayoutReady(() => {
      installVimWriteHook(this);
    });
    // enabling vim mode mid-session loads the adapter without any leaf
    // change — config-changed catches that moment
    this.registerEvent(
      (this.app.vault as unknown as VaultWithConfigEvents).on(
        "config-changed",
        () => installVimWriteHook(this),
      ),
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

    // One-shot legacy migrations, gated by settingsVersion: some of them
    // rewrite saved values by SHAPE, so re-running them on every load can
    // mangle a deliberate new-style value — a saved "**Footnotes**" heading
    // used to gain "# " on each restart (bug confirmed live 2026-08-08,
    // pinned in test/hunt/). Version 0 is data from before the flag
    // existed, or a fresh install (where everything below no-ops). All
    // migrations share ONE save at the end.
    if (this.settings.settingsVersion < CURRENT_SETTINGS_VERSION) {
      // each block is gated on the version it upgrades FROM, so a later
      // bump can never re-run an earlier shape-based rewrite on values the
      // user saved deliberately in the meantime (the heading-mangle bug)
      if (this.settings.settingsVersion < 1) {
        // saved data from 0.1.x used a PascalCase key for the section heading
        const legacySettings = this.settings as FootnotePluginSettings & {
          FootnoteSectionHeading?: string;
          enableAutoSuggest?: boolean;
        };
        if (typeof legacySettings.FootnoteSectionHeading === "string") {
          this.settings.footnoteSectionHeading = legacySettings.FootnoteSectionHeading;
          delete legacySettings.FootnoteSectionHeading;
        }

        // migrate pre-0.2.0 section heading values: the old text input
        // implied an H1, the textarea takes literal markdown
        const heading = this.settings.footnoteSectionHeading;
        if (heading && !/^(#{1,6} |---|\*\*\*|___)/.test(heading)) {
          this.settings.footnoteSectionHeading = `# ${heading}`;
        }

        // drop the setting for the removed autosuggest feature (Obsidian now
        // suggests footnotes natively)
        delete legacySettings.enableAutoSuggest;

        // the linting settings shipped under tidy* keys in beta.5/6: copy
        // each saved tidy* value onto its lint* name and drop the old key,
        // so beta testers keep their toggle choices
        const tidyKeyRenames: Record<string, string> = {
          tidyFixPunctuation: "lintFixPunctuation",
          tidyMoveToBottom: "lintMoveToBottom",
          tidyReindex: "lintReindex",
          tidyOnSave: "lintOnSave",
        };
        const withTidyKeys = this.settings as FootnotePluginSettings &
          Record<string, unknown>;
        for (const [oldKey, newKey] of Object.entries(tidyKeyRenames)) {
          if (oldKey in withTidyKeys) {
            // withTidyKeys is the same object as this.settings, so writing
            // here sets the real lint* setting
            withTidyKeys[newKey] = withTidyKeys[oldKey];
            delete withTidyKeys[oldKey];
          }
        }
        // the lint-on-focused-file-change trigger was replaced by lint on
        // footnote creation (2026-08-05) — its saved keys are dropped rather
        // than carried over, since the semantics are different
        delete withTidyKeys["lintOnFileChange"];
        delete withTidyKeys["tidyOnFileChange"];
      }

      if (this.settings.settingsVersion < 2) {
        // v2 (2026-08-10): the two orphan settings became symmetric delete
        // toggles. keepOrphanedDefinitions (shipped in the betas) carries
        // over with its polarity flipped; the short-lived lintOrphanedMarkers
        // dropdown only existed in dev builds but maps just as cheaply.
        const legacyOrphans = this.settings as FootnotePluginSettings & {
          keepOrphanedDefinitions?: boolean;
          lintOrphanedMarkers?: string;
        };
        if (typeof legacyOrphans.keepOrphanedDefinitions === "boolean") {
          this.settings.lintDeleteOrphanedDefinitions =
            !legacyOrphans.keepOrphanedDefinitions;
          delete legacyOrphans.keepOrphanedDefinitions;
        }
        if (legacyOrphans.lintOrphanedMarkers !== undefined) {
          this.settings.lintDeleteOrphanedReferences =
            legacyOrphans.lintOrphanedMarkers === "delete";
          delete legacyOrphans.lintOrphanedMarkers;
        }
      }

      this.settings.settingsVersion = CURRENT_SETTINGS_VERSION;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}