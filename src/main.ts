// Plugin entry point: registers the hotkey commands (auto-numbered and
// named footnotes - each one "insert OR navigate", see
// insert-or-navigate-footnotes.ts for the decision cascade - the two
// inline-footnote inserts, and the whole-document cleanups from
// src/linting/), the settings tab, and the popup-dismissal hook.
// Also owns settings load/save plus one-time migrations of legacy values.
import {
  addIcon,
  MarkdownView,
  Plugin,
} from "obsidian";

import { ensureTextPropertyType, readingViewActive, VaultWithConfigEvents, viewEditor } from "./editor/obsidian-internals";
import { undoOrphanNoticeExtension } from "./editor/undo-orphan-notice";
import { FootnotePluginSettingTab, FootnotePluginSettings, DEFAULT_SETTINGS } from "./settings";
import { dismissFootnotePopup } from "./commands/footnote-popup";
import { insertAutonumFootnote, insertInlineFootnote, insertNamedFootnote, pasteInlineFootnote } from "./commands/insert-or-navigate-footnotes";
import { footnotePrefixFromEditor } from "./parsing/footnote-prefix";
import { registerRenameFootnoteMenu, renameFootnote } from "./commands/rename-footnote";
import { SetFootnotePrefixModal } from "./commands/set-footnote-prefix";
import {
  installLintOnSave,
  installVimWriteHook,
  lintRulesAllDisabled,
  runFootnoteTransformCommand,
  lintFootnotes,
  lintOptionsFromSettings,
} from "./linting/linter";

import { showNotice } from "./editor/notice";
// bump when adding a new one-time settings migration in loadSettings
const CURRENT_SETTINGS_VERSION = 2;

export default class FootnotePlugin extends Plugin {
  // `declare`: refine the base Plugin.settings type (Obsidian 1.13+)
  // without emitting a class field that would shadow it
  declare settings: FootnotePluginSettings;

  // The active markdown view, but only when its text can actually be
  // edited on screen: the text-editing commands disappear from the palette
  // in Reading view, where the editor API would edit the HIDDEN buffer -
  // invisible insertions and toasts about references the user can't see
  // (reported 2026-08-08). "Set footnote prefix" deliberately stays
  // available there; a frontmatter edit is legitimate in Reading view.

  /** Full ids ("plugin:command") of every editor command, recorded at registration - the name modal's keyboard scope speaks exactly these commands' hotkeys. */
  editorCommandIds: string[] = [];

  editableMarkdownView(): MarkdownView | null {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    return mdView && !readingViewActive(mdView) ? mdView : null;
  }

