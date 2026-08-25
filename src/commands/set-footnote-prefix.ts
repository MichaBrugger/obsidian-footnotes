import { MarkdownView, Notice, TFile } from "obsidian";

import type FootnotePlugin from "../main";
import { footnotePrefixProblem } from "../parsing/footnote-prefix";
import { ensureTextPropertyType } from "../editor/obsidian-internals";
import { ValidatedTextModal } from "./validated-text-modal";

// The "Set footnote prefix" command's modal: one text input that writes the
// footnote-prefix frontmatter property on Enter (or the Save button). An
// invalid prefix — spaces, brackets, or a trailing digit — shows the reason
// inline and keeps the modal open until the value is fixed (or the user
// cancels with Escape). An empty value removes the property.

export class SetFootnotePrefixModal extends ValidatedTextModal {
    private plugin: FootnotePlugin;
    private file: TFile;

    constructor(plugin: FootnotePlugin, file: TFile, currentPrefix: string) {
        super(plugin.app, {
            title: "Set footnote prefix",
            fieldName: "Prefix",
            fieldDesc:
                'Written to the note\'s footnote-prefix property. With "2." the auto-numbered command inserts [^2.1], then [^2.2], and so on. Leave empty to remove the property.',
            buttonText: "Save",
            placeholder: "2.",
            initialValue: currentPrefix,
        });
        this.plugin = plugin;
        this.file = file;
    }

    protected async submit() {
        const prefix = this.value.trim();
        const problem = footnotePrefixProblem(prefix);
        if (problem) {
            // stay open until the prefix is valid
            this.showProblem(problem);
            return;
        }
        // flush any unsaved editor changes to this file first:
        // processFrontMatter edits the FILE, and a pending autosave of a
        // stale buffer would silently overwrite the property right after
        // (races lost intermittently until pinned by the smoke suite)
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file === this.file) await view.save();
        await this.plugin.app.fileManager.processFrontMatter(
            this.file,
            (frontmatter: Record<string, unknown>) => {
                if (prefix) frontmatter["footnote-prefix"] = prefix;
                else delete frontmatter["footnote-prefix"];
            },
        );
        // a prefix is TEXT even when it looks numeric ("2.") — without an
        // explicit type, Obsidian infers one from occurrences and can
        // register the property as a number (reported 2026-08-12)
        if (prefix) {
            ensureTextPropertyType(this.plugin.app, "footnote-prefix");
        }
        this.close();
        if (prefix && !this.plugin.settings.enableFootnotePrefix) {
            // the property was written but nothing reads it while the
            // feature is off — without this warning the insert commands
            // just silently ignore the prefix the user set
            new Notice(
                `Footnote prefix set to "${prefix}", but the "Per-note footnote prefix" setting is turned off, so it won't be used until you enable it.`,
                8000,
            );
        } else {
            new Notice(
                prefix
                    ? `Footnote prefix set to "${prefix}".`
                    : "Footnote prefix removed.",
            );
        }
    }
}