  async onload() {
    // Jason's hand-drawn "action style" icon family (icons/action style/):
    // the action is the main glyph - hash (numbered), I-beam text cursor
    // (named / inline write), clipboard (paste), alert triangle (lint),
    // left arrow into a dashed divider (prefix), pencil (rename) - and the
    // small mark gives the footnote type: down ARROW (jump to the note
    // bottom) for regular footnotes, up chevron (the ^ of ^[...]) for
    // inline ones. The arrows sit one step lower since 2026-08-13 (Jason's
    // rebalance). Sources in icons/action style/ are raw Inkscape saves;
    // scripts/strip-inkscape-icons.mjs strips the editor metadata and
    // swaps Inkscape's stroke="#000" to currentColor for theming - paste
    // its icons/optimized/ output here.
    addIcon("footnote-numbered", `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g transform="translate(0,1)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(-3,-1)"><path d="M 5,9 H 19" /><path d="M 5,15 H 16" /><line x1="10" x2="8" y1="3" y2="21" /><path d="M 16,3 14,21" /></g><path d="m 22,17 -3,3 -3,-3" /><path d="M 19,19 V 12" /></g></svg>`);
    addIcon("footnote-named", `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g transform="translate(24,-62)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(-24,27)"><path d="m12 53v-12c0-2.209 1.791-4 4-4h1" /><path d="m7 57h1a4 4 0 0 0 4-4" /><path d="m7 37h1a4 4 0 0 1 4 4" /></g><path d="m -2,80 -3,3 -3,-3" /><path d="M -5,82 V 75" /></g></svg>`);
    addIcon("footnote-lint", `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m 22,18 -3,3 -3,-3" stroke="currentColor" /><path d="M 19,20 V 13" stroke="currentColor" /><g transform="translate(.006 -.019)" stroke="currentColor"><path d="M 16.588,9.019 13.73,4 c -0.766,-1.352 -2.714,-1.352 -3.48,0 l -8,14 c -0.774,1.34 0.202,3.014 1.75,3 h 8.994" fill="none" /><path d="m 11.994,9.019 v 4" /><path d="m 12,17 -0.006,0.019" /></g></g></svg>`);
    addIcon("footnote-prefix", `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M 19,20 V 13" stroke="currentColor" /><path d="m 22,18 -3,3 -3,-3" stroke="currentColor" /><g stroke="currentColor"><path d="m8 7-5 5 5 5v-10" /><path d="m12 20v2" /><path d="m12 14v2" /><path d="m12 8v2" /><path d="m12 2v2" /></g></g></svg>`);
    addIcon("footnote-rename", `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 19,20 V 13" /><path d="m 22,18 -3,3 -3,-3" /><path d="M 19.005,8.96 21.174,6.812 v 0 C 23.832,4.155 19.846,0.168 17.188,2.825 L 3.842,16.174 c -0.232,0.232 -0.404,0.517 -0.5,0.83 l -1.321,4.352 c -0.114,0.381 0.242,0.737 0.623,0.622 l 4.353,-1.32 c 0.313,-0.095 0.598,-0.266 0.83,-0.497 l 7.177,-7.197" /></g></svg>`);
    addIcon("footnote-inline-cursor", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="translate(0,-62)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(0,62)"><path d="m12 18v-12c0-2.2091 1.7909-4 4-4h1"/><path d="m7 22h1a4 4 0 0 0 4-4"/><path d="m7 2h1a4 4 0 0 1 4 4"/></g><path d="m22 81-3-3-3 3"/></g></svg>`);
    addIcon("footnote-inline-paste", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><g transform="translate(0,-27)"><rect x="8" y="29" width="8" height="4" rx="1" ry="1"/><path d="m16 31h2c1.1046 0 2 0.89543 2 2v6m-7 10h-7c-1.1046 0-2-0.89543-2-2v-14c0-1.1046 0.89543-2 2-2h2"/></g><path d="m22 19-3-3-3 3"/></g></svg>`);

    await this.loadSettings();

    // No default hotkeys, per Obsidian's plugin guidelines (considered and
    // reverted 2026-08-07): the README tells users to bind their own and
    // recommends Alt+0 / Alt+- for these two core commands. All four
    // insert commands share one registration shape: available exactly
    // while an editable markdown view is active.
    const insertCommands: Array<{
      id: string;
      name: string;
      icon: string;
      run: (plugin: FootnotePlugin) => Promise<void>;
    }> = [
      {
        id: "insert-autonumbered-footnote",
        name: "Insert / navigate auto-numbered footnote",
        icon: "footnote-numbered",
        run: insertAutonumFootnote,
      },
      {
        id: "insert-named-footnote",
        name: "Insert / navigate named footnote",
        icon: "footnote-named",
        run: insertNamedFootnote,
      },
      {
        id: "insert-inline-footnote",
        name: "Insert inline footnote",
        icon: "footnote-inline-cursor",
        run: insertInlineFootnote,
      },
      {
        id: "paste-inline-footnote",
        name: "Insert inline footnote from clipboard",
        icon: "footnote-inline-paste",
        run: pasteInlineFootnote,
      },
    ];
    for (const command of insertCommands) {
      this.addCommand({
        id: command.id,
        name: command.name,
        icon: command.icon,
        checkCallback: (checking: boolean) => {
          if (checking) return !!this.editableMarkdownView();
          void command.run(this);
        },
      });
      // every editor command's FULL id, recorded as it registers - the
      // name-the-footnote modal maps these to hotkey combos on its own
      // keyboard scope, so the list can never drift from what's registered
      this.editorCommandIds.push(`${this.manifest.id}:${command.id}`);
    }
    this.addCommand({
      id: "rename-footnote",
      name: "Rename footnote",
      icon: "footnote-rename",
      checkCallback: (checking: boolean) => {
        if (checking) return !!this.editableMarkdownView();
        void renameFootnote(this);
      },
    });
    this.editorCommandIds.push(`${this.manifest.id}:rename-footnote`);
    // right-click / long-press on a footnote also offers the rename, like
    // the native "Rename this heading" on heading lines
    registerRenameFootnoteMenu(this);
    this.addCommand({
      id: "set-footnote-prefix",
      name: "Set footnote prefix",
      icon: "footnote-prefix",
      checkCallback: (checking: boolean) => {
        const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (checking) return !!mdView?.file;
        if (!mdView?.file) return;
        // prefill with the note's current prefix so editing is one step -
        // read only the frontmatter block, not getValue()'s whole document
        // (2026-08-11 review perf item)
        const editor = viewEditor(mdView);
        new SetFootnotePrefixModal(
          this,
          mdView.file,
          editor ? footnotePrefixFromEditor(editor) : "",
        ).open();
      },
    });
  
    // The ONE whole-document cleanup command, like Linter's (the individual
    // rules are settings toggles, not separate commands - palette stays
    // uncluttered).
    this.addCommand({
      id: "lint-footnotes",
      name: "Lint footnotes",
      icon: "footnote-lint",
      checkCallback: (checking: boolean) => {
        if (checking) return !!this.editableMarkdownView();
        // with every rule toggled off the pipeline is a no-op - say that,
        // instead of a misleading "No linting needed."
        if (lintRulesAllDisabled(this)) {
          showNotice(
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
        // the save command until hooked - re-check on every leaf change
        installVimWriteHook(this);
      })
    );
    // "Lint on save" wraps the core save command (restored on unload)
    installLintOnSave(this);
    // partial-undo feedback: an undo that orphans a reference (the
    // two-step table-cell undo, the named flow's definition press) says
    // so instead of leaving a half-reverted note (2026-08-27)
    this.registerEditorExtension(undoOrphanNoticeExtension());
    this.app.workspace.onLayoutReady(() => {
      installVimWriteHook(this);
      // with the prefix feature on, pin the plugin-owned footnote-prefix
      // property to TEXT: numeric-looking values ("2.") otherwise teach
      // Obsidian's type inference to register it as a number, and the
      // Properties panel then coerces edits numerically (reported
      // 2026-08-12; the Set-footnote-prefix modal pins it on write too)
      if (this.settings.enableFootnotePrefix) {
        ensureTextPropertyType(this.app, "footnote-prefix");
      }
    });
    // enabling vim mode mid-session loads the adapter without any leaf
    // change - config-changed catches that moment
    this.registerEvent(
      (this.app.vault as unknown as VaultWithConfigEvents).on(
        "config-changed",
        () => {
          installVimWriteHook(this);
        },
      ),
    );
  }

  onunload() {
    dismissFootnotePopup();
  }

  async loadSettings() {
    const saved = (await this.loadData()) as
      | Partial<FootnotePluginSettings>
      | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

    // One-shot legacy migrations, gated by settingsVersion: some of them
    // rewrite saved values by SHAPE, so re-running them on every load can
    // mangle a deliberate new-style value - a saved "**Footnotes**" heading
    // used to gain "# " on each restart (bug confirmed live 2026-08-08,
    // pinned in test/hunt/). Version 0 is data from before the flag
    // existed, or a fresh install (where everything below no-ops). All
    // migrations share ONE save at the end.
    if (this.settings.settingsVersion < CURRENT_SETTINGS_VERSION) {
      // each migration is gated on the version it upgrades FROM, so a
      // later bump can never re-run an earlier shape-based rewrite on
      // values the user saved deliberately in the meantime (the
      // heading-mangle bug)
      if (this.settings.settingsVersion < 1) {
        migrateSettingsToV1(this.settings, saved);
      }
      if (this.settings.settingsVersion < 2) {
        migrateSettingsToV2(this.settings);
      }
      this.settings.settingsVersion = CURRENT_SETTINGS_VERSION;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// ---- one-time settings migrations, one function per version bump ----
// (gated in loadSettings on the version being upgraded FROM)

/** v1: the 0.1.x → 0.2.0-beta shape - PascalCase heading key, implied-H1 heading text, the removed autosuggest toggle, and the beta.5/6 tidy* → lint* renames. */
function migrateSettingsToV1(
  settings: FootnotePluginSettings,
  saved: Partial<FootnotePluginSettings> | null,
) {
  // saved data from 0.1.x used a PascalCase key for the section heading
  const legacySettings = settings as FootnotePluginSettings & {
    FootnoteSectionHeading?: string;
    enableAutoSuggest?: boolean;
  };
  // when the saved data SOMEHOW carries both keys (a downgrade or a
  // data.json sync merge - no real upgrade path produces it), the
  // newer camelCase value wins (decided 2026-08-10)
  if (
    typeof legacySettings.FootnoteSectionHeading === "string" &&
    typeof saved?.footnoteSectionHeading !== "string"
  ) {
    settings.footnoteSectionHeading = legacySettings.FootnoteSectionHeading;
  }
  delete legacySettings.FootnoteSectionHeading;

  // migrate pre-0.2.0 section heading values: the old text input
  // implied an H1, the textarea takes literal markdown
  const heading = settings.footnoteSectionHeading;
  if (heading && !/^(#{1,6} |---|\*\*\*|___)/.test(heading)) {
    settings.footnoteSectionHeading = `# ${heading}`;
  }

  // drop the setting for the removed autosuggest feature (Obsidian now
  // suggests footnotes natively)
  delete legacySettings.enableAutoSuggest;

  // the linting settings shipped under tidy* keys in beta.5/6: copy
  // each saved tidy* value onto its lint* name and drop the old key,
  // so beta testers keep their toggle choices. Spelled out per key
  // (rather than a rename map) so each move is statically typed -
  // withTidyKeys is the same object as `settings`, so writing here
  // sets the real lint* setting
  const withTidyKeys = settings as FootnotePluginSettings & {
    tidyFixPunctuation?: boolean;
    tidyMoveToBottom?: boolean;
    tidyReindex?: boolean;
    tidyOnSave?: boolean;
    lintOnFileChange?: unknown;
    tidyOnFileChange?: unknown;
  };
  if (withTidyKeys.tidyFixPunctuation !== undefined) {
    withTidyKeys.lintFixPunctuation = withTidyKeys.tidyFixPunctuation;
    delete withTidyKeys.tidyFixPunctuation;
  }
  if (withTidyKeys.tidyMoveToBottom !== undefined) {
    withTidyKeys.lintMoveToBottom = withTidyKeys.tidyMoveToBottom;
    delete withTidyKeys.tidyMoveToBottom;
  }
  if (withTidyKeys.tidyReindex !== undefined) {
    withTidyKeys.lintReindex = withTidyKeys.tidyReindex;
    delete withTidyKeys.tidyReindex;
  }
  if (withTidyKeys.tidyOnSave !== undefined) {
    withTidyKeys.lintOnSave = withTidyKeys.tidyOnSave;
    delete withTidyKeys.tidyOnSave;
  }
  // the lint-on-focused-file-change trigger was replaced by lint on
  // footnote creation (2026-08-05) - its saved keys are dropped rather
  // than carried over, since the semantics are different
  delete withTidyKeys.lintOnFileChange;
  delete withTidyKeys.tidyOnFileChange;
}

/** v2 (2026-08-10): the two orphan settings became symmetric delete toggles. keepOrphanedDefinitions (shipped in the betas) carries over with its polarity flipped; the short-lived lintOrphanedMarkers dropdown only existed in dev builds but maps just as cheaply. */
function migrateSettingsToV2(settings: FootnotePluginSettings) {
  const legacyOrphans = settings as FootnotePluginSettings & {
    keepOrphanedDefinitions?: boolean;
    lintOrphanedMarkers?: string;
  };
  if (typeof legacyOrphans.keepOrphanedDefinitions === "boolean") {
    settings.lintDeleteOrphanedDefinitions =
      !legacyOrphans.keepOrphanedDefinitions;
    delete legacyOrphans.keepOrphanedDefinitions;
  }
  if (legacyOrphans.lintOrphanedMarkers !== undefined) {
    settings.lintDeleteOrphanedReferences =
      legacyOrphans.lintOrphanedMarkers === "delete";
    delete legacyOrphans.lintOrphanedMarkers;
  }
}